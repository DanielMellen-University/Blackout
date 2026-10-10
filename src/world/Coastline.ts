import { fbm, smoothstep, valueNoise } from './noise'

/** Global signed coast field. Shared by relief, water clipping and drainage. */
export function coastField(x: number, z: number): number {
  const wx = x + (valueNoise(x / 19000 + 711, z / 19000 - 93) - .5) * 9000
  const wz = z + (valueNoise(x / 19000 - 207, z / 19000 + 431) - .5) * 9000
  // Regional embayments plus smaller headlands/islands, never basin ellipses.
  // Keep seas exceptional: about a quarter of the previous water coverage.
  return fbm(wx / 22000 + 517, wz / 22000 - 319, 3, 2, .48) - .249
}

/** Blend inland relief into shelves, coastal lowlands and a true seabed. */
export function coastalRelief(height: number, field: number): number {
  const inland = smoothstep(.015, .14, field)
  const shore = field * 1800
  return shore + Math.max(0, height - 90) * inland
}
