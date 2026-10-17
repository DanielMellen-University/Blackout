export interface WeatherTransport { x: number; z: number }

/** Prevailing wind aloft carries the entire front and its cloud identities.
 * Surface wind can strengthen and veer locally without shearing or resetting
 * the air mass. Seed and simulation time fully determine transport. */
export function writeWeatherTransport(out: WeatherTransport, seed: number): WeatherTransport {
  let n = Math.round((Number.isFinite(seed) ? seed : 0) * 1_000_000) | 0
  n = Math.imul(n ^ (n >>> 16), 0x7feb352d)
  n = Math.imul(n ^ (n >>> 15), 0x846ca68b)
  const roll = ((n ^ (n >>> 16)) >>> 0) / 4294967296
  const heading = roll * Math.PI * 2
  const speed = 10 + ((Math.imul(n, 1274126177) >>> 0) / 4294967296) * 6
  out.x = Math.cos(heading) * speed
  out.z = Math.sin(heading) * speed
  return out
}
