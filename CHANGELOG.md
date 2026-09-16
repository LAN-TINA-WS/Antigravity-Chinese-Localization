# 版本更新日志 (Changelog)

本文件记录 Antigravity-Chinese-Localization 汉化项目的全部版本迭代与核心架构变动。

---

## v2.13.0 (2026-09-13)

### 1. 全面适配 Antigravity v2.13.0 核心架构
- **前端 Bundle 变动适配**：深度适配官方 2.13.0 前端代码结构与构建更新，提取并全量汉化 116+ 处新增界面文案。
- **Preload 注入引擎同步**：同步升级主渲染线程与安装向导预加载注入模块，保障 100% 汉化覆盖与高帧率吞吐。

### 2. 侧边问答系统 (Side Question / Questionnaire) 深度汉化
- **独立侧边追问浮窗**：汉化全新侧边追问卡片交互：`Side Question`（侧边提问）、`Side question answered.`（侧边提问已回答。）、`View side question`（查看侧边提问）、`Minimize side question`（最小化侧边提问）、`Delete side question`（删除侧边提问）。
- **问答表单控制**：汉化 `Cancel questionnaire`（取消问答）与 `Cancel questionnaire and stop the agent`（取消问答并停止智能体）交互。

### 3. 源码控制 Git Amend（追加提交）全流程汉化
- **追加提交能力**：汉化源码控制面板新增的一级追加入口：`Amend`（追加提交）、`Amending...`（正在追加提交...）。
- **提交策略与状态提示**：汉化 `Amend staged changes into the current commit`（将已暂存改动追加合并至当前提交）、`Stage and amend all changes into the current commit`（暂存并将所有改动追加合并至当前提交）、`No changes to amend`（没有可追加的改动）、`No commit to amend`（没有可追加的目标提交）以及冲突提示。

### 4. 通用设置中心高级区域重构深度适配
- **设置项集中收纳适配**：适配 2.13.0 将 `Best of N`、`CitC`、`Labs`（实验室）设置集中收纳至“通用设置 - 高级”区域的架构重构。
- **迁移引导与版本控制说明**：汉化各个模块的迁移引导长句（如“Best of N 设置已移至通用设置中的‘高级’区域。”）以及版本控制系统切换指引。

### 5. 产物与表格宽度自适应显示控制
- **显示尺寸偏好设置**：汉化产物显示新设置项：`Markdown Artifact Width`（Markdown 产物宽度）、`Configure the default width of markdown artifacts.`（配置 Markdown 产物的默认显示宽度。）、`Table Width`（表格宽度）。
- **布局模式选项**：汉化 `Fit to content`（适应内容）与 `Fit to width`（适应宽度）两种排版模式。

### 6. Windows 管理员权限 UAC 提升流程汉化
- **提权交互提示**：汉化 Windows 平台下终端命令的一次性提权交互：`Administrator access (UAC)`（管理员权限 (UAC)）、`Grant administrator access for`（授予管理员权限至）、`Grant one-time administrator access`（授予一次性管理员权限）、`Requesting a one-time administrator (UAC) elevation`（正在请求一次性管理员 (UAC) 权限提升）以及 `Yes, allow`（允许授权）。

### 7. 自然语言插件构建与自定义项视图分类
- **自然语言插件构建**：汉化 `Create plugin`（创建插件）、`Describe a plugin and the agent builds it`（描述插件功能，智能体将自动构建）。
- **自定义项视图分类标签**：汉化来源与安装状态标签：`由您安装`（Installed by you）、`随应用内置`（Bundled with the app）、`已在您的配置中列出`（Listed in your config）、`在此工作区中找到`（Found in this workspace）、`预置`（Pre-installed）、`内置`（Builtin）。
- **推荐技能开关**：汉化 `Enable recommended skills`（启用推荐技能）与 `Disable recommended skills`（禁用推荐技能）。

### 8. 会话置顶、暂存文件与比对器增强
- **会话置顶与分叉**：汉化 `Pin this conversation`（置顶此对话）、`Unpin this conversation`（取消置顶此对话）、`Rename this conversation`（重命名此对话）、`Forked conversation`（派生的对话）。
- **暂存文件面板**：汉化 `Scratch Files`（暂存文件）、`No scratch files`（暂无暂存文件）。
- **比对器空白字符切换**：汉化代码比对器中的 `Show Whitespace Changes`（显示空白字符变动）与 `Hide Whitespace Changes`（隐藏空白字符变动）。

### 9. 会话分屏 (Split)、派生 (Fork) 与分组管理全套汉化及菜单语法加固
- **分屏菜单全流程**：补全左侧会话 `Split`（分屏）及级联子菜单 `Split Right`（向右分屏）、`Split Down`（向下分屏）、`Replace With New`（替换为新建）、`Remove From Split`（从分屏中移除）、`Split Terminal`（拆分终端）、`Split Conversation Vertically`（垂直分屏对话）、`Split Conversation Horizontally`（水平分屏对话）、`Equalize Split Panes`（均分分屏窗格）。
- **会话派生与分组管理**：汉化 `Fork`（派生）、`Create fork in current/shared/new workspace`（在当前/共享/新建工作区创建派生）、`Move to Group`（移动到分组）、`New Group`（新建分组）、`Create Group`（创建分组）及相关自愈纠偏规则。
- **原生菜单解析稳定性**：修复 `menu.js` 原生菜单遍历语法闭合问题，杜绝 Electron 启动加载时的 AST 语法报错，保障启动稳定性。

---

## v2.12.2 (2026-09-08)

### 1. 全面适配 Antigravity v2.12.2 核心架构
- **更新词库与模型菜单**：适配 Gemini 3.8 Flash 与 2.12.2 企业级更新词库与模型选择菜单。
- **预置 MCP 生态全量汉化**：全量汉化设置中心 63 款官方与社区预置 MCP 服务卡片、长句说明及权限声明。

### 2. 斜杠命令（Slash Commands）与悬浮卡片汉化
- **命令菜单与悬浮卡片**：汉化斜杠命令浮动菜单（`/boost`、`/goal`、`/schedule`、`/browser`、`/grill-me`、`/plan`、`/teamwork-preview`、`/learn` 等）及其详细说明卡片。
- **原生触发符免疫保护**：严格保护原生触发字符（如 `boost`、`goal` 保持英文不被误译破坏）。

### 3. 上下文提及（@ Mention）菜单精准汉化与放行保护
- **上下文分类全量汉化**：汉化 `@` 触发的规则（Rules）、对话（Conversation）、文档（PDF Document）、提交（Git Commit）、差异（Git Diff）、目录（Directory）等全部分类项。
- **分类标签与文件名隔离**：建立标签放行与文件名保护机制，绝对保护项目代码文件名、扩展名与触发参数原生结构。

### 4. 通用设置项深层补齐
- **浏览器子智能体汉化**：补齐通用设置中浏览器子智能体（Browser Subagent）分段长句与实验室功能词条汉化。

### 5. 原生应用菜单与侧边栏会话交互体验提升
- **原生顶部菜单精准汉化**：顶部原生菜单 `Create Project`（创建项目）、`New Project`（新建项目）、`Open Project`（打开项目）、`Copy`（复制）等。
- **历史会话详情与复制子项**：侧边栏历史会话详情与复制子菜单汉化（`Copy trajectory ID`、`Trajectory Metadata` 等）。
- **悬停卡片动态更新时间与状态指示**：历史会话悬停预览卡片（Hover Card）更新时间（`Updated <time>` -> `更新于 <time>`）及多状态标签（`空闲`、`活跃`、`需要操作`、`未读`）深度汉化，并支持英文月份自动转换为地道中文日期。

---

## v2.12.0.1 (2026-09-04)

### 1. 模型思考链 (Thinking Process) 绝对物理隔离
- 彻底解决 AI 流式吐字时单词 token 命中分词逻辑导致中英杂糅的缺陷（如英文原句中 `Control` 误译为“控制”）。
- 双层精准过滤：彻底跳过 `.cursor-edit` 及思考正文包裹容器，杜绝任何正文词汇误篡改。
- 外部触发药丸保留汉化：`Thought for 4s` 汉化为 `思考了 4s`，`Thinking...` 汉化为 `正在思考...`。

### 2. 动态正则转义失真全量纠正
- 修复注入模板字符串中的双重反斜杠问题（`\\d`、`\\s`、`\\+` 误匹配字面量反斜杠），全面恢复数字与文件数变更等正则语义。
- 修正限额标题动态匹配 `\s+Limit\s+Remaining` 转义丢失问题。

### 3. 控制中心全景功能升级
- 新增亮色 / 暗色主题一键切换按钮（支持持久化记忆与系统主题跟随）。
- 新增在线 Release 词库检测按钮与红点徽标提示，一键获取 GitHub 最新补丁。
- 优化浅色模式下打包中的半透明遮罩与文案对比度，彻底修复白底白字无法看清问题。
- 增加“清除前端缓存”一键维护工具。
