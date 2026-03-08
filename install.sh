#!/bin/sh
set -e

# Gatepost installer
# Usage: curl -fsSL https://raw.githubusercontent.com/GetBastion/Gatepost/master/install.sh | sh

echo "Installing Gatepost..."

# Check for Node.js
if ! command -v node >/dev/null 2>&1; then
  echo "Error: Node.js is required (v16+). Install from https://nodejs.org"
  exit 1
fi

# Check Node version
NODE_MAJOR=$(node -e "process.stdout.write(process.versions.node.split('.')[0])")
if [ "$NODE_MAJOR" -lt 16 ]; then
  echo "Error: Node.js v16 or higher is required (you have v$(node -v))"
  exit 1
fi

# Check for npm
if ! command -v npm >/dev/null 2>&1; then
  echo "Error: npm is required to install Gatepost"
  exit 1
fi

# Install globally
npm install -g @getbastionai/gatepost

# Setup runs automatically via postinstall, but run again in case it was skipped
gatepost setup

printf "\n\033[35;1mGatepost\033[0m \033[90mhas been installed\033[0m \033[92msuccessfully\033[0m\n\n"
printf "\033[90mRestart your terminal or run: source ~/.zshrc\033[0m\n"
