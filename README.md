# Antigravity-Chinese-Localization

Antigravity 深度汉化与高性能本地化补丁程序

中文 | [English](README.en.md)

[![GitHub release](https://img.shields.io/github/v/release/liominsb/Antigravity-Chinese-Localization?style=flat&color=blue)](https://github.com/liominsb/Antigravity-Chinese-Localization/releases/latest)
[![GitHub downloads](https://img.shields.io/github/downloads/liominsb/Antigravity-Chinese-Localization/total?style=flat&color=success)](https://github.com/liominsb/Antigravity-Chinese-Localization/releases)
[![GitHub stars](https://img.shields.io/github/stars/liominsb/Antigravity-Chinese-Localization?style=flat&color=gold)](https://github.com/liominsb/Antigravity-Chinese-Localization/stargazers)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)](https://github.com/liominsb/Antigravity-Chinese-Localization)
[![Package Size](https://img.shields.io/badge/ASAR%20Size-4.53%20MB%20(Official%20Standard)-success)](https://github.com/liominsb/Antigravity-Chinese-Localization)
[![Node Runtime](https://img.shields.io/badge/Node.js-%3E%3D%2014.0.0-informational)](https://nodejs.org/)
[![license](https://img.shields.io/github/license/liominsb/Antigravity-Chinese-Localization)](LICENSE)

专为 Google Antigravity 打造的高性能、非破坏性深度汉化补丁。全面适配 **Antigravity v2.12.0+** 最新架构，深度重构基础算力层与 DOM 调度层，带来百万级吞吐量的极致流畅体验。全量汉化规划模式、系统设置、权限沙盒、官方插件生态等上千条核心界面文案，严格遵循官方 4.53 MB 轻量级打包规格，并对用户打字与代码编辑区实施绝对物理免疫。

> [最新 Release 下载](https://github.com/liominsb/Antigravity-Chinese-Localization/releases/latest) · [问题反馈与建议](https://github.com/liominsb/Antigravity-Chinese-Localization/issues)

---

## 核心特性矩阵

| 模块 | 能力与特性 | 详细说明 |
| :--- | :--- | :--- |
| 规划模式 (Planning Mode) | 全生命周期深度汉化 | 覆盖规划模式开关、实施计划 (Implementation Plan)、变更回顾 (Walkthrough)、需用户审批、待确认问题、拟定变更、自动化测试与人工验证等全套流程文案。 |
| 系统设置 (Settings) | 150+ 项设置面板全覆盖 | 汉化外观模式（浅色/深色/跟随系统）、对话区宽度（紧凑/适中/加宽/全宽）、防止休眠、后台运行、自动检查更新、命令执行审批策略（总是执行/审查/严格模式/极速模式）、数据存储与缓存维护。 |
| 安全与权限沙盒 (Sandbox) | 安全策略与黑白名单汉化 | 汉化终端沙盒模式、沙盒外命令执行确认规则、工作区外文件访问策略（允许/询问/拒绝）、网络访问策略、命令白名单/黑名单、浏览器访问域名白名单。 |
| 官方插件生态 (Plugins) | “使用 Google 插件构建”深度汉化 | 深度汉化插件中心全生命周期操作（安装/卸载/更新/启用/禁用）、包含构件标签（Skills/Rules/MCP/Hooks）、以及 Google 官方核心插件（gemini-api 等）的长句功能说明。 |
| 模型与推理呈现 | 100% 保持官方英文原生 | 遵循专业开发者习惯，模型选择下拉框（Gemini 3.8 / Claude 3.7 等）及思考状态（Thinking / Thought 过程）严格保留英文原文，不进行二次翻译干扰。 |
| 极致算力与高帧率调度 | 吞吐量突破 168 万次/秒 | 预编译 $O(1)$ 哈希索引、纯中文 ASCII 极速短路、单次流式联合正则、DOM 树祖先剪枝与微任务调度，全面保障 60fps/120fps 满帧运行。 |
| 打包体积瘦身优化 | 4.53 MB 官方标准规格 | 修正打包过滤机制，使用 `--unpack-dir` 规范排除外部 Node 模块，彻底根除 asar 体积膨胀问题，体积与官方原版保持一致。 |
| 跨版本热升级机制 | 智能替换旧版补丁 | 摒弃原版因检测到旧标记而静默跳过的缺陷，改用 `injectOrUpdate` 截断更新机制，无论是全新安装还是跨版本更新，均可一键完成热升级。 |
| 渲染安全与输入免疫 | 编辑器与输入框免疫保护 | 穿透 Shadow DOM 实时监听，智能免疫 `INPUT`、`TEXTAREA`、富文本编辑区、Monaco 代码编辑器与用户对话气泡，严禁篡改用户编写的代码和输入内容。 |
| 安全备份与一键还原 | 双向无损切换 | 首次部署时自动备份官方原版 `app.asar.bak`，支持随时通过面板或命令行一键安全还原至官方原版纯英文状态。 |

---

## 快速安装指南

本补丁提供多种灵活的安装方式，满足普通用户与开发者的不同场景需求：

### 方式零：免环境即用覆盖

无需配置 Node.js 或任何运行环境，直接使用官方标准规格的预制核心包：

1. 前往 [Releases](https://github.com/liominsb/Antigravity-Chinese-Localization/releases/latest) 下载预打好包的 **`app.asar`**；
2. 彻底退出正在运行的 Antigravity；
3. 打开程序目录（Windows 默认位置）：  
   `%LOCALAPPDATA%\Programs\antigravity\resources\`
4. 将下载的 `app.asar` 直接覆盖同名文件，重新启动 Antigravity 即可完成汉化。

---

### 方式一：Windows 用户（脚本与控制中心）

#### 1. 图形化控制中心（推荐）
1. 下载 Release 发布的 `default.zip` 或仓库源码并解压；
2. 双击运行目录下的 **`双击运行汉化.bat`**；
3. 浏览器会自动打开可视化控制中心（`http://localhost:3388`），系统会自动检测路径并就绪，点击“一键汉化”即可。

#### 2. 纯命令行极速部署（免开浏览器）
在终端中进入项目目录，执行以下命令即可在 5 秒内完成全自动替换：
```bash
node localize.js --now
```

---

### 方式二：Linux / Ubuntu 用户

1. 打开终端，进入项目目录，运行一键启动脚本：
   ```bash
   ./运行汉化.sh
   ```
2. 浏览器自动打开可视化控制面板，点击“一键汉化”。  
   或者直接通过无头命令行部署：
   ```bash
   node localize.js --now
   ```

---

### 方式三：macOS 用户

1. 打开终端，进入项目目录，赋予执行权限并运行：
   ```bash
   chmod +x 运行汉化.sh
   ./运行汉化.sh
   ```
2. 浏览器自动打开控制中心，点击“一键汉化”。默认定位路径为 `/Applications/Antigravity.app`。

> **macOS 代码签名提示**：  
> 在 macOS 下修改应用内部 asar 包会破坏原有的签名信息，Gatekeeper 可能会拦截并提示“应用已损坏，无法打开”。若遇到该情况，在终端中执行以下命令清除隔离属性即可恢复正常：  
> ```bash
> xattr -cr /Applications/Antigravity.app
> ```

---

## 常用命令行参数

`localize.js` 支持直接通过参数进行静默操作，适合自动化脚本或开发者快速调用：

```bash
# 立即执行汉化并静默退出（不启动 Web 界面）
node localize.js --now

# 立即恢复到官方原版英文（使用 app.asar.bak 还原）
node localize.js --restore

# 仅解包 app.asar 到 extracted 目录（用于开发与分析）
node localize.js --extract-only

# 仅从 extracted 目录重新打包为 app.asar
node localize.js --pack-only
```

---

## 开发者文档 (Developer Documentation)

本项目并非单纯的文本查找替换脚本，而是在 Electron 原生渲染管线与 React 虚拟 DOM 调度层之间构建的一套高韧性、高吞吐的工业级本地化引擎。

```text
[ Antigravity 启动 ]
        │
        ├─► [ 原生层: dist/loadingOverlay.js ] ──► 本地化启动遮罩动画
        ├─► [ 原生层: dist/menu.js & tray.js ] ──► 本地化原生菜单栏与系统托盘
        │
        └─► [ Web 容器: dist/preload.js ]
                    │
                    ▼
        [ DOM_TRANSLATOR_INJECTION 核心引擎 ]
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  [ 算力层: 预编译哈希 ]   [ 调度层: 微任务与剪枝 ]
  • Map O(1) 极速索引     • 联合词边界流式正则 (CORE_WORDS_UNION_REGEX)
  • ASCII 纯中文极速短路   • DOM 树祖先剪枝 (消灭 O(N^2) 嵌套递归)
  • WeakSet 成功标记门禁   • queueMicrotask 高保真帧聚合调度
        │                       │
        └───────────┬───────────┘
                    │
        ┌───────────┴───────────────────────┐
        ▼                                   ▼
  [ 绝对物理免疫沙盒 ]                 [ 生命周期自愈与动态切片 ]
  • Monaco 代码编辑器物理隔离         • Ctrl + R 重载生命周期与占位节点保护
  • INPUT / TEXTAREA 用户打字免疫     • React 独立节点物理切片动态自愈拼合
  • 控制中心防密码管理器篡改装甲       • 前置长句正则与中英混排纠偏
```

完整架构设计、底层算力算法、50,000 次压测基准数据与工程工艺详见 [docs/](docs/)：

| 文档 | 语言 | 核心技术要点 |
| :--- | :--- | :--- |
| [architecture.md](docs/architecture.md) | 中文 | 基础算力层重构 ($O(1)$ Map 哈希与 ASCII 短路)、DOM 调度层优化 (联合流式正则与祖先剪枝)、`Ctrl+R` 重载生命周期自愈与 React 切片拼合、50,000 次压测基准数据、Shadow DOM 输入免疫与控制中心防篡改装甲 |
| [architecture.en.md](docs/architecture.en.md) | English | Deep engineering breakdown: $O(1)$ precompiled Map lookups, ASCII short-circuit, unified regex stream scanning, DOM ancestor pruning, queueMicrotask frame aggregation, 1.68M qps benchmark, lifecycle healing & input physical immunity |

---

## 版本更新日志 (Changelog)

### v2.12.0.1 (2026-09-04)
- **模型思考链 (Thinking Process) 绝对物理隔离**：
  - 彻底解决 AI 流式吐字时单词 token 命中分词逻辑导致中英杂糅的缺陷（如英文原句中 `Control` 误译为“控制”）。
  - 双层精准过滤：彻底跳过 `.cursor-edit` 及思考正文包裹容器，杜绝任何正文词汇误篡改。
  - 外部触发药丸保留汉化：`Thought for 4s` 汉化为 `思考了 4s`，`Thinking...` 汉化为 `正在思考...`。
- **动态正则转义失真全量纠正**：
  - 修复注入模板字符串中的双重反斜杠问题（`\\d`、`\\s`、`\\+` 误匹配字面量反斜杠），全面恢复数字与文件数变更等正则语义。
  - 修正限额标题动态匹配 `\s+Limit\s+Remaining` 转义丢失问题。
- **控制中心全景功能升级**：
  - 新增亮色 / 暗色主题一键切换按钮（支持持久化记忆与系统主题跟随）。
  - 新增在线 Release 词库检测按钮与红点徽标提示，一键获取 GitHub 最新补丁。
  - 优化浅色模式下打包中的半透明遮罩与文案对比度，彻底修复白底白字无法看清问题。
  - 增加“清除前端缓存”一键维护工具。

---

## 常见问题与排错 (FAQ)

### Q1: 运行汉化后，启动应用提示找不到文件或报错？
请检查是否在 Antigravity 尚未完全关闭的情况下执行了打包。Antigravity 的 Go 语言后端进程（`language_server.exe`）可能在后台占用文件句柄。  
解决办法：在任务管理器中确保 `Antigravity.exe` 及相关进程已完全退出，然后重新运行 `node localize.js --now`。

### Q2: 官方推送新版本后，汉化失效了怎么办？
官方推送更新后会静默覆盖 `app.asar`。只需在更新完成后重新执行一次汉化命令即可：
```bash
node localize.js --now
```
脚本会自动备份新的官方 `app.asar` 并重新注入最新的深度汉化补丁。或者直接下载最新 Release 预制的 `app.asar` 进行覆盖。

### Q3: 如何完全卸载汉化、恢复官方原版？
在控制中心点击“还原英文原版”，或者直接运行：
```bash
node localize.js --restore
```
程序将自动从此前备份的 `app.asar.bak` 中无损还原原始文件。

---

## 贡献者与开源协作

| 贡献者 | 角色与主要贡献 |
| :--- | :--- |
| [liominsb](https://github.com/liominsb) | 原项目创作者，搭建了最初的 Electron asar 注入与 Web 控制中心基础架构 |
| [LAN-TINA-WS](https://github.com/LAN-TINA-WS) | 2.12.0+ 深度重构、基础算力层与 DOM 调度层飞跃优化（168万次/秒）、4.53MB 瘦身修复、热更新引擎、生命周期与切片自愈、全套设置与插件生态词库扩充与独立维护 |
| [Justin-Mai](https://github.com/Justin-Mai) | 2.0 汉化控制中心架构升级、多用户/自定义路径、心跳自愈与防劫持、代码预览与 Diff 防误翻译隔离机制 |

- **参与贡献**：欢迎提交 Pull Request 或通过 Issues 反馈未汉化的词条与界面。

---

## 开源许可

本项目采用 [MIT License](LICENSE) 许可协议。
