@echo off
cd /d "%~dp0"
echo Najprej ZAPRITE aplikacijo (okno strezniku).
node server.js --ponastavi-geslo
pause
