'use strict'

const https = require('https')
const { BLOCKLIST } = require('./blocklist')
const { POPULAR_PACKAGES } = require('./typosquat')

// Levenshtein distance — measures edit distance between two strings
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

// Parse the canonical package name from an install arg
// Handles: lodash, lodash@4.x, @types/node, @types/node@18.0.0
function parsePkgName(arg) {
  if (arg.startsWith('@')) {
    const match = arg.match(/^(@[^/]+\/[^@]+)/)
    return match ? match[1] : null
  }
  const name = arg.split('@')[0]
  return name || null
}

// Skip non-package args (URLs, file paths, git refs)
function isPackageName(arg) {
  if (!arg || arg.startsWith('-')) return false
  if (arg.startsWith('git+') || arg.startsWith('github:') ||
      arg.startsWith('gitlab:') || arg.startsWith('bitbucket:') ||
      arg.startsWith('file:') || arg.startsWith('http') ||
      arg.startsWith('.') || arg.startsWith('/')) return false
  return true
}

// Check for typosquatting against popular packages
function checkTyposquat(pkgName, ecosystem = 'npm') {
  const { POPULAR_PYTHON_PACKAGES } = require('./typosquat')
  const pool = ecosystem === 'PyPI' ? POPULAR_PYTHON_PACKAGES : POPULAR_PACKAGES

  // Use the local name for scoped npm packages: @types/node -> node
  const localName = pkgName.startsWith('@')
    ? pkgName.split('/')[1] || ''
    : pkgName

  const lower = localName.toLowerCase()
  if (lower.length < 4) return null

  for (const popular of pool) {
    if (lower === popular.toLowerCase()) return null // exact match, not a typosquat
    const dist = levenshtein(lower, popular.toLowerCase())
    if (dist >= 1 && dist <= 2) return popular
  }
  return null
}

// Query the OSV.dev API for known vulnerabilities
function queryOSV(pkgName, ecosystem = 'npm') {
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
      timeout: 5000,
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

// Check a single package — returns { pkg, issues[] }
async function checkPackage(arg, ecosystem = 'npm') {
  const pkgName = ecosystem === 'npm' ? parsePkgName(arg) : arg.trim()
  if (!pkgName) return { pkg: arg, issues: [] }

  const issues = []

  // 1. Hard blocklist
  if (BLOCKLIST.has(pkgName)) {
    issues.push({ type: 'blocklist', severity: 'block', message: 'Known malicious package' })
  }

  // 2. Typosquatting
  const similar = checkTyposquat(pkgName, ecosystem)
  if (similar) {
    issues.push({ type: 'typosquat', severity: 'warn', message: `Possible typosquat of "${similar}"` })
  }

  // 3. OSV vulnerability database
  const vulns = await queryOSV(pkgName, ecosystem)
  if (vulns) {
    const count = vulns.length
    issues.push({
      type: 'vuln',
      severity: 'warn',
      message: `${count} known vulnerabilit${count === 1 ? 'y' : 'ies'} found in OSV database`,
      vulns,
    })
  }

  return { pkg: pkgName, issues }
}

// Check multiple packages in parallel
async function checkPackages(args, ecosystem = 'npm') {
  const packageArgs = args.filter(isPackageName)
  if (packageArgs.length === 0) return []
  return Promise.all(packageArgs.map(a => checkPackage(a, ecosystem)))
}

module.exports = { checkPackages, parsePkgName, isPackageName }
