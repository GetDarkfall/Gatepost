'use strict'

/**
 * Check orchestrator.
 *
 * Runs all enabled checks against a list of packages in parallel.
 * Each check module exposes a `check(pkgName, ecosystem, config)`
 * function that returns an issue object or null.
 *
 * The orchestrator collects all issues per package and returns
 * a results array: [{ pkg, issues: [...] }]
 */

const blocklist = require('./blocklist')
const typosquat = require('./typosquat')
const vulnerability = require('./vulnerability')
const age = require('./age')
const scripts = require('./scripts')
const maintainer = require('./maintainer')

/**
 * Parse the canonical package name from an install argument.
 * Handles: lodash, lodash@4.x, @types/node, @types/node@18.0.0
 *
 * @param {string} arg - Raw install argument
 * @returns {string|null} Parsed package name, or null if not a package
 */
function parsePkgName(arg) {
  if (arg.startsWith('@')) {
    const match = arg.match(/^(@[^/]+\/[^@]+)/)
    return match ? match[1] : null
  }
  const name = arg.split('@')[0]
  return name || null
}

/**
 * Determine if an argument looks like a package name.
 * Filters out URLs, file paths, git refs, and flags.
 *
 * @param {string} arg - Raw argument
 * @returns {boolean}
 */
function isPackageName(arg) {
  if (!arg || arg.startsWith('-')) return false
  if (arg.startsWith('git+') || arg.startsWith('github:') ||
      arg.startsWith('gitlab:') || arg.startsWith('bitbucket:') ||
      arg.startsWith('file:') || arg.startsWith('http') ||
      arg.startsWith('.') || arg.startsWith('/')) return false
  return true
}

/**
 * Run all checks against a single package.
 *
 * @param {string} arg        - Raw install argument (e.g. 'lodash@4.x')
 * @param {string} ecosystem  - Package ecosystem
 * @param {Object} config     - Gatepost configuration object
 * @returns {Promise<Object>}   { pkg: string, issues: Object[] }
 */
async function checkPackage(arg, ecosystem, config) {
  const pkgName = ecosystem === 'npm' ? parsePkgName(arg) : arg.trim()
  if (!pkgName) return { pkg: arg, issues: [] }

  // Skip allowlisted packages
  if (config.allowlist.includes(pkgName)) {
    return { pkg: pkgName, issues: [] }
  }

  // Run all checks in parallel
  const results = await Promise.all([
    blocklist.check(pkgName, config),
    typosquat.check(pkgName, ecosystem, config),
    vulnerability.check(pkgName, ecosystem, config),
    age.check(pkgName, ecosystem, config),
    scripts.check(pkgName, ecosystem, config),
    maintainer.check(pkgName, ecosystem, config),
  ])

  // Filter out null results (clean checks)
  const issues = results.filter(Boolean)

  return { pkg: pkgName, issues }
}

/**
 * Run all checks against multiple packages in parallel.
 *
 * @param {string[]} args      - Raw install arguments
 * @param {string}   ecosystem - Package ecosystem
 * @param {Object}   config    - Gatepost configuration object
 * @returns {Promise<Object[]>}  Array of { pkg, issues } results
 */
async function checkPackages(args, ecosystem = 'npm', config) {
  const packageArgs = args.filter(isPackageName)
  if (packageArgs.length === 0) return []
  return Promise.all(packageArgs.map(a => checkPackage(a, ecosystem, config)))
}

module.exports = { checkPackages, parsePkgName, isPackageName }
