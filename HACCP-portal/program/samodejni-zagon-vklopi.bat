@echo off
rem Program se zažene sam (skrit) ob vsaki prijavi v Windows.
set "CILJ=%~dp0HiGiFood.vbs"
powershell -NoProfile -Command "$s=(New-Object -ComObject WScript.Shell).CreateShortcut([Environment]::GetFolderPath('Startup')+'\HiGiFood HACCP.lnk');$s.TargetPath='wscript.exe';$s.Arguments='\"%CILJ%\" tiho';$s.WorkingDirectory='%~dp0';$s.Save()"
echo Samodejni zagon je vklopljen. Odstranite ga z samodejni-zagon-izklopi.bat.
pause
