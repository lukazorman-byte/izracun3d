' HiGiFood HACCP: TESTNI NAČIN brez črnega okna (potrebuje Node.js). Podatki so v mapi podatki-test.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
sh.CurrentDirectory = fso.GetParentFolderName(WScript.ScriptFullName)
sh.Environment("PROCESS")("ODPRI") = "1"
sh.Run "cmd /c node server.js --testno", 0, False
