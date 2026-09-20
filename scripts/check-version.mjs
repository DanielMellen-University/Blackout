import { readFileSync } from 'node:fs'

const packageJson = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'))
const packageVersion = typeof packageJson.version === 'string' ? packageJson.version : ''
const versionSource = readFileSync(new URL('../src/core/Version.ts', import.meta.url), 'utf8')
const sourceMatch = versionSource.match(/APP_VERSION\s*=\s*'([^']+)'/)
const sourceVersion = sourceMatch?.[1] ?? ''
const changelog = readFileSync(new URL('../CHANGELOG.md', import.meta.url), 'utf8')
const changelogHeader = new RegExp(`^## v${escapeRegExp(packageVersion)} - \\d{4}-\\d{2}-\\d{2}$`, 'm')

const errors = []
if (!packageVersion) errors.push('package.json is missing a string version')
if (packageVersion && !/^\d+\.\d+\.\d+$/.test(packageVersion)) {
  errors.push(`package.json version (${packageVersion}) is not strict semantic versioning`)
}
if (!sourceVersion) errors.push('src/core/Version.ts is missing APP_VERSION')
if (packageVersion && sourceVersion && packageVersion !== sourceVersion) {
  errors.push(`package.json (${packageVersion}) does not match src/core/Version.ts (${sourceVersion})`)
}
if (packageVersion && !changelogHeader.test(changelog)) {
  errors.push(`CHANGELOG.md is missing a dated v${packageVersion} release heading`)
}

if (errors.length > 0) {
  console.error('Version check failed:')
  for (const error of errors) console.error(`- ${error}`)
  process.exitCode = 1
} else {
  console.log(`Version check passed: v${packageVersion}`)
}

function escapeRegExp(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}
