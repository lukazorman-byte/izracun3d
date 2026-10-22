@echo off
powershell -NoProfile -Command "Remove-Item ([Environment]::GetFolderPath('Startup')+'\HiGiFood HACCP.lnk') -ErrorAction SilentlyContinue"
echo Samodejni zagon je izklopljen.
pause
