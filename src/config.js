'use strict'

/**
 * Configuration loader for Darkfall.
 *
 * Reads settings from ~/.darkfallrc (JSON) and merges with defaults.
 * Users can toggle individual checks, adjust thresholds, and add
 * custom blocklist entries without touching source code.
 *
 * Config file location: ~/.darkfallrc
 *
 * Example .darkfallrc:
 * {
 *   "checks": {
 *     "blocklist": true,
 *     "typosquat": true,
 *     "vulnerability": true,
 *     "age": true
 *   },
 *   "age": {
 *     "minimumDays": 1,
 *     "action": "warn"
 *   },
 *   "typosquat": {
 *     "maxDistance": 2,
 *     "action": "warn"
 *   },
 *   "blocklist": {
 *     "action": "block",
 *     "custom": []
 *   },
 *   "vulnerability": {
 *     "action": "warn"
 *   },
 *   "allowlist": [],
 *   "timeout": 5000,
 *   "failOpen": true
 * }
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

// ── Default configuration ────────────────────────────────────────────
const DEFAULTS = {
  // Toggle individual checks on/off
  checks: {
    blocklist: true,
    typosquat: true,
    vulnerability: true,
    age: true,
  },

  // Package age check — flag packages published less than N days ago
  age: {
    minimumDays: 1,       // packages younger than this are flagged
    action: 'warn',       // 'warn' or 'block'
  },

  // Typosquat detection via Levenshtein distance
  typosquat: {
    maxDistance: 2,        // max edit distance to flag as a typosquat
    action: 'warn',       // 'warn' or 'block'
  },

  // Hard blocklist of known malicious packages
  blocklist: {
    action: 'block',      // 'warn' or 'block'
    custom: [],           // additional package names to block
  },

  // OSV vulnerability database check
  vulnerability: {
    action: 'warn',       // 'warn' or 'block'
  },

  // Packages that skip ALL checks (exact name match)
  allowlist: [],

  // Network timeout in milliseconds for API calls
  timeout: 5000,

  // If true, proceed with install when network checks fail
  // If false, block install when checks can't be completed
  failOpen: true,

  // Logging level: 'silent', 'normal', or 'verbose'
  logLevel: 'normal',
}

// ── Config file path ─────────────────────────────────────────────────
const CONFIG_PATH = path.join(os.homedir(), '.darkfallrc')

/**
 * Deep-merge two objects. Source values override target values.
 * Only merges plain objects — arrays and primitives are replaced.
 */
function deepMerge(target, source) {
  const result = { ...target }
  for (const key of Object.keys(source)) {
    if (
      source[key] && typeof source[key] === 'object' && !Array.isArray(source[key]) &&
      target[key] && typeof target[key] === 'object' && !Array.isArray(target[key])
    ) {
      result[key] = deepMerge(target[key], source[key])
    } else {
      result[key] = source[key]
    }
  }
  return result
}

/**
 * Load configuration from ~/.darkfallrc and merge with defaults.
 * Returns defaults silently if the config file doesn't exist or is invalid.
 */
function loadConfig() {
  try {
    if (!fs.existsSync(CONFIG_PATH)) return { ...DEFAULTS }
    const raw = fs.readFileSync(CONFIG_PATH, 'utf8')
    const user = JSON.parse(raw)
    return deepMerge(DEFAULTS, user)
  } catch {
    // Malformed JSON or read error — fall back to defaults
    return { ...DEFAULTS }
  }
}

/**
 * Write a default .darkfallrc to the user's home directory.
 * Used by `darkfall init` to scaffold the config file.
 */
function writeDefaultConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    return { created: false, path: CONFIG_PATH }
  }
  fs.writeFileSync(CONFIG_PATH, JSON.stringify(DEFAULTS, null, 2) + '\n')
  return { created: true, path: CONFIG_PATH }
}

module.exports = { loadConfig, writeDefaultConfig, CONFIG_PATH, DEFAULTS }
