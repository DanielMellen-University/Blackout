import { afterEach, expect, it } from 'vitest'
import coverage from './fixtures/village-coverage.json'
import { clearOpsPad } from '../src/world/terrainSample'
import { setWorldSeed } from '../src/world/noise'
import { settlementForCell } from '../src/world/SettlementPlan'
import { buildableRegionalLinksForSettlement } from '../src/world/RegionalRoads'

afterEach(() => clearOpsPad())

it('accounts for every surveyed village with a generated link or an explicit reviewed skip', () => {
  expect(coverage.sites).toHaveLength(16)
  expect(new Set(coverage.sites.map(s => `${s.seed}/${s.id}`)).size).toBe(16)
  expect(coverage.sites.filter(s => s.status === 'deliberate-skip').map(s => `${s.seed}/${s.id}`)).toEqual(['73/-3,8'])
  for (const site of coverage.sites) {
    clearOpsPad(); setWorldSeed(site.seed)
    const [cx, cz] = site.id.split(',').map(Number)
    const plan = settlementForCell(cx!, cz!)!
    expect(plan.kind).toBe('village')
    const links = buildableRegionalLinksForSettlement(plan).map(link => link.key)
    expect(links, `${site.seed}/${site.id}`).toEqual(site.links)
    if (site.status === 'deliberate-skip') {
      expect(links).toHaveLength(0)
      expect(site.reason).toContain('docs/reviews/roads-10.939/README.md')
    } else expect(links.length).toBeGreaterThan(0)
  }
}, 180_000)
