'use strict'

const fs = require('fs')
const path = require('path')
const os = require('os')

const MANAGERS = ['npm', 'npx', 'yarn', 'pnpm', 'pnpx', 'bun', 'bunx', 'pip', 'pip3', 'uv', 'poetry', 'pipx']
const MARKER_START = '# gatepost-start'
const MARKER_END = '# gatepost-end'

function buildAliasBlock() {
  const aliases = MANAGERS.map(m => `alias ${m}='gatepost ${m}'`).join('\n')
  return `\n${MARKER_START}\n${aliases}\n${MARKER_END}\n`
}

function getShellConfigs() {
  const home = os.homedir()
  return [
    path.join(home, '.zshrc'),
    path.join(home, '.bashrc'),
    path.join(home, '.bash_profile'),
    path.join(home, '.profile'),
  ].filter(f => fs.existsSync(f))
}

function setup() {
  const block = buildAliasBlock()
  const configs = getShellConfigs()

  if (configs.length === 0) {
    console.log('No shell config file found. Add these aliases manually:\n')
    console.log(block)
    return
  }

  let updated = 0
  for (const config of configs) {
    const contents = fs.readFileSync(config, 'utf8')
    if (contents.includes(MARKER_START)) {
      console.log(`  Already configured: ${config}`)
      continue
    }
    fs.appendFileSync(config, block)
    console.log(`  Updated: ${config}`)
    updated++
  }

  if (updated > 0) {
    console.log('\nGatepost is set up. Restart your terminal or run:')
    console.log('  source ~/.zshrc\n')
    console.log('After that, npm, npx, yarn, pnpm, and pnpx will be protected automatically.')
  }
}

function remove() {
  const configs = getShellConfigs()
  const re = new RegExp(`\\n${MARKER_START}[\\s\\S]*?${MARKER_END}\\n`, 'g')

  let removed = 0
  for (const config of configs) {
    const contents = fs.readFileSync(config, 'utf8')
    if (!contents.includes(MARKER_START)) continue
    fs.writeFileSync(config, contents.replace(re, '\n'))
    console.log(`  Removed aliases from: ${config}`)
    removed++
  }

  if (removed === 0) {
    console.log('No Gatepost aliases found to remove.')
  } else {
    console.log('\nGatepost removed. Restart your terminal to apply.')
  }
}

module.exports = { setup, remove }
