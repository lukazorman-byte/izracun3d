@echo off
net session >nul 2>&1
if errorlevel 1 (
  echo Ta datoteka mora biti zagnana kot skrbnik: desni klik - "Zazeni kot skrbnik".
  pause
  exit /b 1
)
netsh advfirewall firewall delete rule name="HiGiFood test"
echo Pravilo "HiGiFood test" je odstranjeno.
pause
