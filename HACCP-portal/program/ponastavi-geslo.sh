#!/bin/sh
cd "$(dirname "$0")"
echo "Najprej ustavite aplikacijo."
node server.js --ponastavi-geslo
