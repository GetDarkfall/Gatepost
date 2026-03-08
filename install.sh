#!/bin/sh
set -e

# Gatepost installer
# Usage: curl -fsSL https://raw.githubusercontent.com/GetBastion/gatepost/main/install.sh | sh

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

# Run setup to add shell aliases
gatepost setup

printf "\033[93m\n"
printf "   ____       _                       _   \n"
printf "  / ___| __ _| |_ ___ _ __   ___  ___| |_ \n"
printf " | |  _ / _\` | __/ _ \\ '_ \\ / _ \\/ __| __|\n"
printf " | |_| | (_| | ||  __/ |_) | (_) \\__ \\ |_ \n"
printf "  \\____|\__,_|\\__\\___| .__/ \\___/|___/\\__|\n"
printf "                     |_|                  \n"
printf "\033[0m\n"
printf "\033[37mDone. Restart your terminal or run: source ~/.zshrc\033[0m\n"
