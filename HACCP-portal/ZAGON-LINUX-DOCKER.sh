#!/bin/sh
# Zgradi in zažene HACCP portal (program + Caddy s HTTPS) z Dockerjem. Zaženite: sudo sh ZAGON-LINUX-DOCKER.sh
set -e
cd "$(dirname "$0")/program/streznik"
command -v docker >/dev/null 2>&1 || { echo "Docker ni nameščen. Navodila: NAVODILA-ZA-STREZNIK.md"; exit 1; }
if grep -q "vasa-domena" Caddyfile; then echo "Najprej v program/streznik/Caddyfile vpišite svojo domeno."; exit 1; fi
docker compose up -d --build
docker compose ps
echo "Portal teče. Odprite https://<vaša domena> in ustvarite administratorja."
