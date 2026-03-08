'use strict'

/**
 * CLI router and help output.
 *
 * Parses process.argv and dispatches to the appropriate handler:
 *   - setup / remove: alias management
 *   - init: scaffold a .darkfallrc config file
 *   - check: manual package check
 *   - <manager>: wrapped package manager
 */

const { setup, remove } = require('./setup')
const { runWrapped, MANAGERS, c } = require('./runner')
const { checkPackages } = require('./checks')
const { loadConfig, writeDefaultConfig, CONFIG_PATH } = require('./config')

// ── Help text ────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
${c.bold('darkfall')} — secure your package installs

${c.bold('Usage:')}
  darkfall setup              Install shell aliases (run once)
  darkfall remove             Remove shell aliases
  darkfall init               Create a .darkfallrc config file
  darkfall check <pkg...>     Manually check packages
  darkfall <manager> [args]   Run a package manager with protection

${c.bold('Examples:')}
  darkfall setup
  darkfall npm install lodash
  darkfall check express axios
  darkfall init

${c.bold('Supported managers:')}
  npm, npx, yarn, pnpm, pnpx, bun, bunx
  pip, pip3, uv, poetry, pipx
  gem, cargo, composer, mix, pub

${c.bold('Configuration:')}
  Run ${c.bold('darkfall init')} to create ~/.darkfallrc
  Edit it to toggle checks, adjust thresholds, and add custom blocklist entries.

After running ${c.bold('darkfall setup')}, your package managers are
automatically protected — no need to type "darkfall" each time.
`)
}

// ── Manual check command ─────────────────────────────────────────────

async function manualCheck(pkgs, config) {
  if (pkgs.length === 0) {
    console.error('Usage: darkfall check <package...>')
    process.exit(1)
  }

  console.log(c.dim(`Checking ${pkgs.length} package(s) against blocklist, typosquatting, OSV, and age...\n`))

  const results = await checkPackages(pkgs, 'npm', config)

  let allClear = true
  for (const r of results) {
    if (r.issues.length === 0) {
      console.log(`  ${c.green('ok')}      ${c.bold(r.pkg)}`)
    } else {
      allClear = false
      for (const issue of r.issues) {
        const label = issue.severity === 'block' ? c.red('blocked') : c.purple('warn')
        console.log(`  ${label}  ${c.bold(r.pkg)}  ${issue.message}`)
      }
    }
  }

  if (allClear) {
    console.log(c.green('\nAll packages look clean.'))
  }
}

// ── Init command ─────────────────────────────────────────────────────

function initConfig() {
  const result = writeDefaultConfig()
  if (result.created) {
    console.log(`Created ${c.bold(result.path)}`)
    console.log(c.dim('Edit this file to customize Darkfall\'s behavior.'))
  } else {
    console.log(`Config already exists at ${c.bold(result.path)}`)
  }
}

// ── Main router ──────────────────────────────────────────────────────

function run() {
  const args = process.argv.slice(2)
  const command = args[0]
  const config = loadConfig()

  if (!command || command === '--help' || command === '-h') {
    printHelp()
  } else if (command === 'setup') {
    setup()
  } else if (command === 'remove' || command === 'uninstall') {
    remove()
  } else if (command === 'init') {
    initConfig()
  } else if (command === 'check') {
    manualCheck(args.slice(1), config).catch(err => {
      console.error('Error:', err.message)
      process.exit(1)
    })
  } else if (MANAGERS.includes(command)) {
    runWrapped(command, args.slice(1), checkPackages, config).catch(err => {
      console.error('darkfall error:', err.message)
      process.exit(1)
    })
  } else {
    console.error(`Unknown command: ${command}`)
    printHelp()
    process.exit(1)
  }
}

module.exports = { run }
