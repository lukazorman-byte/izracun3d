@echo off
rem Dovoli dohodne povezave na vrata 3000 (samo zasebna omrezja). Zazenite kot skrbnik.
net session >nul 2>&1
if errorlevel 1 (
  echo Ta datoteka mora biti zagnana kot skrbnik: desni klik - "Zazeni kot skrbnik".
  pause
  exit /b 1
)
netsh advfirewall firewall add rule name="HiGiFood test" dir=in action=allow protocol=TCP localport=3000 profile=private,domain
echo Pravilo "HiGiFood test" je dodano. Odstranite ga z zapri-pozarni-zid.bat.
pause
