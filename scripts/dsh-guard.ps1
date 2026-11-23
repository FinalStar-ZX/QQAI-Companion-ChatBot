# dsh-guard.ps1 —— 守护 dsh qqbot 与双模型转发层
#
# 由 Windows 计划任务每分钟调用。进程缺失则拉起。
# 关键点：以独立宿主（计划任务）运行，而不是挂在某个父进程树下 ——
#         否则宿主程序（编辑器 / 终端 / agent 工具）一重启，bot 就跟着消失。
#
# 使用方法：
#   1. 确认下面 $ROOT 指向你的部署目录
#   2. schtasks /Create /TN "dsh-qqbot-guard" /SC MINUTE /MO 1 /RL HIGHEST ^
#        /TR "wscript.exe \"<你的路径>\scripts\dsh-guard-silent.vbs\"" /F

$ErrorActionPreference = 'SilentlyContinue'

# ---------------- 配置区 ----------------
$ROOT     = Split-Path -Parent $PSScriptRoot      # 部署根目录（scripts 的上一级）
$PROXY    = Join-Path $ROOT 'scripts\dsh-fallback-proxy.mjs'
$RUNBAT   = Join-Path $ROOT 'scripts\run-qqbot.bat'
$HIDDEN   = Join-Path $ROOT 'scripts\run-hidden.vbs'
$NODE     = 'node'                                # 若 node 不在 PATH，改成绝对路径
$PORT     = 8799
$PROFILE  = 'qqbot'
$LOG      = Join-Path $ROOT 'logs\guard.log'
# ----------------------------------------

function Log([string]$m) {
  try {
    $dir = Split-Path -Parent $LOG
    if (-not (Test-Path $dir)) { New-Item -ItemType Directory -Path $dir -Force | Out-Null }
    "$(Get-Date -Format 'yyyy-MM-dd HH:mm:ss') $m" | Add-Content -Path $LOG -Encoding UTF8
  } catch {}
}

function Start-Hidden([string]$cmdLine) {
  # 经 run-hidden.vbs 启动，彻底隐藏控制台窗口
  Start-Process -FilePath 'wscript.exe' `
    -ArgumentList ('"{0}" "{1}"' -f $HIDDEN, $cmdLine) `
    -WindowStyle Hidden
}

# ---- 1. 双模型转发层 ----
$proxyAlive = Get-NetTCPConnection -State Listen -LocalPort $PORT -ErrorAction SilentlyContinue
if (-not $proxyAlive) {
  Log 'proxy down -> starting'
  Start-Hidden "$NODE `"$PROXY`""
  Start-Sleep -Seconds 2
  if (Get-NetTCPConnection -State Listen -LocalPort $PORT -ErrorAction SilentlyContinue) {
    Log 'proxy started ok'
  } else {
    Log 'proxy start FAILED'
  }
}

# ---- 2. dsh qqbot 主进程 ----
$bot = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
       Where-Object { $_.CommandLine -like '*dsh*bin.js*' -and $_.CommandLine -like "*--profile $PROFILE*" }

if (-not $bot) {
  Log 'bot down -> starting'
  Start-Hidden "`"$RUNBAT`""
  Start-Sleep -Seconds 8
  $bot2 = Get-CimInstance Win32_Process -Filter "Name='node.exe'" |
          Where-Object { $_.CommandLine -like '*dsh*bin.js*' -and $_.CommandLine -like "*--profile $PROFILE*" }
  if ($bot2) {
    Log ('bot started ok pid=' + ($bot2.ProcessId -join ','))
  } else {
    Log 'bot start FAILED'
  }
}
