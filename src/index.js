#!/usr/bin/env node
'use strict'

const { spawnSync } = require('child_process')
const { checkPackages } = require('./check')
const { setup, remove } = require('./setup')

const MANAGERS = ['npm', 'npx', 'yarn', 'pnpm', 'pnpx', 'bun', 'bunx', 'pip', 'pip3', 'uv', 'poetry', 'pipx']

// Ecosystem per manager — used for OSV API queries
const ECOSYSTEMS = {
  npm: 'npm', npx: 'npm', yarn: 'npm', pnpm: 'npm', pnpx: 'npm',
  bun: 'npm', bunx: 'npm',
  pip: 'PyPI', pip3: 'PyPI', uv: 'PyPI', poetry: 'PyPI', pipx: 'PyPI',
}

// Subcommands that trigger a package install (null = the command itself is the package)
const INSTALL_SUBCMDS = {
  npm:    ['install', 'i', 'add', 'ci'],
  yarn:   ['add'],
  pnpm:   ['add', 'install', 'i'],
  npx:    null,
  pnpx:   null,
  bun:    ['add', 'install', 'i'],
  bunx:   null,
  pip:    ['install'],
  pip3:   ['install'],
  uv:     ['add', 'pip install'],  // handled specially below
  poetry: ['add'],
  pipx:   ['install', 'run'],
}

// ANSI colors
const c = {
  red:    s => `\x1b[31m${s}\x1b[0m`,
  yellow: s => `\x1b[33m${s}\x1b[0m`,
  green:  s => `\x1b[32m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
}

function printHelp() {
  console.log(`
${c.bold('gatepost')} — secure your package installs

${c.bold('Usage:')}
  gatepost setup              Install shell aliases (run once)
  gatepost remove             Remove shell aliases
  gatepost check <pkg...>     Manually check packages
  gatepost <manager> [args]   Run a package manager with protection

${c.bold('Examples:')}
  gatepost setup
  gatepost npm install lodash
  gatepost check express axios

${c.bold('Supported managers:')}
  npm, npx, yarn, pnpm, pnpx, bun, bunx
  pip, pip3, uv, poetry, pipx

After running ${c.bold('gatepost setup')}, your package managers are
automatically protected — no need to type "gatepost" each time.
`)
}

// Run the real package manager, stripping our shim dir from PATH to avoid recursion
function passThrough(manager, args) {
  const result = spawnSync(manager, args, {
    stdio: 'inherit',
    env: {
      ...process.env,
      // Remove ~/.gatepost from PATH if present (shim recursion guard)
      PATH: (process.env.PATH || '').split(':')
        .filter(p => !p.includes('.gatepost'))
        .join(':'),
    },
  })
  process.exit(result.status ?? 0)
}

// Extract package names from install args (skip flags and subcommand)
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

  // npm/yarn/pnpm/bun — skip subcommand, grab non-flag args
  const rest = args.slice(1)
  return rest.filter(a => !a.startsWith('-'))
}

// Strip Python version specifiers: requests==2.28.0 -> requests, flask[async] -> flask
function stripPythonVersion(arg) {
  return arg.replace(/[=<>!~^].*/,'').replace(/\[.*\]/, '').trim()
}

async function runWrapped(manager, args) {
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
  process.stderr.write(c.dim(`gatepost: checking ${pkgs.join(', ')}...\n`))

  let results
  try {
    results = await checkPackages(pkgs, ecosystem)
  } catch {
    // Network failure — warn and proceed
    process.stderr.write(c.yellow('gatepost: security check failed (network error), proceeding anyway\n'))
    return passThrough(manager, args)
  }

  const blocked = results.filter(r => r.issues.some(i => i.severity === 'block'))
  const warned  = results.filter(r => r.issues.some(i => i.severity === 'warn') && !blocked.find(b => b.pkg === r.pkg))

  if (blocked.length > 0) {
    console.error(c.red(c.bold('\ngatepost: install blocked\n')))
    for (const r of blocked) {
      for (const issue of r.issues) {
        console.error(`  ${c.red('blocked')}  ${c.bold(r.pkg)}  ${issue.message}`)
      }
    }
    console.error('')
    process.exit(1)
  }

  if (warned.length > 0) {
    console.error(c.yellow(c.bold('\ngatepost: warning\n')))
    for (const r of warned) {
      for (const issue of r.issues) {
        console.error(`  ${c.yellow('warn')}  ${c.bold(r.pkg)}  ${issue.message}`)
      }
    }
    console.error('')
  }

  passThrough(manager, args)
}

async function manualCheck(pkgs) {
  if (pkgs.length === 0) {
    console.error('Usage: gatepost check <package...>')
    process.exit(1)
  }

  console.log(c.dim(`Checking ${pkgs.length} package(s) against blocklist, typosquatting, and OSV database...\n`))

  const results = await checkPackages(pkgs)

  let allClear = true
  for (const r of results) {
    if (r.issues.length === 0) {
      console.log(`  ${c.green('ok')}      ${c.bold(r.pkg)}`)
    } else {
      allClear = false
      for (const issue of r.issues) {
        const label = issue.severity === 'block' ? c.red('blocked') : c.yellow('warn')
        console.log(`  ${label}  ${c.bold(r.pkg)}  ${issue.message}`)
      }
    }
  }

  if (allClear) {
    console.log(c.green('\nAll packages look clean.'))
  }
}

// --- CLI router ---
const args = process.argv.slice(2)
const command = args[0]

if (!command || command === '--help' || command === '-h') {
  printHelp()
} else if (command === 'setup') {
  setup()
} else if (command === 'remove' || command === 'uninstall') {
  remove()
} else if (command === 'check') {
  manualCheck(args.slice(1)).catch(err => {
    console.error('Error:', err.message)
    process.exit(1)
  })
} else if (MANAGERS.includes(command)) {
  runWrapped(command, args.slice(1)).catch(err => {
    console.error('gatepost error:', err.message)
    process.exit(1)
  })
} else {
  console.error(`Unknown command: ${command}`)
  printHelp()
  process.exit(1)
}
