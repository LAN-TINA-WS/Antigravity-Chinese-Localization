# Changelog

This document tracks all version releases, core architecture adaptations, and feature updates for Antigravity-Chinese-Localization.

---

## v2.15.0 (2026-09-19)

### 1. Comprehensive Adaptation to Antigravity v2.15.0 Architecture
- **Version Metadata & Updater Headers**: Bumped application definition to `2.15.0`, tracking Google official Sep 19 build and new updater request header specifications.
- **Localization Engine Full Inheritance**: Maintained 100% localization coverage across DOM mutation, Electron native menus, tray, and overlays.
- **Complete TDD Test Suite**: Added Ticket-10 test suite, passing all 239 automated test cases and 37 dist JS AST syntax check gates.

### 2. Custom Agent Controls & Default Tools Localization
- **Agent Prompts & Tools Controls**: Deeply translated custom agent controls: `Default tools`, `Default prompt sections`, `Switch off default tools`, `Switch off default prompts`, `Add back tools`.
- **Main Agent State & Fallback**: Translated `Main Agent`, `Main Agent (Default)`, and reset fallback interactions.

### 3. Project Picker, Prompts & Error Presentation
- **Project Picker Unbound State**: Translated `No Project` and `Working outside of a project`.
- **Malformed Tool Call Handling**: Translated compact model failure status `Invalid tool call`.
- **Binary File Error & Cancelled Command**: Translated clear binary reading errors `Cannot display binary file` and restart cancelled status `Command canceled`.

### 4. High-frequency UI Interactions, Accessibility Labels & Dynamic Templates
- **Conversation Feedback & Actions**: Translated `Good response`, `Bad response`, `More actions`, `More options`, `Pin conversation`, `Undo to this point`.
- **Code Block Actions & Floating Controls**: Translated `Copy code`, `At mention code block`, `Add inline comment`, `Fold code block`, `User message`, `Send message`.
- **Error Banners & Dynamic Templates**: Translated `Agent execution terminated due to error.` and added dynamic regex handlers for `See all (N)`, `Ran N commands`, `Load older messages, showing N of M`, and `Fold lines N-M`.

---

## v2.14.0 (2026-09-16)

### 1. Comprehensive Adaptation to Antigravity v2.14.0 Architecture
- **Version Metadata & Environment Seamless Upgrade**: Upgraded to 2.14.0, fully compatible with Google official Sep 16 release build.
- **Full Localization Engine Inheritance & Syntax Hardening**: Maintained 100% localization coverage across DOM mutation, Electron native application menus, tray, and splash overlays.
- **Full TDD Test Suite Validation**: Added Ticket-09 test suite, passing all 37 dist JS AST static syntax check gates.

---

## v2.13.0 (2026-09-13)

### 1. Comprehensive Adaptation to Antigravity v2.13.0 Architecture
- **Frontend Bundle Structure Adaptation**: Deep support for official 2.13.0 frontend build updates, extracting and localizing 116+ new interface strings.
- **Preload Injection Engine Synchronization**: Upgraded main renderer and install wizard preload injection modules, guaranteeing 100% coverage and high-framerate throughput.

### 2. Side Question & Questionnaire System In-depth Localization
- **Independent Side Question Flyout**: Localized new side questionnaire interactions: `Side Question`, `Side question answered.`, `View side question`, `Minimize side question`, `Delete side question`.
- **Questionnaire Form Controls**: Localized `Cancel questionnaire` and `Cancel questionnaire and stop the agent`.

### 3. Source Control Git Amend Flow Full Localization
- **Amend Capabilities**: Localized primary Amend actions: `Amend`, `Amending...`.
- **Commit Strategies & Status Notices**: Localized `Amend staged changes into the current commit`, `Stage and amend all changes into the current commit`, `No changes to amend`, `No commit to amend`, and conflict resolution notices.

### 4. General Settings Advanced Area Reorganization Adaptation
- **Settings Reorganization**: Adapted to 2.13.0 migration of `Best of N`, `CitC`, and `Labs` into General Settings -> Advanced.
- **Migration Guidance & VCS Notes**: Localized migration guidance sentences and version control selector notices.

### 5. Artifact & Table Width Display Customization
- **Display Preferences**: Localized `Markdown Artifact Width`, `Configure the default width of markdown artifacts.`, and `Table Width`.
- **Layout Modes**: Localized `Fit to content` and `Fit to width`.

### 6. Windows Administrator Elevation (UAC) Flow Localization
- **Elevation Interaction**: Localized Windows one-time UAC elevation notices: `Administrator access (UAC)`, `Grant administrator access for`, `Grant one-time administrator access`, `Requesting a one-time administrator (UAC) elevation`, and `Yes, allow`.

### 7. Natural Language Plugin Builder & Customization View Categorization
- **Plugin Builder**: Localized `Create plugin`, `Describe a plugin and the agent builds it`.
- **Customization View Category Tags**: Localized `Installed by you`, `Bundled with the app`, `Listed in your config`, `Found in this workspace`, `Pre-installed`, `Builtin`.
- **Recommended Skills Switch**: Localized `Enable recommended skills` and `Disable recommended skills`.

### 8. Conversation Pinning, Scratch Files & Diff Inspector Enhancements
- **Pinning & Forking**: Localized `Pin this conversation`, `Unpin this conversation`, `Rename this conversation`, `Forked conversation`.
- **Scratch Files Panel**: Localized `Scratch Files` and `No scratch files`.
- **Diff Inspector Whitespace Toggle**: Localized `Show Whitespace Changes` and `Hide Whitespace Changes`.

### 9. Split, Fork & Conversation Group Menu In-Depth Localization & Hardening
- **Split Submenus Flow**: Localized left sidebar conversation `Split`, `Split Right`, `Split Down`, `Replace With New`, `Remove From Split`, `Split Terminal`, `Split Conversation Vertically`, `Split Conversation Horizontally`, `Equalize Split Panes`.
- **Fork & Group Management**: Localized `Fork`, `Create fork in current/shared/new workspace`, `Move to Group`, `New Group`, `Create Group`, `Group By Project/Workspace`.
- **Native Menu Parsing Hardening**: Fixed `menu.js` recursive traversal closure issue to eliminate startup AST syntax errors in Electron.

---

## v2.12.2 (2026-09-08)

### 1. Comprehensive Adaptation to Antigravity v2.12.2 Architecture
- **Updated Lexicon & Model Menus**: Adapted Gemini 3.8 Flash and enterprise release notes and model selection menus.
- **Pre-installed MCP Ecosystem Full Localization**: Localized 63 official and community MCP service cards, descriptions, and permission notices in Settings.

### 2. Slash Commands & Floating Cards Localization
- **Commands & Popup Cards**: Localized slash commands (`/boost`, `/goal`, `/schedule`, `/browser`, `/grill-me`, `/plan`, `/teamwork-preview`, `/learn`, etc.) and descriptions.
- **Trigger Identifiers Protection**: Strict shielding for native trigger characters (e.g. `boost`, `goal` remain in English).

### 3. Context Mention (@ Mention) Menu Localization & Parameter Protection
- **Context Categories Full Localization**: Localized `@` trigger categories (Rules, Conversation, PDF Document, Commit, Diff, Directory, etc.).
- **Tagging & File Name Shielding**: Category whitelist and file extension isolation protecting project file names and arguments.

### 4. General Settings In-depth Completion
- **Browser Subagent Localization**: Completed segmented sentences and lab features for Browser Subagent settings.

### 5. Native Application Menu & Sidebar Experience Refinements
- **Native Top Menus**: Localized `Create Project`, `New Project`, `Open Project`, `Copy`, etc.
- **Conversation Details & Copy Submenus**: Localized `Copy trajectory ID`, `Trajectory Metadata`, etc.
- **Hover Card Timestamps & Multi-state Indicators**: Localized hover cards with dynamic update times (`Updated <time>` -> `更新于 <time>`) and status badges (`Idle`, `Active`, `Action Required`, `Unread`).

---

## v2.12.0.1 (2026-09-04)

### 1. Thinking Process Physical Containment
- Completely eliminated token-level mistranslation inside AI streaming thoughts.
- Double-layer filtering: safely bypassed `.cursor-edit` and thinking content blocks.
- Preserved action pills: `Thought for 4s` -> `思考了 4s`, `Thinking...` -> `正在思考...`.

### 2. Dynamic Regex Escaping Corrections
- Fixed template string double-escaping restoring numeric and file diff patterns.
- Restored escaped quota matching expressions.

### 3. Dashboard Enhancements
- Added persistent light/dark theme toggle.
- Added online GitHub Release check button and update indicator badge.
- Improved light mode modal contrast.
- Added one-click frontend cache cleaner.
