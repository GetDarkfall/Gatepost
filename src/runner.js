'use strict'

/**
 * Package manager runner.
 *
 * Wraps any supported package manager: intercepts install commands,
 * runs security checks, then either blocks or passes through to
 * the real binary.
 */

const { spawnSync } = require('child_process')

// ── Supported managers and their ecosystems ──────────────────────────

const MANAGERS = [
  'npm', 'npx', 'yarn', 'pnpm', 'pnpx', 'bun', 'bunx',
  'pip', 'pip3', 'uv', 'poetry', 'pipx',
  'gem', 'cargo', 'composer', 'mix', 'pub',
]

const ECOSYSTEMS = {
  npm: 'npm', npx: 'npm', yarn: 'npm', pnpm: 'npm', pnpx: 'npm',
  bun: 'npm', bunx: 'npm',
  pip: 'PyPI', pip3: 'PyPI', uv: 'PyPI', poetry: 'PyPI', pipx: 'PyPI',
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
}

// ── ANSI colors ──────────────────────────────────────────────────────

const c = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  purple: s => `\x1b[35m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
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
 * Strips the .darkfall shim directory from PATH to prevent recursion.
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
        .filter(p => !p.includes('.darkfall'))
        .join(':'),
    },
  })
  process.exit(result.status ?? 0)
}

/**
 * Run a package manager with Darkfall security checks.
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
 * @param {Object}   config       - Darkfall configuration
 */
async function runWrapped(manager, args, checkPackages, config) {
  const installSubcmds = INSTALL_SUBCMDS[manager]
  const subCmd = args[0]

  // Not an install command — pass straight through
  const isInstall = installSubcmds === null
    ? true
    : installSubcmds.includes(subCmd)

  if (!isInstall) {
    return passThrough(manager, args)
  }

  const pkgs = extractPackages(manager, args)

  // No explicit packages — installing from lockfile, pass through
  if (pkgs.length === 0) {
    return passThrough(manager, args)
  }

  const ecosystem = ECOSYSTEMS[manager] || 'npm'
  process.stderr.write(c.dim(`darkfall: checking ${pkgs.join(', ')}...\n`))

  let results
  try {
    results = await checkPackages(pkgs, ecosystem, config)
  } catch {
    // Network failure — warn and proceed (or block if failOpen is false)
    if (config.failOpen) {
      process.stderr.write(c.purple('darkfall: security check failed (network error), proceeding anyway\n'))
      return passThrough(manager, args)
    } else {
      process.stderr.write(c.red('darkfall: security check failed (network error), blocking install\n'))
      process.exit(1)
    }
  }

  const blocked = results.filter(r => r.issues.some(i => i.severity === 'block'))
  const warned = results.filter(r =>
    r.issues.some(i => i.severity === 'warn') && !blocked.find(b => b.pkg === r.pkg)
  )

  if (blocked.length > 0) {
    console.error(c.purple(c.bold('\ndarkfall: install blocked\n')))
    for (const r of blocked) {
      for (const issue of r.issues) {
        console.error(`  ${c.red('blocked')}  ${c.bold(r.pkg)}  ${issue.message}`)
      }
    }
    console.error('')
    process.exit(1)
  }

  if (warned.length > 0) {
    console.error(c.purple(c.bold('\ndarkfall: warning\n')))
    for (const r of warned) {
      for (const issue of r.issues) {
        console.error(`  ${c.purple('warn')}  ${c.bold(r.pkg)}  ${issue.message}`)
      }
    }
    console.error('')
  }

  passThrough(manager, args)
}

module.exports = { runWrapped, passThrough, MANAGERS, ECOSYSTEMS, c }
