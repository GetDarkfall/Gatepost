'use strict'

/**
 * Package age check.
 *
 * Flags packages that were published less than a configurable number
 * of days ago (default: 1 day). Brand-new packages are a common
 * vector for supply chain attacks — attackers publish malicious
 * packages and immediately start targeting victims.
 *
 * The check queries the package's public registry to determine its
 * first-publish date. If the registry is unreachable, the check
 * is skipped (never blocks a workflow due to network issues).
 */

const { getPackageAge } = require('../api/registry')

/**
 * Check if a package was published recently.
 *
 * @param {string} pkgName    - Package name to check
 * @param {string} ecosystem  - Package ecosystem (e.g. 'npm', 'PyPI')
 * @param {Object} config     - Gatepost configuration object
 * @returns {Promise<Object|null>} Issue object if too new, null if fine
 */
async function check(pkgName, ecosystem, config) {
  if (!config.checks.age) return null

  const createdDate = await getPackageAge(pkgName, ecosystem, config.timeout)

  // If we can't determine the age, skip the check
  if (!createdDate || isNaN(createdDate.getTime())) return null

  const now = new Date()
  const ageMs = now - createdDate
  const ageDays = ageMs / (1000 * 60 * 60 * 24)

  if (ageDays < config.age.minimumDays) {
    const hours = Math.round(ageMs / (1000 * 60 * 60))
    const timeStr = hours < 24
      ? `${hours} hour${hours !== 1 ? 's' : ''}`
      : `${Math.round(ageDays)} day${Math.round(ageDays) !== 1 ? 's' : ''}`

    return {
      type: 'age',
      severity: config.age.action,
      message: `Package is only ${timeStr} old (minimum: ${config.age.minimumDays} day${config.age.minimumDays !== 1 ? 's' : ''})`,
    }
  }

  return null
}

module.exports = { check }
