'use strict'

/**
 * OSV.dev API client.
 *
 * Queries the Open Source Vulnerability database (https://osv.dev)
 * for known CVEs and security advisories against a given package.
 *
 * The only data sent is the package name and ecosystem — no user
 * data, credentials, or system information leaves the machine.
 */

const https = require('https')

/**
 * Query the OSV.dev API for known vulnerabilities.
 *
 * @param {string} pkgName    - Package name to query (e.g. 'lodash')
 * @param {string} ecosystem  - Package ecosystem (e.g. 'npm', 'PyPI', 'crates.io')
 * @param {number} timeout    - Request timeout in milliseconds
 * @returns {Promise<Object[]|null>} Array of vulnerability objects, or null if clean/error
 */
function query(pkgName, ecosystem = 'npm', timeout = 5000) {
  return new Promise((resolve) => {
    const body = JSON.stringify({
      package: { name: pkgName, ecosystem },
    })

    const req = https.request({
      hostname: 'api.osv.dev',
      path: '/v1/query',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
      timeout,
    }, (res) => {
      let data = ''
      res.on('data', chunk => { data += chunk })
      res.on('end', () => {
        try {
          const json = JSON.parse(data)
          resolve(json.vulns && json.vulns.length > 0 ? json.vulns : null)
        } catch {
          resolve(null)
        }
      })
    })

    req.on('error', () => resolve(null))
    req.on('timeout', () => { req.destroy(); resolve(null) })
    req.write(body)
    req.end()
  })
}

module.exports = { query }
