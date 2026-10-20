/** Mission parameters consumed by the ordinary terrain and worker pipeline. */
export const MISSION_THEMES = ['desert-run', 'mountain-valley-run', 'coastal-island-run', 'volcanic-run'] as const
export type MissionTheme = typeof MISSION_THEMES[number]
export interface TerrainProfile {
  theme: MissionTheme
  landscapeRevision: number
  routeRevision: number
  originX: number
  originZ: number
  yaw: number
  baseHeight: number
  relief: number
  valleyHalfWidth: number
  phase: number
  dry: boolean
}
let active: Readonly<TerrainProfile> | null = null
export function setTerrainProfile(profile: Readonly<TerrainProfile> | null): void { active = profile }
export function getTerrainProfile(): Readonly<TerrainProfile> | null { return active }
export function generatedThemeForProfile(profile: unknown): MissionTheme | null {
  return profile === 'generated-desert' ? 'desert-run' : profile === 'generated-valley' ? 'mountain-valley-run' : profile === 'generated-coastal' ? 'coastal-island-run' : profile === 'generated-volcanic' ? 'volcanic-run' : null
}
