import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const packageVersion = typeof packageJson.version === 'string' ? packageJson.version : ''
const lockfile = JSON.parse(readFileSync(new URL('../package-lock.json', import.meta.url), 'utf8'))
const lockfileVersion = typeof lockfile.version === 'string' ? lockfile.version : ''
const lockfileRootVersion = typeof lockfile.packages?.['']?.version === 'string'
  ? lockfile.packages[''].version
  : ''
const versionSource = readFileSync(new URL('../src/core/Version.ts', import.meta.url), 'utf8')
const sourceMatch = versionSource.match(/APP_VERSION\s*=\s*'([^']+)'/)
const sourceVersion = sourceMatch?.[1] ?? ''
const roadmapMatch = versionSource.match(/ROADMAP_CHUNK\s*=\s*'([^']+)'/)
const roadmapChunk = roadmapMatch?.[1] ?? ''
const releaseNameMatch = versionSource.match(/RELEASE_NAME\s*=\s*'([^']+)'/)
const releaseName = releaseNameMatch?.[1] ?? ''
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
const firstReleaseHeading = changelog.match(/^## v([^\n]+) - (\d{4}-\d{2}-\d{2})$/m)
const indexHtml = readFileSync(new URL('../index.html', import.meta.url), 'utf8')
const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8')

const errors = []
if (!packageVersion) errors.push('package.json is missing a string version')
if (packageVersion && !/^\d+\.\d+\.\d+$/.test(packageVersion)) {
  errors.push(`package.json version (${packageVersion}) is not strict semantic versioning`)
}
if (!lockfileVersion) errors.push('package-lock.json is missing a root string version')
if (!lockfileRootVersion) errors.push('package-lock.json is missing the package root version')
if (!sourceVersion) errors.push('src/core/Version.ts is missing APP_VERSION')
if (!roadmapChunk) errors.push('src/core/Version.ts is missing ROADMAP_CHUNK')
if (!releaseName) errors.push('src/core/Version.ts is missing RELEASE_NAME')
if (roadmapChunk && !/^\d+\.\d+$/.test(roadmapChunk)) {
  errors.push(`src/core/Version.ts roadmap chunk (${roadmapChunk}) is not a valid internal chunk ID`)
}
if (packageVersion && sourceVersion && packageVersion !== sourceVersion) {
  errors.push(`package.json (${packageVersion}) does not match src/core/Version.ts (${sourceVersion})`)
}
if (packageVersion && lockfileVersion && packageVersion !== lockfileVersion) {
  errors.push(`package.json (${packageVersion}) does not match package-lock.json (${lockfileVersion})`)
}
if (packageVersion && lockfileRootVersion && packageVersion !== lockfileRootVersion) {
  errors.push(`package.json (${packageVersion}) does not match package-lock root (${lockfileRootVersion})`)
}
if (packageVersion && (!firstReleaseHeading || firstReleaseHeading[1] !== packageVersion)) {
  errors.push(`CHANGELOG.md must start with a dated v${packageVersion} release heading`)
}
if (packageVersion && releaseName) {
  const titleFallback = `v${packageVersion} / ${releaseName}`
  if (!indexHtml.includes(titleFallback)) {
    errors.push(`index.html is missing the title version fallback (${titleFallback})`)
  }
  if (!readme.includes(`Current release: **v${packageVersion}** (\`${releaseName}\`)`)) {
    errors.push(`README.md is missing the current release identity (${titleFallback})`)
  }
}

if (errors.length > 0) {
  console.error('Version check failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`Version check passed: v${packageVersion}`)
}
