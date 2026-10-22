# Testi

    npm test                      # vsi testi
    node testi/run.js higiena     # samo testi z "higiena" v imenu

Vsak test dobi čist strežnik v začasni mapi (`HACCP_DATA`), zato ne spreminja vaših podatkov. Testi `ui-*` potrebujejo Playwright in Chromium (`npm i -g playwright`, nato `npx playwright install chromium` ali nastavite `PW_CHROMIUM`); če ju ni, se preskočijo. `qr.test.js` dodatno dekodira QR kode, če je nameščen python3 z opencv.
