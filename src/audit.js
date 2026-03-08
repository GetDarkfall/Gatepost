'use strict'

/**
 * Lockfile / manifest auditor.
 *
 * Reads dependency files (package.json, requirements.txt, Cargo.toml, etc.)
 * and runs all Gatepost checks against the listed packages.
 *
 * Supported files:
 *   - package.json        → npm ecosystem
 *   - requirements.txt    → PyPI ecosystem
 *   - Gemfile             → RubyGems ecosystem
 *   - Cargo.toml          → crates.io ecosystem
 *   - composer.json       → Packagist ecosystem
 *   - mix.exs             → Hex ecosystem
 *   - pubspec.yaml        → Pub ecosystem
 */

const fs = require('fs')
const path = require('path')

// ── Parsers ─────────────────────────────────────────────────────────

/**
 * Extract dependency names from a package.json file.
 */
function parsePackageJson(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const deps = Object.keys(raw.dependencies || {})
  const devDeps = Object.keys(raw.devDependencies || {})
  return { ecosystem: 'npm', packages: [...deps, ...devDeps] }
}

/**
 * Extract package names from a requirements.txt file.
 */
function parseRequirementsTxt(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  const packages = lines
    .map(l => l.trim())
    .filter(l => l && !l.startsWith('#') && !l.startsWith('-'))
    .map(l => l.replace(/[=<>!~^;@\[].*/, '').trim())
    .filter(Boolean)
  return { ecosystem: 'PyPI', packages }
}

/**
 * Extract gem names from a Gemfile.
 */
function parseGemfile(filePath) {
  const lines = fs.readFileSync(filePath, 'utf8').split('\n')
  const packages = lines
    .map(l => l.trim())
    .filter(l => l.startsWith('gem '))
    .map(l => {
      const match = l.match(/gem\s+['"]([^'"]+)['"]/)
      return match ? match[1] : null
    })
    .filter(Boolean)
  return { ecosystem: 'RubyGems', packages }
}

/**
 * Extract crate names from a Cargo.toml [dependencies] section.
 */
function parseCargoToml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const packages = []
  let inDeps = false
  for (const line of content.split('\n')) {
    const trimmed = line.trim()
    if (trimmed.match(/^\[.*dependencies.*\]$/)) {
      inDeps = true
      continue
    }
    if (trimmed.startsWith('[') && inDeps) {
      inDeps = false
      continue
    }
    if (inDeps && trimmed.includes('=')) {
      const name = trimmed.split('=')[0].trim()
      if (name) packages.push(name)
    }
  }
  return { ecosystem: 'crates.io', packages }
}

/**
 * Extract package names from a composer.json file.
 */
function parseComposerJson(filePath) {
  const raw = JSON.parse(fs.readFileSync(filePath, 'utf8'))
  const deps = Object.keys(raw.require || {}).filter(d => d.includes('/'))
  const devDeps = Object.keys(raw['require-dev'] || {}).filter(d => d.includes('/'))
  return { ecosystem: 'Packagist', packages: [...deps, ...devDeps] }
}

/**
 * Extract dependency names from a mix.exs file.
 */
function parseMixExs(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const packages = []
  const re = /\{:(\w+),/g
  let match
  while ((match = re.exec(content)) !== null) {
    packages.push(match[1])
  }
  return { ecosystem: 'Hex', packages }
}

/**
 * Extract dependency names from a pubspec.yaml file.
 */
function parsePubspecYaml(filePath) {
  const content = fs.readFileSync(filePath, 'utf8')
  const packages = []
  let inDeps = false
  for (const line of content.split('\n')) {
    if (line.match(/^(dependencies|dev_dependencies):/)) {
      inDeps = true
      continue
    }
    if (inDeps && line.match(/^\S/)) {
      inDeps = false
      continue
    }
    if (inDeps) {
      const match = line.match(/^\s{2}(\w[\w_-]*)/)
      if (match && match[1] !== 'sdk' && match[1] !== 'path' && match[1] !== 'git') {
        packages.push(match[1])
      }
    }
  }
  return { ecosystem: 'Pub', packages }
}

// ── File detection ──────────────────────────────────────────────────

const PARSERS = {
  'package.json':      parsePackageJson,
  'requirements.txt':  parseRequirementsTxt,
  'Gemfile':           parseGemfile,
  'Cargo.toml':        parseCargoToml,
  'composer.json':     parseComposerJson,
  'mix.exs':           parseMixExs,
  'pubspec.yaml':      parsePubspecYaml,
}

/**
 * Discover dependency files in the given directory.
 *
 * @param {string} dir - Directory to scan
 * @returns {Object[]} Array of { file, ecosystem, packages }
 */
function discoverFiles(dir) {
  const results = []
  for (const [filename, parser] of Object.entries(PARSERS)) {
    const filePath = path.join(dir, filename)
    if (fs.existsSync(filePath)) {
      try {
        const parsed = parser(filePath)
        if (parsed.packages.length > 0) {
          results.push({ file: filename, ...parsed })
        }
      } catch {
        // Skip files that can't be parsed
      }
    }
  }
  return results
}

module.exports = { discoverFiles, PARSERS }
