/** Public release identity. Keep this separate from internal roadmap chunk IDs. */
export const APP_VERSION = '0.12.0' as const
export const ROADMAP_CHUNK = '10.829' as const
/** Last shipped roadmap chunk, kept explicit so release notes cannot drift. */
export const PREVIOUS_ROADMAP_CHUNK = '10.828' as const
export const RELEASE_NAME = 'Systems expansion' as const

export function appVersionLabel(): string {
  return `v${APP_VERSION}`
}

export function appReleaseLabel(): string {
  return `${appVersionLabel()} / ${RELEASE_NAME}`
}
