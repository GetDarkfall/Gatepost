'use strict'

/**
 * Shell alias setup and removal.
 *
 * Installs shell aliases so every package manager command is
 * automatically routed through Gatepost. Supports:
 *   - Zsh    (~/.zshrc)
 *   - Bash   (~/.bashrc, ~/.bash_profile, ~/.profile)
 *   - Fish   (~/.config/fish/config.fish)
 *   - Ksh    (~/.kshrc)
 *   - Tcsh   (~/.tcshrc, ~/.cshrc)
 *   - PowerShell      (~/.config/powershell/Microsoft.PowerShell_profile.ps1)
 *   - PowerShell Core (Documents/PowerShell/Microsoft.PowerShell_profile.ps1)
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const MANAGERS = [
  'npm', 'npx', 'yarn', 'pnpm', 'pnpx', 'bun', 'bunx',
  'pip', 'pip3', 'uv', 'poetry', 'pipx',
  'gem', 'cargo', 'composer', 'mix', 'pub',
  'python', 'python3',
]

const SHIM_DIR = path.join(os.homedir(), '.gatepost', 'bin')

const MARKER_START = '# gatepost-start'
const MARKER_END = '# gatepost-end'

// ── Alias block builders ─────────────────────────────────────────────

// Managers that get simple aliases (everything except python/python3)
const ALIAS_MANAGERS = MANAGERS.filter(m => m !== 'python' && m !== 'python3')

/**
 * Build alias block for POSIX-compatible shells (zsh, bash, ksh).
 * Uses standard aliases for package managers, and a wrapper function
 * for python/python3 that only intercepts `-m pip` invocations.
 */
function buildPosixBlock() {
  const aliases = ALIAS_MANAGERS.map(m => `alias ${m}='gatepost ${m}'`).join('\n')
  const pythonFn = `
python() { case "$1" in -m) case "$2" in pip|pip3) gatepost python "$@"; return;; esac;; esac; command python "$@"; }
python3() { case "$1" in -m) case "$2" in pip|pip3) gatepost python3 "$@"; return;; esac;; esac; command python3 "$@"; }`
  return `\n${MARKER_START}\n${aliases}${pythonFn}\n${MARKER_END}\n`
}

/**
 * Build alias block for Fish shell.
 * Fish uses function syntax with $argv to pass arguments.
 */
function buildFishBlock() {
  const functions = ALIAS_MANAGERS.map(m =>
    `function ${m} --wraps='${m}' --description 'gatepost-wrapped ${m}'; gatepost ${m} $argv; end`
  ).join('\n')
  const pythonFn = `
function python --wraps='python' --description 'gatepost-wrapped python'; if test "$argv[1]" = "-m"; and contains -- "$argv[2]" pip pip3; gatepost python $argv; else; command python $argv; end; end
function python3 --wraps='python3' --description 'gatepost-wrapped python3'; if test "$argv[1]" = "-m"; and contains -- "$argv[2]" pip pip3; gatepost python3 $argv; else; command python3 $argv; end; end`
  return `\n${MARKER_START}\n${functions}${pythonFn}\n${MARKER_END}\n`
}

/**
 * Build alias block for C-shell family (tcsh, csh).
 * Uses `alias name 'command'` syntax.
 * Note: csh can't do conditional aliases easily, so python -m pip
 * is not intercepted in csh — users can run `gatepost python -m pip` directly.
 */
function buildCshBlock() {
  const aliases = ALIAS_MANAGERS.map(m => `alias ${m} 'gatepost ${m}'`).join('\n')
  return `\n${MARKER_START}\n${aliases}\n${MARKER_END}\n`
}

/**
 * Build alias block for PowerShell / PowerShell Core.
 * Uses functions that forward to `gatepost <manager>`.
 * Python/python3 get conditional wrappers for `-m pip`.
 */
function buildPowerShellBlock() {
  const functions = ALIAS_MANAGERS.map(m =>
    `function ${m} { gatepost ${m} @args }`
  ).join('\n')
  const pythonFn = `
function python { if ($args[0] -eq '-m' -and ($args[1] -eq 'pip' -or $args[1] -eq 'pip3')) { gatepost python @args } else { & (Get-Command python -CommandType Application | Select-Object -First 1).Source @args } }
function python3 { if ($args[0] -eq '-m' -and ($args[1] -eq 'pip' -or $args[1] -eq 'pip3')) { gatepost python3 @args } else { & (Get-Command python3 -CommandType Application | Select-Object -First 1).Source @args } }`
  return `\n${MARKER_START}\n${functions}${pythonFn}\n${MARKER_END}\n`
}

// ── Shell config discovery ───────────────────────────────────────────

/**
 * Discover all shell config files on the system.
 * Returns objects with { path, type } where type determines
 * which alias syntax to use.
 */
function getShellConfigs() {
  const home = os.homedir()
  const configs = [
    // POSIX shells (zsh, bash, ksh)
    { path: path.join(home, '.zshrc'),          type: 'posix' },
    { path: path.join(home, '.bashrc'),         type: 'posix' },
    { path: path.join(home, '.bash_profile'),   type: 'posix' },
    { path: path.join(home, '.profile'),        type: 'posix' },
    { path: path.join(home, '.kshrc'),          type: 'posix' },
    // Fish
    { path: path.join(home, '.config', 'fish', 'config.fish'), type: 'fish' },
    // C-shell family
    { path: path.join(home, '.tcshrc'),         type: 'csh' },
    { path: path.join(home, '.cshrc'),          type: 'csh' },
    // PowerShell Core (cross-platform)
    { path: path.join(home, '.config', 'powershell', 'Microsoft.PowerShell_profile.ps1'), type: 'powershell' },
    // PowerShell (Windows)
    { path: path.join(home, 'Documents', 'PowerShell', 'Microsoft.PowerShell_profile.ps1'), type: 'powershell' },
    // Windows PowerShell (legacy)
    { path: path.join(home, 'Documents', 'WindowsPowerShell', 'Microsoft.PowerShell_profile.ps1'), type: 'powershell' },
  ]
  return configs.filter(c => fs.existsSync(c.path))
}

/**
 * Get the alias block for a given shell type.
 */
function getBlockForType(type) {
  switch (type) {
    case 'fish':       return buildFishBlock()
    case 'csh':        return buildCshBlock()
    case 'powershell': return buildPowerShellBlock()
    default:           return buildPosixBlock()
  }
}

// ── Setup ────────────────────────────────────────────────────────────

function setup() {
  const configs = getShellConfigs()

  if (configs.length === 0) {
    console.log('No shell config file found. Add these aliases manually:\n')
    console.log(buildPosixBlock())
    return
  }

  let updated = 0
  for (const config of configs) {
    try {
      const contents = fs.readFileSync(config.path, 'utf8')
      if (contents.includes(MARKER_START)) {
        console.log(`  Already configured: ${config.path}`)
        continue
      }
      const block = getBlockForType(config.type)
      fs.appendFileSync(config.path, block)
      console.log(`  Updated: ${config.path}`)
      updated++
    } catch (e) {
      // Skip files we can't read or write (permissions, etc.)
    }
  }

  try {
    const tty = fs.createWriteStream('/dev/tty')
    tty.write('\x1b[2J\x1b[H')
    tty.write('\n\x1b[1;38;5;216mGatepost\x1b[0m \x1b[90mhas been installed\x1b[0m \x1b[92msuccessfully\x1b[0m\n\n')
    tty.write('\x1b[90mRun \x1b[1mgatepost init\x1b[0m\x1b[90m to configure your settings\x1b[0m\n')
    tty.write('\x1b[90mRestart your terminal or run: source ~/.zshrc\x1b[0m\n')
    tty.end()
  } catch (e) {
    // Not a TTY (e.g. CI environment) — skip
  }
}

// ── Remove ───────────────────────────────────────────────────────────

function remove() {
  const configs = getShellConfigs()
  const re = new RegExp(`\\n${MARKER_START}[\\s\\S]*?${MARKER_END}\\n`, 'g')

  let removed = 0
  for (const config of configs) {
    try {
      const contents = fs.readFileSync(config.path, 'utf8')
      if (!contents.includes(MARKER_START)) continue
      fs.writeFileSync(config.path, contents.replace(re, '\n'))
      console.log(`  Removed aliases from: ${config.path}`)
      removed++
    } catch (e) {
      // Skip files we can't read or write
    }
  }

  // Also remove CI shims if present
  if (fs.existsSync(SHIM_DIR)) {
    fs.rmSync(SHIM_DIR, { recursive: true })
    console.log(`  Removed CI shims from: ${SHIM_DIR}`)
    removed++
  }

  if (removed === 0) {
    console.log('No Gatepost aliases found to remove.')
  } else {
    console.log('\nGatepost removed. Restart your terminal to apply.')
  }
}

// ── CI/CD shim setup ────────────────────────────────────────────────

/**
 * Create executable shims in ~/.gatepost/bin for CI/CD environments.
 * Each shim is a tiny shell script that forwards to `gatepost <manager>`.
 * Add ~/.gatepost/bin to the front of PATH in your CI config.
 */
function setupCi() {
  fs.mkdirSync(SHIM_DIR, { recursive: true })

  let created = 0
  for (const manager of MANAGERS) {
    const shimPath = path.join(SHIM_DIR, manager)
    const script = `#!/bin/sh\nexec gatepost ${manager} "$@"\n`
    fs.writeFileSync(shimPath, script, { mode: 0o755 })
    created++
  }

  console.log(`Created ${created} shims in ${SHIM_DIR}`)
  console.log(`\nAdd this to your CI config:`)
  console.log(`  export PATH="${SHIM_DIR}:$PATH"`)
}

/**
 * Remove CI shims directory.
 */
function removeCi() {
  if (fs.existsSync(SHIM_DIR)) {
    fs.rmSync(SHIM_DIR, { recursive: true })
    console.log(`Removed shims from ${SHIM_DIR}`)
  }
}

module.exports = { setup, remove, setupCi, removeCi }
