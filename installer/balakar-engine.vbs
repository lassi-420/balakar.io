' Starts the Balakar engine with no console window.
Set fso = CreateObject("Scripting.FileSystemObject")
Set sh = CreateObject("WScript.Shell")
root = fso.GetParentFolderName(WScript.ScriptFullName)
sh.CurrentDirectory = root & "\engine"
sh.Run """" & root & "\python\pythonw.exe"" -m captionkit", 0, False
