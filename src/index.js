#!/usr/bin/env node
'use strict'

/**
 * Gatepost — supply chain security for package managers.
 *
 * This is the CLI entry point. All logic lives in dedicated modules:
 *   src/cli.js          — CLI router and help
 *   src/runner.js       — package manager wrapping
 *   src/setup.js        — shell alias management
 *   src/config.js       — configuration loading
 *   src/checks/         — security check modules
 *   src/api/            — external API clients
 *   src/data/           — blocklists and popular package lists
 */

const { run } = require('./cli')
run()
