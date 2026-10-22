' Zagon programa HiGiFood HACCP brez črnega okna (potrebuje Node.js).
' Dvoklik: zažene strežnik skrito in odpre brskalnik. Ustavitev: Administracija -> "Ustavi program".
' Z argumentom "tiho" (samodejni zagon ob prijavi) brskalnika ne odpre.
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = dir
extra = ""
If WScript.Arguments.Count > 0 Then
  If WScript.Arguments(0) = "tiho" Then extra = " --tiho"
End If
sh.Environment("PROCESS")("ODPRI") = "1"
sh.Run "cmd /c node server.js" & extra, 0, False
