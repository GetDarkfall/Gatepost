'use strict'

/**
 * Shell alias setup and removal.
 *
 * Installs shell aliases so every package manager command is
 * automatically routed through Darkfall. Supports:
 *   - Zsh    (~/.zshrc)
 *   - Bash   (~/.bashrc, ~/.bash_profile, ~/.profile)
 *   - Fish   (~/.config/fish/config.fish)
 *   - Ksh    (~/.kshrc)
 *   - Tcsh   (~/.tcshrc, ~/.cshrc)
 */

const fs = require('fs')
const path = require('path')
const os = require('os')

const MANAGERS = [
  'npm', 'npx', 'yarn', 'pnpm', 'pnpx', 'bun', 'bunx',
  'pip', 'pip3', 'uv', 'poetry', 'pipx',
  'gem', 'cargo', 'composer', 'mix', 'pub',
]

const MARKER_START = '# darkfall-start'
const MARKER_END = '# darkfall-end'

// ── Alias block builders ─────────────────────────────────────────────

/**
 * Build alias block for POSIX-compatible shells (zsh, bash, ksh).
 * Uses standard `alias name='command'` syntax.
 */
function buildPosixBlock() {
  const aliases = MANAGERS.map(m => `alias ${m}='darkfall ${m}'`).join('\n')
  return `\n${MARKER_START}\n${aliases}\n${MARKER_END}\n`
}

/**
 * Build alias block for Fish shell.
 * Fish uses `alias name 'command'` without the equals sign,
 * and functions need `$argv` to pass arguments.
 */
function buildFishBlock() {
  const functions = MANAGERS.map(m =>
    `function ${m} --wraps='${m}' --description 'darkfall-wrapped ${m}'; darkfall ${m} $argv; end`
  ).join('\n')
  return `\n${MARKER_START}\n${functions}\n${MARKER_END}\n`
}

/**
 * Build alias block for C-shell family (tcsh, csh).
 * Uses `alias name 'command'` syntax.
 */
function buildCshBlock() {
  const aliases = MANAGERS.map(m => `alias ${m} 'darkfall ${m}'`).join('\n')
  return `\n${MARKER_START}\n${aliases}\n${MARKER_END}\n`
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
  ]
  return configs.filter(c => fs.existsSync(c.path))
}

/**
 * Get the alias block for a given shell type.
 */
function getBlockForType(type) {
  switch (type) {
    case 'fish': return buildFishBlock()
    case 'csh':  return buildCshBlock()
    default:     return buildPosixBlock()
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
    tty.write('\n\x1b[35;1mDarkfall\x1b[0m \x1b[90mhas been installed\x1b[0m \x1b[92msuccessfully\x1b[0m\n\n')
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

  if (removed === 0) {
    console.log('No Darkfall aliases found to remove.')
  } else {
    console.log('\nDarkfall removed. Restart your terminal to apply.')
  }
}

module.exports = { setup, remove }
