'use strict'

/**
 * Package manager runner.
 *
 * Wraps any supported package manager: intercepts install commands,
 * runs security checks, then either blocks or passes through to
 * the real binary.
 */

const { spawnSync } = require('child_process')
const log = require('./utils/logger')
const { c } = require('./utils/colors')

// ── Supported managers and their ecosystems ──────────────────────────

const MANAGERS = [
  'npm', 'npx', 'yarn', 'pnpm', 'pnpx', 'bun', 'bunx',
  'pip', 'pip3', 'uv', 'poetry', 'pipx',
  'gem', 'cargo', 'composer', 'mix', 'pub',
  'python', 'python3',
]

const ECOSYSTEMS = {
  npm: 'npm', npx: 'npm', yarn: 'npm', pnpm: 'npm', pnpx: 'npm',
  bun: 'npm', bunx: 'npm',
  pip: 'PyPI', pip3: 'PyPI', uv: 'PyPI', poetry: 'PyPI', pipx: 'PyPI',
  python: 'PyPI', python3: 'PyPI',
  gem: 'RubyGems',
  cargo: 'crates.io',
  composer: 'Packagist',
  mix: 'Hex',
  pub: 'Pub',
}

// Subcommands that trigger a package install (null = the command itself is the package)
const INSTALL_SUBCMDS = {
  npm:      ['install', 'i', 'add', 'ci'],
  yarn:     ['add'],
  pnpm:     ['add', 'install', 'i'],
  npx:      null,
  pnpx:     null,
  bun:      ['add', 'install', 'i'],
  bunx:     null,
  pip:      ['install'],
  pip3:     ['install'],
  uv:       ['add', 'pip install'],
  poetry:   ['add'],
  pipx:     ['install', 'run'],
  gem:      ['install'],
  cargo:    ['add', 'install'],
  composer: ['require'],
  mix:      ['deps.get'],
  pub:      ['add', 'get'],
  python:   ['-m pip install', '-m pip'],
  python3:  ['-m pip install', '-m pip'],
}

// ── Helpers ──────────────────────────────────────────────────────────

/**
 * Strip Python version specifiers from an argument.
 * e.g. requests==2.28.0 → requests, flask[async] → flask
 */
function stripPythonVersion(arg) {
  return arg.replace(/[=<>!~^].*/, '').replace(/\[.*\]/, '').trim()
}

/**
 * Extract package names from the raw CLI arguments.
 * Skips flags, subcommands, and non-package arguments.
 *
 * @param {string}   manager - Package manager name
 * @param {string[]} args    - Raw CLI arguments after the manager name
 * @returns {string[]} Array of package names
 */
function extractPackages(manager, args) {
  // Single-package executors — first non-flag arg is the package
  if (['npx', 'pnpx', 'bunx'].includes(manager)) {
    const pkg = args.find(a => !a.startsWith('-'))
    return pkg ? [pkg] : []
  }

  // python -m pip install pkg → extract packages after 'install'
  if (['python', 'python3'].includes(manager)) {
    const mIdx = args.indexOf('-m')
    if (mIdx === -1) return []
    const pipIdx = mIdx + 1
    if (args[pipIdx] !== 'pip') return []
    const installIdx = args.indexOf('install', pipIdx)
    if (installIdx === -1) return []
    const rest = args.slice(installIdx + 1)
    return rest.filter(a => !a.startsWith('-')).map(stripPythonVersion)
  }

  // uv has two install forms: `uv add pkg` and `uv pip install pkg`
  if (manager === 'uv') {
    const rest = args[0] === 'pip' ? args.slice(2) : args.slice(1)
    return rest.filter(a => !a.startsWith('-')).map(stripPythonVersion)
  }

  // pip/pip3/poetry/pipx — skip subcommand, grab non-flag args
  if (['pip', 'pip3', 'poetry', 'pipx'].includes(manager)) {
    const rest = args.slice(1)
    return rest.filter(a => !a.startsWith('-')).map(stripPythonVersion)
  }

  // gem/cargo/composer/pub — skip subcommand, grab non-flag args
  if (['gem', 'cargo', 'composer', 'pub'].includes(manager)) {
    const rest = args.slice(1)
    return rest.filter(a => !a.startsWith('-'))
  }

  // mix deps.get has no explicit packages — pass through
  if (manager === 'mix') {
    return []
  }

  // npm/yarn/pnpm/bun — skip subcommand, grab non-flag args
  const rest = args.slice(1)
  return rest.filter(a => !a.startsWith('-'))
}

/**
 * Pass through to the real package manager binary.
 * Strips the .gatepost shim directory from PATH to prevent recursion.
 *
 * @param {string}   manager - Package manager name
 * @param {string[]} args    - Arguments to forward
 */
function passThrough(manager, args) {
  const result = spawnSync(manager, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      PATH: (process.env.PATH || '').split(':')
        .filter(p => !p.includes('.gatepost'))
        .join(':'),
    },
  })
  process.exit(result.status ?? 0)
}

/**
 * Run a package manager with Gatepost security checks.
 *
 * Flow:
 *   1. Determine if this is an install command
 *   2. Extract package names from the arguments
 *   3. Run all enabled checks in parallel
 *   4. Block if any check returns severity 'block'
 *   5. Warn if any check returns severity 'warn'
 *   6. Pass through to the real manager
 *
 * @param {string}   manager      - Package manager name
 * @param {string[]} args         - CLI arguments after the manager name
 * @param {Function} checkPackages - Check function from checks/index.js
 * @param {Object}   config       - Gatepost configuration
 */
async function runWrapped(manager, args, checkPackages, config) {
  // python/python3 — only intercept `-m pip install`, pass everything else through
  if (['python', 'python3'].includes(manager)) {
    const joined = args.join(' ')
    if (!joined.includes('-m pip') && !joined.includes('-m pip install')) {
      return passThrough(manager, args)
    }
    if (!args.includes('install')) {
      return passThrough(manager, args)
    }
  }

  const installSubcmds = INSTALL_SUBCMDS[manager]
  const subCmd = args[0]

  // Not an install command — pass straight through
  if (!['python', 'python3'].includes(manager)) {
    const isInstall = installSubcmds === null
      ? true
      : installSubcmds.includes(subCmd)

    if (!isInstall) {
      return passThrough(manager, args)
    }
  }

  const pkgs = extractPackages(manager, args)

  // No explicit packages — installing from lockfile, pass through
  if (pkgs.length === 0) {
    return passThrough(manager, args)
  }

  const ecosystem = ECOSYSTEMS[manager] || 'npm'
  log.info(c.dim(`gatepost: checking ${pkgs.join(', ')}...\n`))
  log.verbose(c.dim(`gatepost: ecosystem=${ecosystem}, manager=${manager}, packages=[${pkgs.join(', ')}]\n`))

  let results
  try {
    results = await checkPackages(pkgs, ecosystem, config)
  } catch {
    // Network failure — warn and proceed (or block if failOpen is false)
    if (config.failOpen) {
      log.warn(c.orange('gatepost: security check failed (network error), proceeding anyway\n'))
      return passThrough(manager, args)
    } else {
      log.error(c.red('gatepost: security check failed (network error), blocking install\n'))
      process.exit(1)
    }
  }

  const blocked = results.filter(r => r.issues.some(i => i.severity === 'block'))
  const warned = results.filter(r =>
    r.issues.some(i => i.severity === 'warn') && !blocked.find(b => b.pkg === r.pkg)
  )

  if (blocked.length > 0) {
    log.error(c.purple(c.bold('\ngatepost: install blocked\n')))
    for (const r of blocked) {
      for (const issue of r.issues) {
        log.error(`  ${c.red('blocked')}  ${c.bold(r.pkg)}  ${issue.message}\n`)
      }
    }
    log.error('\n')
    process.exit(1)
  }

  if (warned.length > 0) {
    log.warn(c.orange(c.bold('\ngatepost: warning\n')))
    for (const r of warned) {
      for (const issue of r.issues) {
        log.warn(`  ${c.orange('warn')}  ${c.bold(r.pkg)}  ${issue.message}\n`)
      }
    }
    log.warn('\n')
  }

  log.verbose(c.dim(`gatepost: all checks passed, forwarding to ${manager}\n`))
  passThrough(manager, args)
}

module.exports = { runWrapped, passThrough, MANAGERS, ECOSYSTEMS }
