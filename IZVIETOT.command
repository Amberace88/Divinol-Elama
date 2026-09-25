#!/bin/bash
# Divinol platforma — augšupielāde uz GitHub un izvietošana Netlify.
# Palaid ar dubultklikšķi (Finder).
cd "$(dirname "$0")" || exit 1
SITE_ID="31ad5a1b-99ac-45e9-a2bb-41edbb043478"

echo "▶ 1/3  Sūtu kodu uz GitHub (Amberace88/Divinol-Elama)…"
git config http.postBuffer 524288000
git config http.version HTTP/1.1
git add -A && git commit -qm "Atjauninājums $(date '+%Y-%m-%d %H:%M')" 2>/dev/null
git push -u origin main || echo "⚠ GitHub push neizdevās (turpinu ar Netlify)."

echo "▶ 2/3  Instalēju atkarības (pirmo reizi ~1–2 min)…"
npm ci --no-audit --no-fund || npm install --no-audit --no-fund || exit 1

echo "▶ 3/3  Pārbaudu Netlify pieslēgumu…"
if ! npx -y netlify-cli@latest status >/tmp/netlify-status.txt 2>&1 || grep -qi "not logged in" /tmp/netlify-status.txt; then
  echo "   Netlify prasīs pieslēgties — pārlūkā nospied \"Authorize\"."
  npx -y netlify-cli@latest login || exit 1
fi
echo "▶ Būvēju un izvietoju Netlify (~3 min)…"
if ! npx -y netlify-cli@latest deploy --build --prod --site "$SITE_ID"; then
  echo "   Netlify pieslēgums nav derīgs šim projektam — pieslēdzies vēlreiz (pārlūkā \"Authorize\")…"
  npx -y netlify-cli@latest login --new || exit 1
  npx -y netlify-cli@latest deploy --build --prod --site "$SITE_ID" || { echo "❌ Izvietošana neizdevās — nosūti ekrānuzņēmumu Claude."; read -n 1 -s -r; exit 1; }
fi

echo "✅ Gatavs: https://divinol-elama.netlify.app"
read -n 1 -s -r -p "Nospied jebkuru taustiņu, lai aizvērtu…"
