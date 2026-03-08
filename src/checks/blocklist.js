'use strict'

/**
 * Blocklist check.
 *
 * Compares a package name against the hard-coded blocklist of known
 * malicious packages, plus any user-defined custom entries from
 * the .darkfallrc configuration file.
 */

const { BLOCKLIST } = require('../data/blocklist')

/**
 * Check a package against the blocklist.
 *
 * @param {string} pkgName  - Package name to check
 * @param {Object} config   - Darkfall configuration object
 * @returns {Object|null}     Issue object if blocked, null if clean
 */
function check(pkgName, config) {
  if (!config.checks.blocklist) return null

  // Check the built-in blocklist
  const isBlocked = BLOCKLIST.has(pkgName)

  // Check user-defined custom blocklist entries
  const customBlocked = config.blocklist.custom.includes(pkgName)

  if (isBlocked || customBlocked) {
    return {
      type: 'blocklist',
      severity: config.blocklist.action,
      message: 'Known malicious package',
    }
  }

  return null
}

module.exports = { check }
