'use strict'

/**
 * Popular packages by ecosystem.
 *
 * Used for typosquat detection — if a package name is within
 * Levenshtein edit distance 1-2 of any package in its ecosystem's
 * list, it's flagged as a possible typosquat.
 *
 * Lists are sourced from public download count rankings.
 */

// ── npm (JavaScript / Node.js) ───────────────────────────────────────
const NPM = [
  'lodash', 'express', 'react', 'chalk', 'commander', 'axios', 'moment',
  'webpack', 'babel', 'typescript', 'eslint', 'prettier', 'jest', 'mocha',
  'dotenv', 'mongoose', 'sequelize', 'socket.io', 'nodemailer', 'passport',
  'bcrypt', 'jsonwebtoken', 'cors', 'helmet', 'morgan', 'body-parser',
  'uuid', 'underscore', 'async', 'request', 'superagent', 'got', 'node-fetch',
  'inquirer', 'yargs', 'minimist', 'glob', 'rimraf', 'mkdirp', 'fs-extra',
  'path', 'events', 'stream', 'buffer', 'util', 'crypto', 'http', 'https',
  'vue', 'angular', 'svelte', 'next', 'nuxt', 'gatsby',
  'react-dom', 'react-router', 'redux', 'mobx', 'zustand',
  'vite', 'rollup', 'parcel', 'esbuild',
  'prettier', 'husky', 'lint-staged',
  'prisma', 'typeorm', 'knex', 'redis', 'ioredis',
  'sharp', 'jimp', 'multer', 'formidable',
  'ws', 'uws', 'fastify', 'koa', 'hapi', 'restify',
  'pm2', 'nodemon', 'concurrently',
  'cheerio', 'puppeteer', 'playwright',
  'aws-sdk', 'firebase', 'supabase',
  'tailwindcss', 'postcss', 'autoprefixer',
  'zod', 'joi', 'yup', 'ajv',
  'date-fns', 'luxon', 'dayjs',
  'ramda', 'immer', 'immutable',
  'rxjs', 'bluebird', 'p-limit',
  'semver', 'acorn', 'terser',
]

// ── PyPI (Python) ────────────────────────────────────────────────────
const PYPI = [
  'requests', 'numpy', 'pandas', 'flask', 'django', 'fastapi', 'sqlalchemy',
  'pytest', 'boto3', 'pydantic', 'celery', 'redis', 'pillow', 'scipy',
  'matplotlib', 'tensorflow', 'torch', 'scikit-learn', 'transformers',
  'cryptography', 'paramiko', 'fabric', 'ansible', 'click', 'typer',
  'httpx', 'aiohttp', 'uvicorn', 'gunicorn', 'starlette', 'fastapi',
  'alembic', 'marshmallow', 'attrs', 'pyyaml', 'toml', 'dotenv',
  'python-dotenv', 'rich', 'loguru', 'arrow', 'pendulum', 'dateutil',
  'six', 'packaging', 'setuptools', 'wheel', 'pip', 'virtualenv',
  'black', 'mypy', 'flake8', 'pylint', 'isort', 'bandit',
  'docker', 'kubernetes', 'google-cloud', 'azure', 'openai', 'anthropic',
  'langchain', 'opentelemetry', 'prometheus-client', 'psutil',
  'psycopg2', 'pymongo', 'motor', 'elasticsearch', 'stripe',
  'twilio', 'sendgrid', 'jinja2', 'werkzeug', 'itsdangerous',
  'lxml', 'beautifulsoup4', 'selenium', 'playwright', 'scrapy',
  'PyJWT', 'bcrypt', 'passlib', 'authlib',
  'tqdm', 'tabulate', 'openpyxl', 'xlrd',
]

// ── RubyGems (Ruby) ──────────────────────────────────────────────────
const RUBYGEMS = [
  'rails', 'rake', 'bundler', 'rspec', 'nokogiri', 'puma', 'sidekiq',
  'devise', 'rubocop', 'sinatra', 'activerecord', 'activesupport',
  'actionpack', 'actionview', 'actionmailer', 'railties', 'sprockets',
  'capistrano', 'thor', 'faraday', 'minitest', 'rack', 'erubi',
  'pg', 'mysql2', 'sqlite3', 'redis', 'aws-sdk', 'dotenv',
  'pry', 'byebug', 'factory_bot', 'faker', 'simplecov', 'webmock',
  'omniauth', 'jwt', 'bcrypt', 'pundit', 'cancancan', 'warden',
  'sequel', 'dry-types', 'dry-validation', 'hanami', 'grape',
  'cocoapods', 'fastlane', 'xcodeproj',
]

// ── crates.io (Rust) ─────────────────────────────────────────────────
const CRATES = [
  'serde', 'tokio', 'rand', 'clap', 'regex', 'log', 'syn',
  'quote', 'proc-macro2', 'libc', 'hyper', 'reqwest', 'actix-web',
  'axum', 'rocket', 'diesel', 'sqlx', 'sea-orm', 'rusqlite',
  'anyhow', 'thiserror', 'tracing', 'env_logger', 'chrono', 'uuid',
  'serde_json', 'toml', 'config', 'dotenv', 'bytes', 'futures',
  'async-trait', 'rayon', 'crossbeam', 'parking_lot', 'once_cell',
  'lazy_static', 'itertools', 'num', 'bitflags', 'strum',
  'tonic', 'prost', 'warp', 'tower', 'rustls', 'ring',
  'sha2', 'aes', 'ed25519', 'openssl',
]

// ── Packagist (PHP / Composer) ───────────────────────────────────────
const PACKAGIST = [
  'laravel/framework', 'symfony/console', 'symfony/http-foundation',
  'guzzlehttp/guzzle', 'monolog/monolog', 'phpunit/phpunit',
  'doctrine/orm', 'doctrine/dbal', 'vlucas/phpdotenv',
  'nesbot/carbon', 'ramsey/uuid', 'league/flysystem',
  'swiftmailer/swiftmailer', 'twig/twig', 'phpmailer/phpmailer',
  'predis/predis', 'firebase/php-jwt', 'nikic/fast-route',
  'psr/log', 'psr/http-message', 'psr/container',
  'league/oauth2-client', 'spatie/laravel-permission',
  'intervention/image', 'barryvdh/laravel-debugbar',
  'filament/filament', 'livewire/livewire', 'inertiajs/inertia-laravel',
]

// ── Hex (Elixir) ─────────────────────────────────────────────────────
const HEX = [
  'phoenix', 'ecto', 'plug', 'jason', 'telemetry', 'cowboy',
  'phoenix_html', 'phoenix_live_view', 'phoenix_ecto', 'postgrex',
  'gettext', 'swoosh', 'bamboo', 'oban', 'absinthe', 'tesla',
  'httpoison', 'ex_machina', 'credo', 'dialyxir', 'excoveralls',
  'guardian', 'comeonin', 'bcrypt_elixir', 'argon2_elixir',
  'timex', 'decimal', 'ecto_sql', 'floki', 'mint', 'finch',
]

// ── Pub (Dart / Flutter) ─────────────────────────────────────────────
const PUB = [
  'flutter', 'http', 'provider', 'shared_preferences', 'url_launcher',
  'path_provider', 'sqflite', 'firebase_core', 'firebase_auth',
  'cloud_firestore', 'google_fonts', 'intl', 'dio', 'riverpod',
  'bloc', 'flutter_bloc', 'get', 'freezed', 'json_serializable',
  'go_router', 'auto_route', 'hive', 'isar', 'drift',
  'flutter_svg', 'cached_network_image', 'image_picker', 'camera',
  'geolocator', 'google_maps_flutter', 'webview_flutter',
  'flutter_test', 'mockito', 'test', 'build_runner',
]

// ── Ecosystem → package list mapping ─────────────────────────────────
const ECOSYSTEM_POOLS = {
  'npm':       NPM,
  'PyPI':      PYPI,
  'RubyGems':  RUBYGEMS,
  'crates.io': CRATES,
  'Packagist': PACKAGIST,
  'Hex':       HEX,
  'Pub':       PUB,
}

module.exports = { ECOSYSTEM_POOLS, NPM, PYPI, RUBYGEMS, CRATES, PACKAGIST, HEX, PUB }
