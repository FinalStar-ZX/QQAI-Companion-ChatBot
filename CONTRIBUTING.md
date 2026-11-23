---
AIGC:
    Label: "1"
    ContentProducer: 001191440300708461136T1XGW3
    ProduceID: 026e0a9e6625537f0505ecda5dc4cb80_bca38ec9e71d11f1a9b8525400f8a581
    ReservedCode1: CIMkIeZYGaYdHR3X9aX6ZuC8orXXaIKEWKHMce17rqmIDhlf0848hzzVfYqMLHTig+1mkH61M5Dvx700kQ2kLCtndq7vAhu5twRYvRVPnLO8Yvpk/iBFi6WvKsaCPQgk4tSqJDa68ykd6DAP8bZ8FYph2vro/nISv1CToIFGqn/DJnNIYcAO5qI6dAM=
    ContentPropagator: 001191440300708461136T1XGW3
    PropagateID: 026e0a9e6625537f0505ecda5dc4cb80_bca38ec9e71d11f1a9b8525400f8a581
    ReservedCode2: CIMkIeZYGaYdHR3X9aX6ZuC8orXXaIKEWKHMce17rqmIDhlf0848hzzVfYqMLHTig+1mkH61M5Dvx700kQ2kLCtndq7vAhu5twRYvRVPnLO8Yvpk/iBFi6WvKsaCPQgk4tSqJDa68ykd6DAP8bZ8FYph2vro/nISv1CToIFGqn/DJnNIYcAO5qI6dAM=
---

# 贡献指南

感谢愿意改进这个项目。提交前请先读一遍 [ACCEPTABLE_USE.md](ACCEPTABLE_USE.md)。

## 提交前自查（硬性）

- [ ] **不含真实密钥**：`appId` / `appSecret` / 模型 API Key 全部使用 `YOUR_*` 占位符
- [ ] **不含个人人设**：仓库不收录任何具体人设文本，示例必须是占位模板
- [ ] **不含个人数据**：openid、QQ 号、聊天记录、日志、会话文件一律不提交
- [ ] **不含违规内容**：色情低俗、违法、骚扰类内容一律拒绝
- [ ] 代码可运行：改动后在干净环境按 `docs/deploy.md` 走一遍

## 提交内容建议

| 欢迎 | 不接受 |
|---|---|
| 兼容性修复、文档纠错、排错经验 | 现成人设、角色卡、对话语料 |
| 新的上游模型适配示例（脱敏） | 商业部署方案、代部署服务 |
| 跨平台支持（Linux / macOS 守护方案） | 涉及破解、绕过平台风控的改动 |

## 流程

1. Fork 本仓库
2. 新建分支：`feat/your-feature` 或 `fix/your-fix`
3. 提交：说明「改了什么 / 为什么改 / 怎么验证」
4. 发起 Pull Request，描述里附验证方式

## 代码风格

- Node 脚本：ESM，2 空格缩进，变量名英文，注释中文
- PowerShell / BAT：路径用变量，不写死盘符
- 文档：中文为主，命令块标注语言

## 许可

贡献即表示你同意你的代码以本项目的 [LICENSE.md](LICENSE.md)（非商业许可）发布。
*（内容由AI生成，仅供参考）*
