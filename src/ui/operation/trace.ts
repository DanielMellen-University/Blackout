import type { FlightSample } from '../../systems/operation/samples'

/** SVG path of altitude against down-track distance. Empty when nothing has been flown. */
export function operationTracePath(samples: readonly FlightSample[], width = 640, height = 160): string {
  if (samples.length === 0) return ''
  let minZ = Infinity
  let maxZ = -Infinity
  let minY = Infinity
  let maxY = -Infinity
  const step = samples.length > 480 ? Math.ceil(samples.length / 480) : 1
  const picked: FlightSample[] = []
  for (let index = 0; index < samples.length; index += step) {
    const sample = samples[index]
    if (!sample) continue
    picked.push(sample)
    minZ = Math.min(minZ, sample.z)
    maxZ = Math.max(maxZ, sample.z)
    minY = Math.min(minY, sample.y)
    maxY = Math.max(maxY, sample.y)
  }
  const last = samples[samples.length - 1]
  if (last && picked[picked.length - 1] !== last) {
    picked.push(last)
    minZ = Math.min(minZ, last.z)
    maxZ = Math.max(maxZ, last.z)
    minY = Math.min(minY, last.y)
    maxY = Math.max(maxY, last.y)
  }
  const spanZ = Math.max(1, maxZ - minZ)
  const spanY = Math.max(1, maxY - minY)
  return picked.map((sample, index) => {
    const x = 8 + ((sample.z - minZ) / spanZ) * (width - 16)
    const y = height - 8 - ((sample.y - minY) / spanY) * (height - 16)
    return `${index === 0 ? 'M' : 'L'}${x.toFixed(1)} ${y.toFixed(1)}`
  }).join(' ')
}
