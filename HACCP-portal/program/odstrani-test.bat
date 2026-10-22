@echo off
cd /d "%~dp0"
echo Najprej ustavite program: v brskalniku Administracija - "Ustavi program".
echo.
echo Ta datoteka odstrani samodejni zagon in testne podatke (mapa podatki-test).
echo Pravih podatkov (mapa podatki) NE brise.
set /p JA=Nadaljujem? (d/n): 
if /i not "%JA%"=="d" exit /b
powershell -NoProfile -Command "Remove-Item ([Environment]::GetFolderPath('Startup')+'\HiGiFood HACCP.lnk') -ErrorAction SilentlyContinue"
if exist podatki-test rmdir /s /q podatki-test
echo Testni podatki odstranjeni. Pravilo pozarnega zidu odstranite z zapri-pozarni-zid.bat (kot skrbnik).
echo Celotno mapo programa lahko zdaj izbrisete.
pause
