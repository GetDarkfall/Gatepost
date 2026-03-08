'use strict'

// Top npm packages by download count — used for typosquatting detection.
// If a package name is within edit distance 1-2 of one of these, it's flagged.
const POPULAR_PACKAGES = [
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

// Top PyPI packages by download count
const POPULAR_PYTHON_PACKAGES = [
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

module.exports = { POPULAR_PACKAGES, POPULAR_PYTHON_PACKAGES }
