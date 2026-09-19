#!/bin/zsh
set -e
cd "$(dirname "$0")"
exec node scripts/uninstall-macos.mjs
