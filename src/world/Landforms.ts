import { clamp01, fbm, smoothstep, valueNoise } from './noise'

/** Rounded, continuous landforms. Sharp ridged noise is deliberately absent. */
export function sampleLandforms(x: number, z: number) {
  const wx = x + (fbm(x / 11000, z / 11000, 2) - .5) * 2200
  const wz = z + (fbm(x / 11000 + 51, z / 11000 - 39, 2) - .5) * 2200
  const moisture = clamp01((fbm(wx / 7200 + 30, wz / 7200 - 81, 2) - .2) * 1.7)
  const temperature = clamp01((fbm(wx / 11000 - 65, wz / 11000 + 9, 2) - .2) * 1.65 + Math.sin(z / 45000) * .15)
  const dry = 1 - smoothstep(.25, .5, moisture)
  const cold = 1 - smoothstep(.27, .47, temperature)
  const hot = smoothstep(.53, .75, temperature)
  const province = valueNoise(wx / 9000 + 215, wz / 9000 - 130)
  const badlands = dry * smoothstep(.42, .65, province)
  const dunes = dry * (1 - smoothstep(.4, .62, province))
  const highlands = smoothstep(.54, .82, fbm(wx / 17000 - 123, wz / 17000 + 63, 2))
  const hills = fbm(wx / 1700, wz / 1700, 2)
  const gentle = smoothstep(.18, .78, valueNoise(wx / 6500 + 5, wz / 6500 - 23))
  const rolling = hills * hills * (60 + gentle * 320)
  const detail = (valueNoise(wx / 260, wz / 260) - .5) * 3
  let height = 55 + valueNoise(wx / 7000, wz / 7000) * 100 + rolling + detail
  // Green biomes stay rolling; high massifs occupy their own broad provinces.
  const summit = .45 + fbm(wx / 4600 + 81, wz / 4600 - 52, 2) * .55
  height += highlands * summit * 6800
  const wet = smoothstep(.42, .76, moisture)
  height += wet * (1 - highlands) * hills * hills * (65 + hot * 30)
  height += cold * (valueNoise(wx / 900 + 33, wz / 900) - .3) * 35
  const dunePhase = wx / 220 + Math.sin(wz / 1100) * 2 + valueNoise(wx / 1500, wz / 1500) * 6
  height += dunes * Math.pow((Math.sin(dunePhase) + 1) * .5, 2) * 42
  const table = fbm(wx / 2300 + 81, wz / 2300 - 7, 2)
  const terraces = smoothstep(.24, .46, table) * 170 + smoothstep(.46, .7, table) * 260
  height += badlands * terraces
  const ravine = badlands * (1 - smoothstep(.025, .13, Math.abs(valueNoise(wx / 3800 - 10, wz / 3800 + 80) - .5)))
  height -= ravine * 100
  const volcanic = smoothstep(.8, .95, province) * smoothstep(.35, .65, highlands)
  const salt = dry * (1 - highlands) * (1 - smoothstep(.06, .15, province))
  height += volcanic * hills * hills * 700
  height += (90 + detail * .1 - height) * salt
  return { height, moisture, temperature, highlands, badlands, dunes, cold, hot, dry, ravine, volcanic, salt }
}
