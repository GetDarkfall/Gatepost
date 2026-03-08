'use strict'

/**
 * Logger with configurable verbosity.
 *
 * Three levels:
 *   - silent:  only blocked installs are printed
 *   - normal:  default — warnings + blocks + checking message
 *   - verbose: all of the above plus detailed diagnostic info
 *
 * CLI flags --silent and --verbose override the config file.
 */

let level = 'normal'

function setLevel(l) {
  if (['silent', 'normal', 'verbose'].includes(l)) level = l
}

function getLevel() { return level }

function info(msg) {
  if (level !== 'silent') process.stderr.write(msg)
}

function warn(msg) {
  if (level !== 'silent') process.stderr.write(msg)
}

function error(msg) {
  process.stderr.write(msg)
}

function verbose(msg) {
  if (level === 'verbose') process.stderr.write(msg)
}

module.exports = { setLevel, getLevel, info, warn, error, verbose }
