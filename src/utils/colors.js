'use strict'

/**
 * Minimal ANSI color helpers.
 * No dependencies — just escape codes.
 */

const c = {
  red:    s => `\x1b[1;31m${s}\x1b[0m`,
  purple: s => `\x1b[1;38;5;133m${s}\x1b[0m`,
  green:  s => `\x1b[1;38;5;151m${s}\x1b[0m`,
  bold:   s => `\x1b[1m${s}\x1b[0m`,
  dim:    s => `\x1b[2m${s}\x1b[0m`,
}

module.exports = { c }
