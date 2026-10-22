@echo off
chcp 65001 >nul
rem Preizkus HACCP portala na tem računalniku (potreben Node.js).
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js ni nameščen. V PowerShellu zaženite:  winget install OpenJS.NodeJS.LTS
  echo Nato zaprite in znova odprite to okno.
  pause
  exit /b 1
)
cd /d "%~dp0program"
start "" http://127.0.0.1:3000/
node server.js
pause
