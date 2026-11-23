' run-hidden.vbs —— 通用无窗口启动器
'
' 用法：wscript.exe run-hidden.vbs "要执行的命令"
' 例：  wscript.exe run-hidden.vbs "D:\dsh-env\G\scripts\run-qqbot.bat"
'
' 用途：拉起 bat / node 时不弹出 cmd 黑框，配合计划任务做守护时不闪屏。

Option Explicit
Dim sh, cmd
Set sh = CreateObject("WScript.Shell")
If WScript.Arguments.Count = 0 Then WScript.Quit 1
cmd = "cmd.exe /c """ & WScript.Arguments(0) & """"
sh.Run cmd, 0, False
