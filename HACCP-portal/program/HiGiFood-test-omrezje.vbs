' HiGiFood HACCP: TESTNI NAČIN, dostopen tudi drugim računalnikom v istem omrežju (potrebuje Node.js).
' Naslov za testerje je v Administraciji, razdelek "Dostop iz omrežja". Povezava ni šifrirana: samo testni podatki.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
sh.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Environment("PROCESS")("ODPRI") = "1"
sh.Run "cmd /c node server.js --testno --omrezje", 0, False
