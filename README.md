---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 026e0a9e6625537f0505ecda5dc4cb80_b970effae71d11f184bd52540072b1e8
    ReservedCode1: bykEehL6hxtlK3DPwGE/WUIZP8nZrzWUdwpw/XTV91/W2PtHgFRZqFMijKEI6uIPCh3oyqardDk72kg/yw/pB5LPcGTvs9ctm/XtWkUhQILKYF22udoyrDaRAjZ9J1JphG1AZ6lpkmoZ9v2/fDH8Rl1G5pK5NdclkWjEp7YStLjl2W9kwV3866/v52c=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 026e0a9e6625537f0505ecda5dc4cb80_b970effae71d11f184bd52540072b1e8
    ReservedCode2: bykEehL6hxtlK3DPwGE/WUIZP8nZrzWUdwpw/XTV91/W2PtHgFRZqFMijKEI6uIPCh3oyqardDk72kg/yw/pB5LPcGTvs9ctm/XtWkUhQILKYF22udoyrDaRAjZ9J1JphG1AZ6lpkmoZ9v2/fDH8Rl1G5pK5NdclkWjEp7YStLjl2W9kwV3866/v52c=
---

# dsh-qqbot-starter

> 基于 [dsh](https://www.npmjs.com/package/@deepseek-ai/dsh)（DeepSeek Harness）+ 腾讯 QQ 机器人官方开放平台 的个人 QQ 陪伴机器人脚手架。
> 开箱即用的服务守护与**双模型自动容灾**；人设完全外置，**本仓库不含任何现成人设**。

- 维护者：`<YOUR_NAME>`（GitHub: `@<YOUR_GITHUB>`）<!-- TODO: 换成你的名字与 GitHub ID -->
- 适用场景：**个人日常陪伴、AI 聊天、学习与研究**
- 许可：**非商业**，详见 [LICENSE.md](LICENSE.md) 与 [ACCEPTABLE_USE.md](ACCEPTABLE_USE.md)

**English summary** — A starter kit for running a personal QQ companion bot on top of dsh and the official QQ Bot OpenAPI, with a local model-failover proxy and a Windows Scheduled Task watchdog. Non-commercial use only. No persona included; bring your own.

---

## 1. 这是什么

很多人搭 QQ 机器人卡在三件事上：

1. 第三方协议端不稳定、随时停更、有封号风险；
2. 模型一撞限流（429）整段链路就哑掉，用户侧表现成「机器人死了」；
3. 进程是别的程序的子进程，宿主一重启就静默消失，没有任何提示。

这个仓库把这三件事都处理掉了：走**官方开放平台**通道、加一层**本地双模型转发**、用**计划任务 + 无窗口启动器**做守护。你只需要填三个凭证，写自己的人设。

## 2. 特性

| 特性 | 说明 |
|---|---|
| 官方通道接入 | 走 QQ 机器人官方 OpenAPI，不依赖任何第三方协议端 |
| 单聊 / 群聊 | 默认单聊白名单模式，只回你允许的人 |
| 人设完全外置 | 全部写在 `cordis.patch.yml` 的 `directPrompt`，仓库不附带人设 |
| 双模型自动容灾 | 本地 OpenAI 兼容转发层，主模型容量满自动切备用，反之亦然 |
| 进程守护 | Windows 计划任务每分钟巡检，进程挂了自动拉起 |
| 无窗口启动 | 经 wscript 隐藏控制台，不会每分钟闪黑框 |
| 时间感知 | 通过 `@deepseek-ai/dsh-time-context` 注入真实日期时间 |
| 配置纯 YAML | 只改 `cordis.patch.yml`，不与升级冲突 |

## 3. 架构

```
QQ 用户（单聊 / 群聊）
      │  QQ 开放平台 WebSocket
      ▼
dsh --profile qqbot web            机器人主进程（Node.js）
      │  OpenAI 兼容请求
      ▼
127.0.0.1:8799  fallback-proxy     本地转发层，模型自动互切
      │  429 / at capacity 时切换
      ▼
上游模型服务（主模型 ⇄ 备用模型）

        计划任务 watchdog（每分钟）
        ├─ 端口没人监听 → 拉起 proxy
        └─ bot 进程消失 → 拉起 bot（无窗口）
```

## 4. 快速开始

> 完整步骤、参数说明与排错见 [docs/deploy.md](docs/deploy.md)。

```powershell
# 1) Node.js 24.x，安装 dsh
npm install -g @deepseek-ai/dsh

# 2) 建 profile 并装 QQ 插件
dsh plugin --profile qqbot add @tencent-connect/dsh-qqbot

# 3) 复制配置模板，填写你自己的凭证
copy config\cordis.patch.example.yml "%DSH_HOME%\profiles\qqbot\cordis.patch.yml"

# 4) 启动
scripts\run-qqbot.bat
```

启动后日志出现 `Bot ready` 即为接通。首次必须自己填的三样东西：

| 变量 / 字段 | 从哪来 |
|---|---|
| `appId` | QQ 开放平台 → 你的机器人应用 |
| `appSecret` | 同上（只显示一次） |
| `AMD_API_KEY`（或你的模型 Key） | 上游模型服务控制台 |

> 仓库中所有密钥位置都是占位符 `YOUR_*`，**请勿把真实密钥提交回 Git**。

## 5. 目录结构

```
G/
├─ README.md                    本文件
├─ LICENSE.md                   非商业许可
├─ ACCEPTABLE_USE.md            可接受使用规范（必读）
├─ CONTRIBUTING.md              贡献指南
├─ .env.example                 环境变量示例
├─ .gitignore
├─ config/
│  ├─ cordis.patch.example.yml  配置模板（密钥、人设均为占位）
│  └─ run-qqbot.bat.example     启动脚本模板
├─ scripts/
│  ├─ dsh-fallback-proxy.mjs    双模型转发层
│  ├─ dsh-guard.ps1             守护脚本
│  ├─ dsh-guard-silent.vbs      计划任务用的无窗口启动器
│  └─ run-hidden.vbs            通用无窗口启动器
├─ docs/
│  ├─ deploy.md                 从零部署教程
│  └─ persona-guide.md          人设编写指南（含自我介绍模板）
└─ prompts/
   └─ self-intro.example.md     自我介绍型人设模板（占位，不含现成人设）
```

## 6. 关键配置

只改 `profiles/qqbot/cordis.patch.yml`，**不要手改** `cordis.yml`（它只是空入口列表，配置树由 bundles 与 patch 叠加）。

| 字段 | 作用 | 建议 |
|---|---|---|
| `appId` / `appSecret` | QQ 机器人凭证 | 必填 |
| `access.c2cMode` | 单聊准入 | `allowlist` + `c2cAllow` 填你的 openid |
| `requireMention` | 是否必须 @ | 单聊 `false` |
| `streaming` | 流式输出 | `false` 更稳 |
| `textChunkLimit` | 单条消息最大字数 | 60~150 |
| `directPrompt` | 人设，**你来写** | 见 [docs/persona-guide.md](docs/persona-guide.md) |
| `baseURL` | 模型接口 | 直连上游，或指向本地转发层 |
| `apiKeyEnv` | Key 的环境变量名 | 不要把 Key 写进 YAML |
| `retryPolicy` | 重试策略 | 建议 `maxRetries: 8` |

## 7. 使用规范（重要）

本项目**仅供个人日常陪伴与 AI 聊天**，并用于学习、研究 dsh 与 QQ 机器人接入方式。

- **禁止任何商业用途**：包括但不限于付费代部署、付费托管、转售、捆绑销售、广告变现、企业内部生产使用。
- **禁止色情低俗内容**：禁止生成、传播色情、性暗示、低俗内容；禁止用于任何涉及未成年人的不当内容。
- **禁止违法与侵害他人**：禁止用于诈骗、骚扰、冒充他人、绕过平台风控、批量骚扰、垃圾信息。

完整条款见 [ACCEPTABLE_USE.md](ACCEPTABLE_USE.md)，违反即自动终止授权。

## 8. 免责声明

- 本项目与腾讯、DeepSeek、AMD 等公司**无任何隶属或背书关系**。
- 使用 QQ 机器人需遵守 [QQ 开放平台](https://q.qq.com/) 的相关规则；账号风险由使用者自行承担。
- 机器人输出由你所配置的模型与**你自己撰写的人设**决定，内容责任由部署者自负。
- 软件按「现状」提供，不提供任何明示或暗示担保。

## 9. 致谢

- [dsh](https://www.npmjs.com/package/@deepseek-ai/dsh) — agent 运行时
- `@tencent-connect/dsh-qqbot` — QQ 机器人适配
- `@deepseek-ai/dsh-time-context` — 时间上下文注入
