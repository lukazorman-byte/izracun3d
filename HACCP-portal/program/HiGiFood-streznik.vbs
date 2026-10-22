' HiGiFood HACCP: odpre program na strežniku (centralni podatki za vse uporabnike). Na tem računalniku ne teče nič.
' Naslov strežnika je v datoteki naslov-streznika.txt (ob prvem zagonu ga vpišete).
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")
f = fso.GetParentFolderName(WScript.ScriptFullName) & "\naslov-streznika.txt"
url = ""
If fso.FileExists(f) Then url = Trim(fso.OpenTextFile(f, 1).ReadLine)
If url = "" Then
  url = Trim(InputBox("Vpišite naslov strežnika HiGiFood (npr. https://haccp.vasa-domena.si):", "HiGiFood HACCP", "https://"))
  If url = "" Or url = "https://" Then WScript.Quit
  fso.CreateTextFile(f, True).WriteLine url
End If
If LCase(Left(url, 8)) <> "https://" And LCase(Left(url, 7)) <> "http://" Then url = "https://" & url
sh.Run """" & url & """", 1, False
