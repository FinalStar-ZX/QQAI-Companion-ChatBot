---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 026e0a9e6625537f0505ecda5dc4cb80_bd8638f5e71d11f1a9b8525400f8a581
    ReservedCode1: NUwfBnJxewOL4GfuN5+UXNHrfyVCBP70XfaetVodU8M0S/D9nIcnlOxRW0U2GZoIwTOTCbOaBbhT/ldypOV2st9h5g8/CD0dReR8A5WUrYWMJM6iyM68UmoAQzrcrnJivfreiKB3mVfSE5IxvETEoY3jDtiDpXNOy5ywxnGTvlpTv5mIPJn+fhUM5tU=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 026e0a9e6625537f0505ecda5dc4cb80_bd8638f5e71d11f1a9b8525400f8a581
    ReservedCode2: NUwfBnJxewOL4GfuN5+UXNHrfyVCBP70XfaetVodU8M0S/D9nIcnlOxRW0U2GZoIwTOTCbOaBbhT/ldypOV2st9h5g8/CD0dReR8A5WUrYWMJM6iyM68UmoAQzrcrnJivfreiKB3mVfSE5IxvETEoY3jDtiDpXNOy5ywxnGTvlpTv5mIPJn+fhUM5tU=
---

# 从零部署：dsh QQ 机器人

> 本文以 Windows 11 + PowerShell 为例。全程只需要填 3 个凭证，其余按复制粘贴即可。
> 文中 `D:\dsh-env` 是示例根目录，你可以换成任意路径，但**所有脚本里的路径要一起改**。

---

## 0. 前置条件

| 项目 | 要求 |
|---|---|
| 操作系统 | Windows 10 / 11（守护脚本基于 PowerShell + 计划任务） |
| Node.js | 24.x（dsh 要求） |
| 账号 | QQ 开放平台已创建机器人应用，拿到 `AppID` 与 `AppSecret` |
| 模型 | 任一 OpenAI 兼容接口（官方 API / 中转站 / 本地推理均可） |
| 权限 | 能创建计划任务的普通用户即可（无需管理员） |

检查环境：

```powershell
node -v          # 应为 v24.x
npm -v
```

---

## 1. 安装 dsh

```powershell
npm install -g @deepseek-ai/dsh
dsh --version
```

如果 `dsh` 命令找不到，检查 npm 全局 bin 是否在 PATH 里：

```powershell
npm config get prefix
```

---

## 2. 创建 profile 并安装 QQ 插件

profile 是 dsh 的独立运行实例，机器人单独用 `qqbot` 这个名字，避免和你的日常 agent 互相干扰。

```powershell
dsh plugin --profile qqbot add @tencent-connect/dsh-qqbot
dsh plugin --profile qqbot add @deepseek-ai/dsh-time-context
```

安装完成后，`%DSH_HOME%\profiles\qqbot\` 下会生成 `cordis.yml`（空入口列表）与 `profiles/` 子目录。

> 关于配置加载顺序：`cordis.yml` 只是 bundle 入口，**真正生效的配置树由各 bundle 与 `cordis.patch.yml` 叠加而成**。所以改配置永远改 `cordis.patch.yml`，不要手改 `cordis.yml`。

---

## 3. 写入配置

```powershell
# 假设仓库在 D:\dsh-env\G
copy D:\dsh-env\G\config\cordis.patch.example.yml `
     "$env:USERPROFILE\.dsh\profiles\qqbot\cordis.patch.yml"
```

如果你的 dsh home 不在默认位置，用 `dsh --profile qqbot --dump-config` 确认实际路径。

打开 `cordis.patch.yml`，**只改这三处**：

```yaml
- id: im-qqbot
  config:
    appId: "YOUR_APP_ID"          # ← 换
    appSecret: "YOUR_APP_SECRET"  # ← 换
```

```yaml
- id: llm-pi-ai
  config:
    providers:
      amd:
        apiKeyEnv: AMD_API_KEY    # ← 变量名，真 Key 放环境变量
```

### 3.1 填模型 Key（不要写进 YAML）

永久写入用户环境变量：

```powershell
[Environment]::SetEnvironmentVariable('AMD_API_KEY','你的真实Key','User')
```

或者用启动脚本临时注入（推荐，见第 4 节）。

> **为什么不用明文 YAML**：配置文件很容易被截图、备份、误传到 Git。Key 放环境变量，泄露面小得多。

### 3.2 单聊白名单

```yaml
c2cMode: allowlist
c2cAllow:
  - "YOUR_OPENID"     # 你自己的 openid，见第 6 节获取方式
```

首次调试可以先设成 `open`（所有私聊都回），跑通后立刻改回 `allowlist`。

---

## 4. 启动

```powershell
cd D:\dsh-env\G\scripts
copy ..\config\run-qqbot.bat.example run-qqbot.bat
notepad run-qqbot.bat      # 改路径与 Key
.\run-qqbot.bat
```

日志出现以下内容即接通：

```
[qqbot] connecting...
[qqbot] Bot ready
```

此时在 QQ 里私聊你的机器人，应该能收到回复。

---

## 5. 双模型自动容灾（可选但强烈推荐）

### 5.1 为什么要这层

上游模型在高峰期会返回 `429 / at capacity`。dsh 内核没有原生模型轮换，一旦主模型被打满，整条链路就哑了——用户看到的是「机器人死了」。

### 5.2 做法

1. 启动本地转发层：

```powershell
node D:\dsh-env\G\scripts\dsh-fallback-proxy.mjs
```

它监听 `127.0.0.1:8799`，维护模型顺序 `[主模型, 备用模型]`：

- 每个请求先试「上次成功的模型」，失败再试另一个；
- 命中 429 / capacity 的模型进入约 30 秒冷却，自动切另一个；
- 非容量类错误原样透传；
- 两个都不可用时才向上抛 429。

2. 把 provider 的 `baseURL` 指向它：

```yaml
- id: llm-pi-ai
  config:
    providers:
      amd:
        baseURL: "http://127.0.0.1:8799/v1"
```

3. 验证配置真的生效：

```powershell
dsh --profile qqbot --dump-config | Select-String "baseURL"
```

4. 改完重启 bot，观察代理日志里的 `switch to` 记录。

> 转发层要同时兼容 `/v1/chat/completions` 与 `/v1/v1/chat/completions` 两种路径形态，否则会出现 404。

### 5.3 改模型名

打开 `scripts/dsh-fallback-proxy.mjs`，改这两行：

```js
const MODELS = ['主模型ID', '备用模型ID'];
const UPSTREAM = 'https://你的上游/v1';
```

---

## 6. 获取 openid

给机器人发一条私聊消息，然后看 dsh 日志里的会话记录，或在调试日志中搜索 `openid` / `member_openid`。拿到后填进 `c2cAllow`。

---

## 7. 进程守护（防止莫名失联）

### 7.1 问题

如果 bot 是由某个宿主程序派生的子进程（编辑器终端、agent 工具等），**宿主一重启，子进程连带被杀**，而且没有任何提示。

### 7.2 方案

用 Windows 计划任务做独立托管：

```powershell
cd D:\dsh-env\G\scripts
copy ..\config\run-qqbot.bat.example run-qqbot.bat

schtasks /Create /TN "dsh-qqbot-guard" /SC MINUTE /MO 1 /RL HIGHEST ^
  /TR "wscript.exe \"D:\dsh-env\G\scripts\dsh-guard-silent.vbs\"" /F
```

守护脚本每分钟做两件事：

1. 检测 `127.0.0.1:8799` 有没有人监听，没有就拉起 proxy；
2. 检测 `dsh --profile qqbot` 进程是否存在，没有就拉起 bot。

### 7.3 无窗口启动（消除黑框）

直接用 `powershell.exe -File dsh-guard.ps1` 做计划任务动作，**每分钟会闪一次黑色控制台窗口**（即使加了 `-WindowStyle Hidden` 也一样，因为以当前用户身份启动时控制台宿主会短暂创建）。

解决办法：用 wscript 包一层，`Run(..., 0, False)` 中的 `0` 表示隐藏窗口。

- `dsh-guard-silent.vbs`：给计划任务用，静默调用 `dsh-guard.ps1`
- `run-hidden.vbs`：通用包装器，守护脚本内部拉起 proxy / bot 时经它启动

计划任务动作因此要写成：

```
wscript.exe "D:\dsh-env\G\scripts\dsh-guard-silent.vbs"
```

### 7.4 验证

```powershell
schtasks /Query /TN "dsh-qqbot-guard" /V /FO LIST | Select-String "Last Result"
```

`Last Result` 为 `0` 表示正常。

再手动杀一次 bot 进程，等 1 分钟，确认它被自动拉起。

---

## 8. 验收清单

- [ ] `dsh --profile qqbot --dump-config` 能看到你的 `appId` 与 `baseURL`
- [ ] 日志出现 `Bot ready`
- [ ] QQ 私聊能收到回复
- [ ] 停掉 proxy，bot 报错但守护任务 1 分钟内把它拉回来
- [ ] 杀掉 bot，1 分钟内自动恢复
- [ ] 计划任务 `Last Result = 0`，且没有重复拉起多个实例
- [ ] 代理日志能看到模型切换记录（人为制造一次 429 验证）

---

## 9. 排错

| 现象 | 原因 | 处理 |
|---|---|---|
| `Bot ready` 后无回复 | `c2cMode` 是 allowlist 且没填你的 openid | 先改 `open` 验证，再补 openid |
| 连接被拒 / 401 | `appId` `appSecret` 不匹配 | 开放平台重新生成 Secret |
| 回复特别慢 | 流式输出与分段限制冲突 | 关 `streaming`，调低 `textChunkLimit` |
| 一直 429 | 主模型容量满且没配转发层 | 启用第 5 节的转发层 |
| 404 于 `/v1/v1/chat/completions` | `baseURL` 多写了一层 `/v1` | 二选一，不要重复 |
| 会话锁死在某模型 | 会话文件 `modelSelection.lastUsed.model` 优先级高于全局配置 | 改会话文件里的模型名为可用模型，并提升其 `seq` |
| 改了配置不生效 | 改错文件（改了 `cordis.yml`） | 只改 `cordis.patch.yml` |
| 重启宿主后机器人消失 | 没做计划任务守护 | 见第 7 节 |
| 每分钟闪黑框 | 计划任务直接调 powershell | 改用 `wscript + .vbs` |
| 机器人重复回复 | 拉起了多个实例 | 任务管理器确认只有一个 node 进程，检查守护脚本判定条件 |

---

## 10. 目录建议

```
D:\dsh-env\
├─ dsh-home\            dsh 数据根（DSH_HOME）
├─ G\                   本仓库
├─ logs\                日志
└─ fallback-proxy.log   转发层日志
```
