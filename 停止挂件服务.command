#!/bin/zsh
set -e
cd "$(dirname "$0")"
exec node scripts/control.mjs stop
