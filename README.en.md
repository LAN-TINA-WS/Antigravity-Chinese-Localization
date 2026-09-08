# Antigravity-Chinese-Localization

Deep Localization & High-Performance Chinese Patch for Google Antigravity

[中文](README.md) | English

[![GitHub release](https://img.shields.io/github/v/release/liominsb/Antigravity-Chinese-Localization?style=flat&color=blue)](https://github.com/liominsb/Antigravity-Chinese-Localization/releases/latest)
[![GitHub downloads](https://img.shields.io/github/downloads/liominsb/Antigravity-Chinese-Localization/total?style=flat&color=success)](https://github.com/liominsb/Antigravity-Chinese-Localization/releases)
[![GitHub stars](https://img.shields.io/github/stars/liominsb/Antigravity-Chinese-Localization?style=flat&color=gold)](https://github.com/liominsb/Antigravity-Chinese-Localization/stargazers)
[![Platform](https://img.shields.io/badge/Platform-Windows%20%7C%20macOS%20%7C%20Linux-blue)](https://github.com/liominsb/Antigravity-Chinese-Localization)
[![Package Size](https://img.shields.io/badge/ASAR%20Size-4.53%20MB%20(Official%20Standard)-success)](https://github.com/liominsb/Antigravity-Chinese-Localization)
[![Node Runtime](https://img.shields.io/badge/Node.js-%3E%3D%2014.0.0-informational)](https://nodejs.org/)
[![license](https://img.shields.io/github/license/liominsb/Antigravity-Chinese-Localization)](LICENSE)

A high-performance, non-destructive deep Chinese localization patch designed for Google Antigravity. Fully adapted to the latest architecture of **Antigravity v2.12.0+**, featuring fundamental computational refactoring and DOM micro-batch scheduling that delivers 1.68 million queries/sec throughput. It provides comprehensive translation for Planning Mode, System Settings, Security Sandbox, and Google Plugin Ecosystem, strictly follows the official 4.53 MB slim packaging standard, and guarantees absolute physical immunity for code editors and user input fields.

> [Download Latest Release](https://github.com/liominsb/Antigravity-Chinese-Localization/releases/latest) · [Issues & Feedback](https://github.com/liominsb/Antigravity-Chinese-Localization/issues)

---

## Core Feature Matrix

| Module | Capability | Description |
| :--- | :--- | :--- |
| Planning Mode | Full Lifecycle Translation | Translates Planning Mode toggles, Implementation Plans, Walkthrough reviews, Approval prompts, Open Questions, Proposed Changes, Automated Tests, and Manual Verification. |
| System Settings | 150+ Configuration Items | Translates Appearance (Light/Dark/System), Conversation Width (Compact/Medium/Wide/Full), Keep-awake, Background Running, Auto Updates, Command Approval Policies (Always Run/Review/Strict/Turbo), Storage and Cache Maintenance. |
| Security & Sandbox | Security Rules & Whitelists | Translates Terminal Sandbox modes, Command execution confirmation outside sandbox, Workspace file access rules (Allow/Ask/Deny), Network policies, Command whitelist/blacklist, Browser domain access whitelist. |
| Google Plugin Ecosystem | "Build with Google Plugins" | Deeply translates Plugin lifecycle operations (Install/Uninstall/Update/Enable/Disable), Component badges (Skills/Rules/MCP/Hooks), and official plugin descriptions (gemini-api, etc.). |
| Model & Reasoning Display | 100% Native English Kept | Follows developer ergonomics: Model selection dropdowns (Gemini 3.8 / Claude 3.7) and Thinking/Thought processes strictly retain native English without disruptive translations. |
| Extreme Computational Speed | 1.68 Million Queries/Sec | Precompiled $O(1)$ Hash Map, ASCII short-circuit, unified regex stream scanning, DOM ancestor pruning, and microtask scheduling ensure smooth 60fps/120fps display. |
| Slim Packaging | 4.53 MB Official Standard | Resolves package bloat by using `--unpack-dir` to exclude external Node modules, keeping the final asar aligned with the official standard size. |
| Hot Upgrade Engine | Seamless Patch Migration | Replaces the legacy `appendOnce` mechanism with `injectOrUpdate` truncation logic, allowing seamless one-click updates across versions. |
| Render Security & Input Immunity | Zero-Touch Code/Input Guard | Penetrates Shadow DOM to actively exempt `INPUT`, `TEXTAREA`, Monaco Code Editor, and user message bubbles, ensuring zero tampering with code or prompts. |
| Safe Backup & Restore | Lossless Bidirectional Switch | Automatically creates `app.asar.bak` on first run, enabling instant one-click rollback to pristine English at any time. |

---

## Quick Installation

### Method 0: Zero-Config Drop-in Replacement (Recommended, 5 Seconds)

No Node.js or build tools required:

1. Download the pre-built **`app.asar`** from [Releases](https://github.com/liominsb/Antigravity-Chinese-Localization/releases/latest);
2. Completely quit Antigravity;
3. Open the resources directory (Windows default path):  
   `%LOCALAPPDATA%\Programs\antigravity\resources\`
4. Overwrite the existing `app.asar` with the downloaded file and restart Antigravity.

---

### Method 1: Windows Users (Scripts & Dashboard)

#### 1. Web Dashboard (Recommended)
1. Download `default.zip` from Releases or clone repository, then extract;
2. Double-click **`双击运行汉化.bat`**;
3. The dashboard opens automatically (`http://localhost:3388`), auto-detects program status, and click "一键汉化" (One-Click Localize).

#### 2. Headless CLI Deployment
In your terminal, navigate to the folder and run:
```bash
node localize.js --now
```

---

### Method 2: Linux / Ubuntu Users

1. Open terminal, navigate to project directory, and run:
   ```bash
   ./运行汉化.sh
   ```
2. Open dashboard in browser and click "一键汉化", or deploy directly via headless CLI:
   ```bash
   node localize.js --now
   ```

---

### Method 3: macOS Users

1. Open terminal, grant execute permission, and launch:
   ```bash
   chmod +x 运行汉化.sh
   ./运行汉化.sh
   ```
2. Click "一键汉化" in the dashboard. The default path is `/Applications/Antigravity.app`.

> **macOS Code Signing Notice**:  
> Modifying the internal asar bundle breaks the original signature, and Gatekeeper may report "App is damaged". Run the following command in terminal to clear the quarantine flag:  
> ```bash
> xattr -cr /Applications/Antigravity.app
> ```

---

## Command Line Arguments

`localize.js` supports headless execution for automation or developer workflows:

```bash
# Execute localization immediately and exit
node localize.js --now

# Restore to pristine official English (using app.asar.bak)
node localize.js --restore

# Extract app.asar to extracted/ folder only
node localize.js --extract-only

# Repack from extracted/ folder to app.asar only
node localize.js --pack-only
```

---

## Developer Documentation

This project is not a simple string replacement script, but an industrial-grade localization engine operating between Electron's native rendering pipeline and React's virtual DOM reconciliation loop.

```text
[ Antigravity Launches ]
        │
        ├─► [ Native: dist/loadingOverlay.js ] ──► Localized loading splash screen
        ├─► [ Native: dist/menu.js & tray.js ] ──► Localized menus & system tray
        │
        └─► [ Web Container: dist/preload.js ]
                    │
                    ▼
        [ DOM_TRANSLATOR_INJECTION Core Engine ]
                    │
        ┌───────────┴───────────┐
        ▼                       ▼
  [ Compute: Precompiled Map ]   [ Scheduling: Microtasks & Pruning ]
  • Map O(1) instant lookup      • Unified word-boundary regex (CORE_WORDS_UNION_REGEX)
  • ASCII pure-Chinese bypass    • Ancestor Pruning (eliminates O(N^2) deep recursions)
  • WeakSet selective caching    • queueMicrotask high-fidelity frame scheduling
        │                       │
        └───────────┬───────────┘
                    │
        ┌───────────┴───────────────────────┐
        ▼                                   ▼
  [ Absolute Physical Immunity ]       [ Lifecycle Healing & Slicing ]
  • Monaco Code Editor isolated        • Ctrl + R reload lifecycle & placeholder protection
  • INPUT / TEXTAREA typing immune     • React split TextNode dynamic auto-stitching
  • Password-manager shield            • Leading regex repair for hybrid Chinese/English
```

Detailed architectural designs, benchmarks (1.68M qps), and engineering practices are available in [docs/](docs/):

| Document | Language | Core Technical Highlights |
| :--- | :--- | :--- |
| [architecture.md](docs/architecture.md) | 中文 | 基础算力层重构 ($O(1)$ Map 哈希与 ASCII 短路)、DOM 调度层优化 (联合流式正则与祖先剪枝)、`Ctrl+R` 重载生命周期自愈与 React 切片拼合、50,000 次压测基准数据、Shadow DOM 输入免疫与控制中心防篡改装甲 |
| [architecture.en.md](docs/architecture.en.md) | English | Deep engineering breakdown: $O(1)$ precompiled Map lookups, ASCII short-circuit, unified regex stream scanning, DOM ancestor pruning, queueMicrotask frame aggregation, 1.68M qps benchmark, lifecycle healing & input physical immunity |

---

## Changelog

### v2.12.2 (2026-09-08)
- **Comprehensive Adaptation to Antigravity v2.12.2 Architecture**:
  - Full support for Gemini 3.8 Flash, v2.12.2 enterprise release notes, and model selection menus.
  - Complete translation for all 63 official and community MCP service cards, descriptions, and permission dialogues in Settings.
- **Slash Commands & Floating Cards Localization**:
  - Full localization for slash commands (`/boost`, `/goal`, `/schedule`, `/browser`, `/grill-me`, `/plan`, `/teamwork-preview`, `/learn`, etc.) and their descriptive popup cards.
  - Strict protection for native trigger identifiers (e.g. keeping `boost`, `goal` intact).
- **Context Mention (@ Mention) Menu Localization & Parameter Protection**:
  - Precision localization for all `@` context categories: Rules, Conversation, PDF Document, Commit, Diff, Directory, etc.
  - Category-aware tagging and filename filtering to prevent altering project paths and arguments.
- **General Settings In-depth Completion**:
  - Completed segmented sentence and lab feature translations for Browser Subagent settings.
- **Native Application Menu & Sidebar Experience Refinements**:
  - Precision localization for top native menus (`Create Project`, `New Project`, `Open Project`, `Copy`, etc.).
  - Localization for sidebar conversation details and Copy submenus (`Copy trajectory ID`, `Trajectory Metadata`, etc.).
  - Deep localization for history conversation Hover Card update timestamps (`Updated <time>` -> `更新于 <time>`) and multi-state tags (`Idle`, `Active`, `Action Required`, `Unread`).

### v2.12.0.1 (2026-09-04)
- **Thinking Process Physical Immunity**:
  - Completely resolved the issue where streaming token generation triggered word-by-word dictionary matching, causing English text corruption (e.g. `Control` translated into Chinese inside sentences).
  - Dual-layer containment: explicitly skips `.cursor-edit` and thinking content sibling containers.
  - Preserves action pill localization: `Thought for 4s` localized to `思考了 4s`, `Thinking...` localized to `正在思考...`.
- **Regex Escaping Corrections**:
  - Fixed double backslash escaping in template injection (`\\d`, `\\s`, `\\+` matching literal backslashes) to restore correct numeric and file change matching.
  - Fixed lost escaping in quota title matching (`\s+Limit\s+Remaining`).
- **Dashboard Feature Enhancements**:
  - Added light/dark theme toggle button with persistent state and system preference following.
  - Added online GitHub Release check button and notification indicator for one-click updates.
  - Enhanced packaging modal contrast in light mode to fix unreadable white-on-light text.
  - Added one-click frontend cache cleaning utility.

---

## Frequently Asked Questions (FAQ)

### Q1: App fails to start or reports file access error after localization?
Ensure Antigravity is fully closed before running the script. Antigravity's Go backend (`language_server.exe`) may hold file locks in the background.  
Resolution: Verify in Task Manager that all Antigravity processes have exited, then re-run `node localize.js --now`.

### Q2: What if an official update overwrites the localization?
Official updates replace `app.asar`. Simply re-run:
```bash
node localize.js --now
```
The script will back up the new official file and inject the latest patch, or simply replace `app.asar` with the latest Release asset.

### Q3: How to cleanly uninstall and restore official English?
Click "还原英文原版" in the dashboard, or run:
```bash
node localize.js --restore
```
The script will restore the original file from `app.asar.bak`.

---

## Contributors & Open Source Collaboration

| Contributor | Role & Contributions |
| :--- | :--- |
| [liominsb](https://github.com/liominsb) | Original project creator, built the initial Electron asar injection and Web dashboard architecture |
| [LAN-TINA-WS](https://github.com/LAN-TINA-WS) | v2.12.0+ deep refactoring, computational & DOM scheduling performance leap (1.68M/s), 4.53MB slimming fix, hot-upgrade engine, lifecycle & slice auto-stitching, comprehensive Settings/Plugins dictionary expansion, and standalone maintenance |
| [Justin-Mai](https://github.com/Justin-Mai) | 2.0 Web dashboard architecture upgrade, multi-user/custom path support, heartbeat self-healing, code preview & diff isolation mechanisms |

- **Contributions**: Pull Requests and Issues reporting untranslated strings are welcome.

---

## License

This project is licensed under the [MIT License](LICENSE).
