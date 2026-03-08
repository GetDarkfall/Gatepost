'use strict'

/**
 * Known malicious packages.
 *
 * Sourced from npm security advisories, GitHub Security Advisories,
 * and public threat intelligence reports. These packages have been
 * confirmed as malicious, compromised, or intentionally destructive.
 *
 * Categories:
 *   - Compromised/backdoored: legitimate packages that were taken over
 *   - Typosquats: packages impersonating popular libraries
 *   - Credential stealers: packages that exfiltrate secrets
 */

const BLOCKLIST = new Set([
  // ── Compromised / backdoored packages ──────────────────────────────
  'event-stream',          // v3.3.6 contained flatmap-stream backdoor
  'flatmap-stream',        // cryptocurrency wallet stealing payload
  'node-ipc',             // protestware — corrupted files on Russian IPs
  'ua-parser-js',         // v0.7.29 contained cryptominer
  'coa',                  // v2.0.3+ contained malicious code
  'rc',                   // v1.2.9+ compromised via maintainer account
  'colors',              // v1.4.1+ infinite loop protestware
  'faker',               // v6.6.6 emptied + protestware

  // ── Typosquats — targeting popular npm packages ────────────────────
  'crossenv',            // cross-env typosquat, stole env vars
  'cross-env.js',
  'ffmmpeg',
  'babelcli',
  'nodecaffe',
  'nodefabric',
  'node-fabric',
  'nodeffmpeg',
  'nodemysql',
  'node-opencv',
  'node-openssl',
  'node-os',
  'node-paint',
  'node-pentest',
  'node-sqlite',
  'node-tkinter',
  'nodecrypto',
  'nodeftp',
  'nodemailer-js',
  'nodemailer.js',
  'socketio',
  'socket.io.js',
  'discordie',
  'mongose',
  'mssql-node',
  'mysqljs',
  'node-sass-middleware',
  'gruntcli',
  'jquey',
  'jquery.js',
  'd3.js',
  'require',
  'loadash',
  'momnet',
  'expres',
  'expresss',
  'reakt',
  'reactt',
  'vue.js',
  'vuejs',
  'angularjs',
  'lodahs',
  'lodash.js',
  'requets',
  'requset',
  'underscore.js',
  'underscorejs',
  'webpak',
  'webpackk',
  'axio',
  'axxios',
  'dotenv.js',

  // ── Credential stealers (public reports) ───────────────────────────
  'electron-native-notify',
  'getcookies',
  'http-fetch-client',
  'aws-sdk-config',
  'node-browserify',
  'nodecookies',
  'xss-payloads',
])

module.exports = { BLOCKLIST }
