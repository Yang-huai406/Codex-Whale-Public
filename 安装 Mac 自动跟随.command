#!/bin/zsh
set -e
cd "$(dirname "$0")"
exec node scripts/install-macos.mjs
