#!/bin/sh
cd "$(dirname "$0")"
export SYNC_KEY="${SYNC_KEY:-zmien-mnie-na-tajny-klucz}"
export PORT="${PORT:-8787}"
echo "Start portalu LSW (klucz=$SYNC_KEY port=$PORT)"
exec node server.js
