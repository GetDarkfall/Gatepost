'use strict'

/**
 * Typosquat detection.
 *
 * Uses Levenshtein edit distance to compare a package name against
 * the most popular packages in its ecosystem. If the distance is
 * between 1 and the configured max (default 2), it's flagged as a
 * possible typosquat.
 */

const { ECOSYSTEM_POOLS } = require('../data/popular')

/**
 * Compute the Levenshtein edit distance between two strings.
 * This measures the minimum number of single-character edits
 * (insertions, deletions, substitutions) to transform a into b.
 *
 * @param {string} a - First string
 * @param {string} b - Second string
 * @returns {number}   Edit distance
 */
function levenshtein(a, b) {
  const m = a.length, n = b.length
  const dp = []
  for (let i = 0; i <= m; i++) {
    dp[i] = [i]
    for (let j = 1; j <= n; j++) {
      dp[i][j] = i === 0
        ? j
        : a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1])
    }
  }
  return dp[m][n]
}

/**
 * Check a package name for typosquatting.
 *
 * @param {string} pkgName    - Package name to check
 * @param {string} ecosystem  - Package ecosystem (e.g. 'npm', 'PyPI')
 * @param {Object} config     - Gatepost configuration object
 * @returns {Object|null}       Issue object if suspicious, null if clean
 */
function check(pkgName, ecosystem, config) {
  if (!config.checks.typosquat) return null

  const pool = ECOSYSTEM_POOLS[ecosystem] || ECOSYSTEM_POOLS['npm']
  const maxDist = config.typosquat.maxDistance

  // Use the local name for scoped npm packages: @types/node → node
  const localName = pkgName.startsWith('@')
    ? pkgName.split('/')[1] || ''
    : pkgName

  const lower = localName.toLowerCase()

  // Skip very short names — too many false positives
  if (lower.length < 4) return null

  for (const popular of pool) {
    // Exact match — not a typosquat
    if (lower === popular.toLowerCase()) return null

    const dist = levenshtein(lower, popular.toLowerCase())
    if (dist >= 1 && dist <= maxDist) {
      return {
        type: 'typosquat',
        severity: config.typosquat.action,
        message: `Possible typosquat of "${popular}"`,
      }
    }
  }

  return null
}

module.exports = { check, levenshtein }
