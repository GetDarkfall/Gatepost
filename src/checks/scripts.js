'use strict'

/**
 * Install script detection.
 *
 * Flags packages that have preinstall, install, or postinstall scripts.
 * These lifecycle scripts are the #1 malware delivery vector — they run
 * arbitrary code on the user's machine during `npm install`.
 *
 * Only applies to npm ecosystem packages (other ecosystems don't have
 * lifecycle scripts in the same way).
 */

const https = require('https')

/**
 * Fetch the latest version metadata from the npm registry.
 *
 * @param {string} pkgName - Package name
 * @param {number} timeout - Request timeout in ms
 * @returns {Promise<Object|null>} Package manifest or null
 */
function fetchNpmManifest(pkgName, timeout) {
  return new Promise((resolve) => {
    const req = https.request({
      hostname: 'registry.npmjs.org',
      path: `/${encodeURIComponent(pkgName)}/latest`,
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

const RISKY_HOOKS = ['preinstall', 'install', 'postinstall']

/**
 * Check if a package has lifecycle install scripts.
 *
 * @param {string} pkgName   - Package name
 * @param {string} ecosystem - Package ecosystem
 * @param {Object} config    - Gatepost configuration
 * @returns {Promise<Object|null>} Issue if scripts found, null otherwise
 */
async function check(pkgName, ecosystem, config) {
  if (!config.checks.scripts) return null
  if (ecosystem !== 'npm') return null

  const manifest = await fetchNpmManifest(pkgName, config.timeout)
  if (!manifest || !manifest.scripts) return null

  const found = RISKY_HOOKS.filter(hook => manifest.scripts[hook])
  if (found.length === 0) return null

  return {
    type: 'scripts',
    severity: config.scripts.action,
    message: `Has install scripts: ${found.join(', ')}`,
  }
}

module.exports = { check }
