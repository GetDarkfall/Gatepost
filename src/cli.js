'use strict'

/**
 * CLI router and help output.
 *
 * Parses process.argv and dispatches to the appropriate handler:
 *   - setup / remove: alias management
 *   - init: scaffold a .gatepostrc config file
 *   - check: manual package check
 *   - <manager>: wrapped package manager
 */

const { setup, remove, setupCi } = require('./setup')
const { runWrapped, MANAGERS } = require('./runner')
const { checkPackages } = require('./checks')
const { loadConfig, writeDefaultConfig, CONFIG_PATH, DEFAULTS } = require('./config')
const { discoverFiles } = require('./audit')
const log = require('./utils/logger')
const { c } = require('./utils/colors')
const fs = require('fs')
const readline = require('readline')

// ── Help text ────────────────────────────────────────────────────────

function printHelp() {
  console.log(`
${c.bold('gatepost')} — secure your package installs

${c.bold('Usage:')}
  gatepost setup              Install shell aliases (run once)
  gatepost setup --ci         Install PATH shims for CI/CD environments
  gatepost remove             Remove shell aliases (and CI shims)
  gatepost init               Interactive config setup
  gatepost check <pkg...>     Manually check packages
  gatepost audit [dir]        Scan lockfiles/manifests for vulnerabilities
  gatepost <manager> [args]   Run a package manager with protection

${c.bold('Options:')}
  --silent                    Only show blocked installs
  --verbose                   Show detailed diagnostic output
  --json                      Output results as JSON (for CI integration)

${c.bold('Examples:')}
  gatepost setup
  gatepost setup --ci
  gatepost npm install lodash
  gatepost check express axios
  gatepost init

${c.bold('Supported managers:')}
  npm, npx, yarn, pnpm, pnpx, bun, bunx
  pip, pip3, uv, poetry, pipx
  gem, cargo, composer, mix, pub
  python -m pip, python3 -m pip

${c.bold('Configuration:')}
  Run ${c.bold('gatepost init')} to create ~/.gatepostrc
  Edit it to toggle checks, adjust thresholds, and add custom blocklist entries.

After running ${c.bold('gatepost setup')}, your package managers are
automatically protected — no need to type "gatepost" each time.
`)
}

// ── Manual check command ─────────────────────────────────────────────

async function manualCheck(pkgs, config, jsonMode) {
  if (pkgs.length === 0) {
    console.error('Usage: gatepost check <package...>')
    process.exit(1)
  }

  log.info(c.dim(`Checking ${pkgs.length} package(s)...\n`))

  const results = await checkPackages(pkgs, 'npm', config)

  if (jsonMode) {
    console.log(JSON.stringify(results, null, 2))
    const hasBlock = results.some(r => r.issues.some(i => i.severity === 'block'))
    if (hasBlock) process.exit(1)
    return
  }

  let allClear = true
  for (const r of results) {
    if (r.issues.length === 0) {
      console.log(`  ${c.green('ok')}      ${c.bold(r.pkg)}`)
    } else {
      allClear = false
      for (const issue of r.issues) {
        const label = issue.severity === 'block' ? c.red('blocked') : c.orange('warn')
        console.log(`  ${label}  ${c.bold(r.pkg)}  ${issue.message}`)
      }
    }
  }

  if (allClear) {
    console.log(c.green('\nAll packages look clean.'))
  }
}

// ── Audit command ───────────────────────────────────────────────────

async function auditProject(dir, config, jsonMode) {
  const files = discoverFiles(dir)

  if (files.length === 0) {
    console.error('No dependency files found in ' + dir)
    process.exit(1)
  }

  const allResults = []

  for (const file of files) {
    log.info(c.dim(`Scanning ${file.file} (${file.ecosystem}, ${file.packages.length} packages)...\n`))

    const results = await checkPackages(file.packages, file.ecosystem, config)
    allResults.push({ file: file.file, ecosystem: file.ecosystem, results })
  }

  if (jsonMode) {
    console.log(JSON.stringify(allResults, null, 2))
    const hasBlock = allResults.some(f =>
      f.results.some(r => r.issues.some(i => i.severity === 'block'))
    )
    if (hasBlock) process.exit(1)
    return
  }

  let totalIssues = 0
  for (const file of allResults) {
    console.log(c.bold(`\n${file.file}`) + c.dim(` (${file.ecosystem})`))
    for (const r of file.results) {
      if (r.issues.length === 0) continue
      totalIssues += r.issues.length
      for (const issue of r.issues) {
        const label = issue.severity === 'block' ? c.red('blocked') : c.orange('warn')
        console.log(`  ${label}  ${c.bold(r.pkg)}  ${issue.message}`)
      }
    }
    const clean = file.results.filter(r => r.issues.length === 0).length
    if (clean === file.results.length) {
      console.log(c.green(`  All ${clean} packages look clean.`))
    }
  }

  if (totalIssues === 0) {
    console.log(c.green('\nNo issues found.'))
  } else {
    console.log(c.dim(`\n${totalIssues} issue(s) found across ${files.length} file(s).`))
  }
}

// ── Interactive init command ────────────────────────────────────────

function ask(rl, question) {
  return new Promise(resolve => rl.question(question, resolve))
}

async function initConfig() {
  if (fs.existsSync(CONFIG_PATH)) {
    console.log(`Config already exists at ${c.bold(CONFIG_PATH)}`)
    return
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const config = JSON.parse(JSON.stringify(DEFAULTS))

  console.log(c.bold('\nGatepost configuration\n'))

  const yn = (val) => val ? 'Y/n' : 'y/N'
  const parseBool = (answer, def) => {
    if (!answer.trim()) return def
    return answer.trim().toLowerCase().startsWith('y')
  }

  // Checks
  const bl = await ask(rl, `  Enable blocklist check? [${yn(true)}] `)
  config.checks.blocklist = parseBool(bl, true)

  const ts = await ask(rl, `  Enable typosquat detection? [${yn(true)}] `)
  config.checks.typosquat = parseBool(ts, true)

  const vuln = await ask(rl, `  Enable vulnerability scanning? [${yn(true)}] `)
  config.checks.vulnerability = parseBool(vuln, true)

  const ageCheck = await ask(rl, `  Enable package age check? [${yn(true)}] `)
  config.checks.age = parseBool(ageCheck, true)

  const sc = await ask(rl, `  Enable install script detection? [${yn(true)}] `)
  config.checks.scripts = parseBool(sc, true)

  const mt = await ask(rl, `  Enable maintainer change detection? [${yn(true)}] `)
  config.checks.maintainer = parseBool(mt, true)

  // Age threshold
  if (config.checks.age) {
    const days = await ask(rl, `  Minimum package age in days? [1] `)
    const parsed = parseInt(days.trim(), 10)
    if (!isNaN(parsed) && parsed > 0) config.age.minimumDays = parsed
  }

  // Fail behavior
  const fo = await ask(rl, `  Fail open on network errors? [${yn(true)}] `)
  config.failOpen = parseBool(fo, true)

  // Log level
  const ll = await ask(rl, `  Log level (silent/normal/verbose)? [normal] `)
  const level = ll.trim().toLowerCase()
  if (['silent', 'normal', 'verbose'].includes(level)) config.logLevel = level

  rl.close()

  fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2) + '\n')
  console.log(`\n  Created ${c.bold(CONFIG_PATH)}`)
  console.log(c.dim('  Edit this file anytime to change settings.\n'))
}

// ── Main router ──────────────────────────────────────────────────────

function run() {
  const rawArgs = process.argv.slice(2)

  // Parse global flags before dispatching
  const globalFlags = ['--silent', '--verbose', '--json']
  const flags = rawArgs.filter(a => globalFlags.includes(a))
  const args = rawArgs.filter(a => !globalFlags.includes(a))
  const jsonMode = flags.includes('--json')

  const config = loadConfig()

  // CLI flags override config file
  if (flags.includes('--silent') || jsonMode) {
    log.setLevel('silent')
  } else if (flags.includes('--verbose')) {
    log.setLevel('verbose')
  } else {
    log.setLevel(config.logLevel || 'normal')
  }

  const command = args[0]

  if (!command || command === '--help' || command === '-h') {
    printHelp()
  } else if (command === 'setup') {
    if (args.includes('--ci')) {
      setupCi()
    } else {
      setup()
    }
  } else if (command === 'remove' || command === 'uninstall') {
    remove()
  } else if (command === 'init') {
    initConfig().catch(err => {
      console.error('Error:', err.message)
      process.exit(1)
    })
  } else if (command === 'audit') {
    const dir = args[1] || process.cwd()
    auditProject(dir, config, jsonMode).catch(err => {
      console.error('Error:', err.message)
      process.exit(1)
    })
  } else if (command === 'check') {
    manualCheck(args.slice(1), config, jsonMode).catch(err => {
      console.error('Error:', err.message)
      process.exit(1)
    })
  } else if (MANAGERS.includes(command)) {
    runWrapped(command, args.slice(1), checkPackages, config).catch(err => {
      console.error('gatepost error:', err.message)
      process.exit(1)
    })
  } else {
    console.error(`Unknown command: ${command}`)
    printHelp()
    process.exit(1)
  }
}

module.exports = { run }
