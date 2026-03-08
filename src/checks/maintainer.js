'use strict'

/**
 * Maintainer change detection.
 *
 * Flags packages where the most recent version was published by a
 * different user than the majority of previous versions. This is
 * how the event-stream attack worked — a new maintainer took over
 * the package and injected malicious code.
 *
 * Only works for npm (registry exposes _npmUser per version).
 */

const https = require('https')

/**
 * Fetch the full packument (all versions) from npm registry.
 *
 * @param {string} pkgName - Package name
 * @param {number} timeout - Request timeout in ms
 * @returns {Promise<Object|null>}
 */
function fetchPackument(pkgName, timeout) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'registry.npmjs.org',
      path: `/${encodeURIComponent(pkgName)}`,
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'gatepost' },
      timeout,
    }, (res) => {
      if (res.statusCode !== 200) { resolve(null); return }
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try { resolve(JSON.parse(data)) }
        catch { resolve(null) }
      })
    })
    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
    req.end()
  })
}

/**
 * Check if the latest publisher differs from the historical publisher.
 *
 * @param {string} pkgName   - Package name
 * @param {string} ecosystem - Package ecosystem
 * @param {Object} config    - Gatepost configuration
 * @returns {Promise<Object|null>} Issue if maintainer changed, null otherwise
 */
async function check(pkgName, ecosystem, config) {
  if (!config.checks.maintainer) return null
  if (ecosystem !== 'npm') return null

  const packument = await fetchPackument(pkgName, config.timeout)
  if (!packument || !packument.versions) return null

  const versionKeys = Object.keys(packument.versions)
  if (versionKeys.length < 2) return null

  // Extract the publisher (_npmUser.name) for each version
  const publishers = versionKeys
    .map(v => packument.versions[v]._npmUser)
    .filter(Boolean)
    .map(u => u.name || u.email)

  if (publishers.length < 2) return null

  const latest = publishers[publishers.length - 1]
  const previous = publishers.slice(0, -1)

  // Count how many previous versions were by each publisher
  const counts = {}
  for (const p of previous) {
    counts[p] = (counts[p] || 0) + 1
  }

  // If the latest publisher never published a previous version, flag it
  if (!counts[latest]) {
    const primaryPublisher = Object.entries(counts).sort((a, b) => b[1] - a[1])[0][0]
    return {
      type: 'maintainer',
      severity: config.maintainer.action,
      message: `New publisher "${latest}" (previously "${primaryPublisher}")`,
    }
  }

  return null
}

module.exports = { check }
