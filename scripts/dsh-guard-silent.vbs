' dsh-guard-silent.vbs —— 无窗口启动守护脚本（供 Windows 计划任务调用）
'
' 为什么需要它：
'   计划任务直接调 powershell.exe -File dsh-guard.ps1 时，即使加 -WindowStyle Hidden，
'   以当前用户身份启动仍会创建控制台宿主窗口，表现为每分钟闪一次黑框/蓝框。
'   用 wscript 托管并 Run(..., 0, False)，窗口彻底不出现。
'
' 部署：schtasks /Create /TN "dsh-qqbot-guard" /SC MINUTE /MO 1 /RL HIGHEST ^
'         /TR "wscript.exe \"<本文件绝对路径>\"" /F

Option Explicit
Dim sh, fso, base, ps1, cmd
Set sh = CreateObject("WScript.Shell")
Set fso = CreateObject("Scripting.FileSystemObject")

' 与本文件同目录下的 dsh-guard.ps1
base = fso.GetParentFolderName(WScript.ScriptFullName)
ps1 = fso.BuildPath(base, "dsh-guard.ps1")

If Not fso.FileExists(ps1) Then
  WScript.Quit 1
End If

cmd = "powershell.exe -NoProfile -NonInteractive -ExecutionPolicy Bypass -File """ & ps1 & """"
sh.Run cmd, 0, False
