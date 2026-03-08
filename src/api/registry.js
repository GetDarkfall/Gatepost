'use strict'

/**
 * Package registry API client.
 *
 * Fetches metadata from public package registries to determine
 * when a package was first published. Used by the age check to
 * flag suspiciously new packages.
 *
 * Supported registries:
 *   - npm        → registry.npmjs.org
 *   - PyPI       → pypi.org
 *   - RubyGems   → rubygems.org
 *   - crates.io  → crates.io
 *   - Packagist  → packagist.org
 *   - Hex        → hex.pm
 *   - Pub        → pub.dev
 */

const https = require('https')

// ── Registry endpoint config ─────────────────────────────────────────
const REGISTRY_URLS = {
  'npm':       (pkg) => ({ hostname: 'registry.npmjs.org', path: `/${encodeURIComponent(pkg)}` }),
  'PyPI':      (pkg) => ({ hostname: 'pypi.org', path: `/pypi/${encodeURIComponent(pkg)}/json` }),
  'RubyGems':  (pkg) => ({ hostname: 'rubygems.org', path: `/api/v1/gems/${encodeURIComponent(pkg)}.json` }),
  'crates.io': (pkg) => ({ hostname: 'crates.io', path: `/api/v1/crates/${encodeURIComponent(pkg)}` }),
  'Packagist': (pkg) => ({ hostname: 'repo.packagist.org', path: `/p2/${encodeURIComponent(pkg)}.json` }),
  'Hex':       (pkg) => ({ hostname: 'hex.pm', path: `/api/packages/${encodeURIComponent(pkg)}` }),
  'Pub':       (pkg) => ({ hostname: 'pub.dev', path: `/api/packages/${encodeURIComponent(pkg)}` }),
}

/**
 * Make a GET request and return the parsed JSON body.
 *
 * @param {Object} opts     - { hostname, path }
 * @param {number} timeout  - Request timeout in ms
 * @returns {Promise<Object|null>}
 */
function fetchJSON(opts, timeout) {
  return new Promise((resolve) => {
    const req = https.request({
      ...opts,
      method: 'GET',
      headers: { 'Accept': 'application/json', 'User-Agent': 'darkfall' },
      timeout,
    }, (res) => {
      // Follow one redirect (some registries 301/302)
      if (res.statusCode >= 300 && res.statusCode < 400 && res.headers.location) {
        try {
          const url = new URL(res.headers.location)
          return fetchJSON({ hostname: url.hostname, path: url.pathname + url.search }, timeout)
            .then(resolve)
        } catch { resolve(null) }
        return
      }
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

// ── Extractors: pull the creation date from each registry's response ─

/**
 * Extract the earliest publish date from a registry response.
 *
 * @param {string} ecosystem - Package ecosystem
 * @param {Object} json      - Parsed registry JSON response
 * @returns {Date|null}        Earliest publish date, or null if unknown
 */
function extractCreatedDate(ecosystem, json) {
  if (!json) return null

  try {
    switch (ecosystem) {
      case 'npm': {
        // npm returns { time: { created: '...', modified: '...', '1.0.0': '...' } }
        const created = json.time && json.time.created
        return created ? new Date(created) : null
      }
      case 'PyPI': {
        // PyPI returns { urls: [{ upload_time_iso_8601: '...' }] } for latest
        // or info.release_url for all versions
        const urls = json.urls
        if (urls && urls.length > 0 && urls[0].upload_time_iso_8601) {
          return new Date(urls[0].upload_time_iso_8601)
        }
        return null
      }
      case 'RubyGems': {
        // RubyGems returns { created_at: '...' }
        return json.created_at ? new Date(json.created_at) : null
      }
      case 'crates.io': {
        // crates.io returns { crate: { created_at: '...' } }
        const crate = json.crate
        return crate && crate.created_at ? new Date(crate.created_at) : null
      }
      case 'Packagist': {
        // Packagist v2 returns { packages: { 'vendor/pkg': [{ time: '...' }] } }
        const pkgs = json.packages
        if (!pkgs) return null
        const versions = Object.values(pkgs)[0]
        if (!versions || versions.length === 0) return null
        // Find the earliest time
        const times = versions.map(v => v.time).filter(Boolean).map(t => new Date(t))
        return times.length > 0 ? new Date(Math.min(...times)) : null
      }
      case 'Hex': {
        // Hex returns { inserted_at: '...' }
        return json.inserted_at ? new Date(json.inserted_at) : null
      }
      case 'Pub': {
        // Pub returns { versions: [{ published: '...' }] }
        const versions = json.versions
        if (!versions || versions.length === 0) return null
        return versions[0].published ? new Date(versions[0].published) : null
      }
      default:
        return null
    }
  } catch {
    return null
  }
}

/**
 * Get the creation/first-publish date for a package.
 *
 * @param {string} pkgName    - Package name
 * @param {string} ecosystem  - Package ecosystem
 * @param {number} timeout    - Request timeout in ms
 * @returns {Promise<Date|null>}
 */
async function getPackageAge(pkgName, ecosystem = 'npm', timeout = 5000) {
  const urlBuilder = REGISTRY_URLS[ecosystem]
  if (!urlBuilder) return null

  const opts = urlBuilder(pkgName)
  const json = await fetchJSON(opts, timeout)
  return extractCreatedDate(ecosystem, json)
}

module.exports = { getPackageAge }
