"""Stream Chromium's line-delimited trace events into bounded hitch evidence.

Keep thread metadata, the navigation clock and events intersecting measured
long intervals. This handles timelines larger than V8's single-string limit.
The full compressed capture stays local, alongside the published excerpt.
"""
import gzip
import json
import shutil
import sys
import re
from pathlib import Path

source = Path(sys.argv[1])
target = Path(sys.argv[2])
target.mkdir(parents=True, exist_ok=True)
for record in source.glob('*.json'):
    if not re.fullmatch(r'(city|world)-\d+\.json', record.name):
        continue
    stem = record.stem
    data = json.loads(record.read_text())
    trace = source / f'{stem}.trace.json.gz'
    if not trace.exists():
        raise RuntimeError(f'Missing complete native timeline: {trace}')
    frames = [frame for group in data['longFrames'].values() for frame in group]
    metadata = []
    navigation = None
    # Trace chunks from different processes need not be in timestamp order.
    # Find the clock first so early-serialized GPU events are not discarded.
    with gzip.open(trace, 'rt') as stream:
        for line in stream:
            if 'navigationStart' not in line:
                continue
            value = line.strip().removesuffix(',')
            if not value.startswith('{'):
                continue
            event, _ = json.JSONDecoder().raw_decode(value)
            if event.get('name') == 'navigationStart' and f"seed={data['seed']}&" in event.get('args', {}).get('data', {}).get('documentLoaderURL', ''):
                navigation = event
                break
    if navigation is None:
        raise RuntimeError('Navigation clock absent from native capture')
    events = []
    event_count = 0
    raf_count = 0
    main_extent = [float('inf'), 0]
    extent = [float('inf'), 0]
    with gzip.open(trace, 'rt') as stream:
        for line in stream:
            value = line.strip().removesuffix(',')
            if not (value.startswith('{') and value.endswith('}')):
                continue
            # The last event may share its line with the trace footer.
            event, _ = json.JSONDecoder().raw_decode(value)
            if 'ph' not in event or 'name' not in event:
                continue
            event_count += 1
            if event['ph'] == 'M':
                metadata.append(event)
                continue
            if event.get('pid') == navigation['pid'] and event.get('tid') == navigation['tid'] and event['name'] == 'FireAnimationFrame' and event['ph'] == 'X':
                raf_count += 1
            origin = navigation['ts']
            start = (event['ts'] - origin) / 1000
            end = start + event.get('dur', 0) / 1000
            if event.get('pid') == navigation['pid'] and event.get('tid') == navigation['tid']:
                main_extent[0] = min(main_extent[0], start)
                main_extent[1] = max(main_extent[1], end)
            extent[0] = min(extent[0], start)
            extent[1] = max(extent[1], end)
            if any(start < frame['endMs'] + 10 and end >= frame['startMs'] - 10 for frame in frames):
                events.append(event)
    if navigation is None:
        raise RuntimeError('Navigation clock absent from native capture')
    complete_coverage = raf_count >= data['flightFrames']['samples']
    if any(frame['startMs'] < main_extent[0] or frame['endMs'] > main_extent[1] for frame in frames):
        raise RuntimeError('A long interval is outside the captured main-thread extent')
    events = metadata + [navigation] + events
    with gzip.open(target / f'{stem}.trace.json.gz', 'wt') as output:
        json.dump({'traceEvents': events}, output, separators=(',', ':'))
    for name in [record.name, f'{stem}.cpuprofile.gz', 'source-sha256.json']:
        shutil.copy2(source / name, target / name)
    (target / f'{stem}.extraction.json').write_text(json.dumps({
        'source': str(trace), 'totalEvents': event_count, 'retainedEvents': len(events), 'mainRafCount': raf_count,
        'extentMs': extent, 'mainExtentMs': main_extent, 'completeFlightCoverage': complete_coverage, 'longIntervals': frames,
        'note': 'Events within 10 ms of recorded >100 ms intervals. Check completeFlightCoverage: a filled buffer cannot establish attribution for the omitted tail. Worker spans are not main-thread costs.'
    }, indent=2) + '\n')
    print(stem, event_count, 'events,', len(events), 'retained')
