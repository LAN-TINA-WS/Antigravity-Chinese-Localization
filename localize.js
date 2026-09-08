const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { exec, execSync, spawn } = require('child_process');

const CURRENT_VERSION = '2.12.2';

function compareVersions(v1, v2) {
  const parse = (v) => (v || '').replace(/^[vV]/, '').split('.').map(n => parseInt(n, 10) || 0);
  const p1 = parse(v1);
  const p2 = parse(v2);
  const maxLen = Math.max(p1.length, p2.length);
  for (let i = 0; i < maxLen; i++) {
    const a = p1[i] || 0;
    const b = p2[i] || 0;
    if (a > b) return 1;
    if (a < b) return -1;
  }
  return 0;
}

const PORT = 3388;
const WORKSPACE_DIR = __dirname;
const EXTRACT_DIR = path.join(WORKSPACE_DIR, 'extracted');

let logs = [];

function log(msg) {
  const time = new Date().toLocaleTimeString();
  const formatted = `[${time}] ${msg}`;
  logs.push(formatted);
  console.log(formatted);
}

function getHostUsername() {
  return process.env.USER || process.env.USERNAME || (process.platform === 'win32' ? '11215' : 'ranger');
}

function getAsarCmd() {
  const majorVersion = parseInt(process.versions.node.split('.')[0], 10);
  if (majorVersion >= 18) {
    return 'npx -y @electron/asar';
  } else {
    return 'npx -y asar@3.2.0';
  }
}

// Check if Antigravity processes are running
function isAppRunning() {
  try {
    if (process.platform === 'win32') {
      const output = execSync('tasklist', { encoding: 'utf-8' }).toLowerCase();
      return output.includes('antigravity.exe') || output.includes('language_server.exe');
    } else if (process.platform === 'darwin') {
      execSync('pgrep -xi "antigravity|language_server"', { stdio: 'ignore' });
      return true;
    } else {
      execSync('pgrep -x "antigravity|language_server"', { stdio: 'ignore' });
      return true;
    }
  } catch (e) {
    return false;
  }
}

// Kill Antigravity processes and its language_server background processes
function killApp() {
  log('正在尝试关闭运行中的 Antigravity 2.0 及相关后台进程...');
  try {
    if (process.platform === 'win32') {
      try { execSync('taskkill /F /IM Antigravity.exe', { stdio: 'ignore' }); } catch (e) {}
      try { execSync('taskkill /F /IM language_server.exe', { stdio: 'ignore' }); } catch (e) {}
    } else if (process.platform === 'darwin') {
      try { execSync('pkill -xi antigravity', { stdio: 'ignore' }); } catch (e) {}
      try { execSync('pkill -xi language_server', { stdio: 'ignore' }); } catch (e) {}
    } else {
      try { execSync('pkill -x antigravity', { stdio: 'ignore' }); } catch (e) {}
      try { execSync('pkill -x language_server', { stdio: 'ignore' }); } catch (e) {}
    }
    log('已成功强制解除 Antigravity 及其语言服务器进程占用！');
  } catch (e) {
    log('Antigravity 未在运行或关闭时无需操作。');
  }
}

// 安全清理 Antigravity 客户端的渲染与编译缓存（不删除用户配置与账号）
function cleanAppCache(username) {
  log('正在扫描并安全清理 Antigravity 临时渲染与编译缓存...');
  const defaultUser = getHostUsername();
  const user = username ? username.trim() : defaultUser;
  let cacheRootDirs = [];

  if (process.platform === 'win32') {
    cacheRootDirs = [
      path.join('C:\\Users', user, 'AppData', 'Roaming', 'Antigravity'),
      path.join('C:\\Users', user, 'AppData', 'Roaming', 'antigravity'),
      path.join('C:\\Users', user, 'AppData', 'Local', 'antigravity')
    ];
  } else if (process.platform === 'darwin') {
    cacheRootDirs = [
      path.join('/Users', user, 'Library', 'Application Support', 'Antigravity'),
      path.join('/Users', user, 'Library', 'Caches', 'com.google.antigravity')
    ];
  } else {
    cacheRootDirs = [
      path.join('/home', user, '.config', 'Antigravity'),
      path.join('/home', user, '.cache', 'antigravity')
    ];
  }

  const targetSubDirs = ['Cache', 'Code Cache', 'GPUCache', 'DawnGraphiteCache', 'DawnWebGPUCache', 'blob_storage'];
  let cleanedCount = 0;

  for (const root of cacheRootDirs) {
    if (!fs.existsSync(root)) continue;
    for (const sub of targetSubDirs) {
      const fullPath = path.join(root, sub);
      if (fs.existsSync(fullPath)) {
        try {
          if (typeof fs.rmSync === 'function') {
            fs.rmSync(fullPath, { recursive: true, force: true });
          } else {
            fs.rmdirSync(fullPath, { recursive: true });
          }
          cleanedCount++;
          log(`已清理临时缓存: ${sub} (${root})`);
        } catch (e) {
          log(`缓存正在占用中已跳过: ${sub}`);
        }
      }
    }
  }
  log(`缓存安全清理完成，共清理 ${cleanedCount} 处临时目录。建议重新启动软件。`);
  return cleanedCount;
}

// Compute standard app directory based on dynamic username or custom path input
function getAppDir(username, useDefault, customPath) {
  let dir = '';
  if ((useDefault === false || useDefault === 'false') && customPath) {
    dir = customPath.trim();
  } else {
    const isWin = process.platform === 'win32';
    const isMac = process.platform === 'darwin';
    const defaultUser = getHostUsername();
    const user = username ? username.trim() : defaultUser;
    if (isWin) {
      dir = `C:\\Users\\${user}\\AppData\\Local\\Programs\\antigravity`;
    } else if (isMac) {
      // macOS: /Applications/Antigravity.app/Contents/Resources/app.asar
      dir = `/Applications/Antigravity.app/Contents`;
    } else {
      dir = `/home/${user}/Antigravity/Antigravity-x64`;
    }
  }

  // macOS 特殊处理：如果路径指向 .app，自动补全 /Contents
  if (process.platform === 'darwin') {
    if (dir.endsWith('.app')) {
      dir = path.join(dir, 'Contents');
    } else if (dir.endsWith('.app/')) {
      dir = path.join(dir.slice(0, -1), 'Contents');
    }
  }
  return dir;
}

// 智能检测 Resources 目录大小写（macOS .app 包使用大写 Resources，Windows/Linux 使用小写 resources）
function getResourcesDir(appDir) {
  const upperPath = path.join(appDir, 'Resources');
  const lowerPath = path.join(appDir, 'resources');
  if (fs.existsSync(upperPath)) return upperPath;
  if (fs.existsSync(lowerPath)) return lowerPath;
  // 默认值：macOS 用大写，其他用小写
  return process.platform === 'darwin' ? upperPath : lowerPath;
}

// Web UI DOM Localization engine injection payload
const DOM_TRANSLATOR_INJECTION = `
// Antigravity 2.0 Chinese Localization Engine Enhanced
(function() {
  const dictionary = {
    // Top Bar & Menus
    "File": "文件",
    "Edit": "编辑",
    "View": "视图",
    "Selection": "选择",
    "Find": "查找",
    "Help": "帮助",
    "Docs": "文档",
    "Docs & API Reference": "文档与 API 参考",
    "Toggle Developer Tools": "开发者工具",
    "New Window": "新窗口",
    "Quit": "退出",
    "Cancel": "取消",
    "Confirm Quit": "确认退出",
    "Are you sure you want to quit?": "您确定要退出吗？",
    "There may be agents or background tasks running.": "可能还有智能体或后台任务正在运行。",
    "Welcome to the new Antigravity!": "欢迎使用全新 Antigravity！",
    "Antigravity has been redesigned to put agents first with new capabilities. If you'd still like a code editor, you can download it as a separate app named": "Antigravity 已经重构为以智能体为核心的全新平台。如果您仍需要代码编辑器，可以将其作为名为以下的独立应用下载：",
    "Antigravity IDE": "Antigravity IDE 编辑器",
    "Download the Antigravity IDE": "下载 Antigravity IDE",
    "Explore the new Antigravity": "探索全新 Antigravity",
    "Setting up…": "正在启动/设置中...",
    "Agent": "智能体",
    "Agents": "智能体",
    "Subagent": "子智能体",
    "Subagents": "子智能体",
    "Task": "任务",
    "Tasks": "任务",
    "Workspace": "工作区",
    "Workspaces": "工作区",
    "Command": "命令",
    "Run": "运行",
    "Settings": "设置",
    "Model": "模型",
    "Stop": "停止",
    "Approve": "批准",
    "Reject": "拒绝",
    "Terminal": "终端",
    "Output": "输出",
    "Codebase": "代码库",
    "Error": "错误",
    "Success": "成功",
    "Pending": "等待中",
    "Running": "运行中",
    "Completed": "已完成",
    "Failed": "已失败",
    "Branch": "分支",
    "Merge": "合并",
    "Conflict": "冲突",
    "Generate Image": "生成图像",
    "Web Search": "网页搜索",
    "Grep Search": "全局搜索",
    "Active Agents": "活跃智能体",
    "No agents running": "没有运行中的智能体",
    "active workspace": "活动工作区",
    "Active Workspace": "活动工作区",
    "Search": "搜索",
    "Search...": "搜索...",
    "Type a command...": "输入命令...",
    "Settings & Preferences": "设置与偏好",
    "General": "通用",
    "Themes": "主题",
    "Language": "语言",
    "Model Selection": "模型选择",
    "Advanced": "高级",
    "Developer": "开发者",
    "Save": "保存",
    "Close": "关闭",
    "Status": "状态",
    "Progress": "进度",
    "Logs": "日志",
    "Console": "控制台",
    "Running task...": "任务运行中...",
    "Task completed successfully": "任务成功完成",
    "An error occurred": "发生错误",
    "Connecting to Language Server...": "正在连接语言服务器...",
    "Language Server": "语言服务器",
    "Connected": "已连接",
    "Disconnected": "已断开",
    "Select a folder": "选择文件夹",
    "Open Folder": "打开文件夹",
    "Create New Project": "创建新项目",
    "Antigravity": "Antigravity",
    "Antigravity 2.0": "Antigravity 2.0",
    "Google DeepMind": "谷歌 DeepMind",
    "Advanced Agentic Coding": "高级智能体编码",
    "Welcome to Antigravity": "欢迎使用 Antigravity",
    "Get Started": "开始使用",
    "Create an agent to get started": "创建一个智能体以开始",
    "New Agent": "新建智能体",
    "Agent Name": "智能体名称",
    "System Prompt": "系统提示词",
    "Description": "描述",
    "Capabilities": "能力",
    "Write Files": "写入文件",
    "Run Commands": "运行命令",
    "Web Browsing": "网页浏览",
    "Define Subagents": "定义子智能体",
    "Call MCP Tools": "调用 MCP 工具",
    "Inherit Workspace": "继承工作区",
    "Branch Workspace": "分支隔离工作区",
    "Share Workspace": "共享工作区",
    "timer": "定时器",
    "Timers": "定时器",
    "Cron Jobs": "计划任务",
    "Schedule": "调度",
    "Directory analysis": "目录分析",
    "Web search": "网页搜索",
    "File edit": "文件编辑",
    "Command execution": "命令执行",
    "Semantic search": "语义搜索",

    // Added sentences & refined for user experience
    "Permissions": "权限",
    "Configure global allowed and denied resource permissions. Learn more.": "配置全局允许与拒绝的资源访问权限。了解更多。",
    "Configure global allowed and denied resource permissions.": "配置全局允许与拒绝的资源访问权限。",
    "Learn more.": "了解更多。",
    "Learn more": "了解更多",
    "Project-Specific Settings": "项目专属设置",
    "Project-Specific": "项目专属",
    "Modify scoped permissions, folders, and Agent settings like Sandbox and Terminal command execution.": "修改项目专属访问权限、工作文件夹以及智能体设置（例如沙盒和终端命令执行）。",
    "Modify scoped permissions, folders, and Agent settings": "修改项目专属访问权限、工作文件夹以及智能体设置",
    "like Sandbox and Terminal command execution.": "例如沙盒与终端命令执行。",
    "Go to Projects": "转到项目",
    "File Permissions": "文件权限",
    "File Access Rules": "文件访问规则",
    "Configure allowed and denied paths for file reads and writes.": "配置文件读写的允许与拒绝路径。",
    "Network Permissions": "网络权限",
    "Network Access Rules": "网络访问规则",
    "Configure allowed and denied URLs for reading.": "配置允许或禁止读取的 URL。",
    "Terminal & Tooling Permissions": "终端和工具权限",
    "Terminal Commands": "终端命令",
    "Configure allowed terminal commands.": "配置允许执行的终端命令。",
    "Commands Outside Sandbox": "沙盒外命令",
    "Configure allowed commands outside the sandbox.": "配置允许在沙盒外执行的终端命令。",
    "MCP Tools": "MCP 工具",
    "Tool Permissions": "工具权限",
    "Tool permissions": "工具权限",
    "工具 Permissions": "工具权限",
    "Configure external tools via Model Context Protocol.": "通过模型上下文协议 (MCP) 配置外部工具。",
    "Global": "全局",
    "Sandbox": "沙盒",
    "Sandbox enabled": "沙盒已启用",
    "Sandbox disabled": "沙盒已禁用",
    "Allowed": "已允许",
    "Denied": "已拒绝",
    "Paths": "路径",
    "URLs": "URL",
    "Tools": "工具",

    // Appearance & Settings
    "Appearance": "外观",
    "Configure the Agent's visual theme and display preferences.": "配置智能体的视觉主题与显示偏好。",
    "Chat Settings": "聊天设置",
    "Verbose Agent Chat": "显示智能体详细输出",
    "Display and preserve intermediate thinking steps": "显示并保留智能体中间思考过程",
    "Choose light, dark, or inherit system settings.": "选择浅色、深色，或继承系统设置。",
    "Dark": "深色",
    "Light": "浅色",
    "Light Theme": "浅色主题",
    "Preset": "预设",
    "Default Light": "默认浅色",
    "Background": "背景色",
    "Foreground": "前景色",
    "Accent": "强调色",
    "Dark Theme": "深色主题",
    "Default Dark": "默认深色",
    
    // Customizations
    "Customizations": "自定义",
    "Configure default behaviors, skills, and MCP servers.": "配置默认行为、技能以及 MCP 服务器。",
    "Token Usage": "Token 使用详情",
    "The breakdown below shows token usage from customizations like skills, rules, and MCP. If the budget is exceeded, large customizations will be truncated automatically.": "以下详情展示了来自技能、规则和 MCP 等自定义项的 Token 使用情况。如果额度超限，大型自定义内容将被自动截断。",
    "of the customization budget is available.": "的自定义额度可用。",
    "% of the customization budget is available.": "% 的自定义额度可用。",
    "% of the customization budget is available。": "% 的自定义额度可用。",
    "% of the customization budget is available": "% 的自定义额度可用。",
    "% of the budget is available.": "% 的自定义额度可用。",
    "% of the budget is available。": "% 的自定义额度可用。",
    "% of the customization budget is used.": "% 的自定义额度已使用。",
    "% of the customization budget is used。": "% 的自定义额度已使用。",
    "100.0% of the customization budget is available.": "100.0% 的自定义额度可用。",
    "No customizations found for this workspace.": "未找到此工作区的自定义项。",
    "Installed MCP Servers": "已安装的 MCP 服务器",
    "No MCP Servers": "无已安装的 MCP 服务器",
    "You currently don't have any MCP Servers installed.": "您当前未安装任何 MCP 服务器。",
    "Add an MCP server above": "在上方添加一个 MCP 服务器",
    // Build With Google Plugins & 官方插件生态
    "Build With Google Plugins": "使用 Google 插件构建",
    "Build with Google Plugins": "使用 Google 插件构建",
    "build with google plugins": "使用 Google 插件构建",
    "Google Plugins": "Google 插件",
    "Google plugins": "Google 插件",
    "Official Google plugins": "Google 官方插件",
    "Official Google plugins designed for Antigravity.": "专为 Antigravity 设计的 Google 官方扩展插件。",
    "Plugins are packaged collections of skills and MCPs to help the Agent in Antigravity work with Google developer products. You can always change your choices in Settings.": "插件是技能和 MCP 的打包集合，用于协助 Antigravity 中的智能体使用 Google 开发者产品。你可以随时在设置中更改你的选择。",
    "Plugins are packaged collections of skills and MCPs to help the Agent in Antigravity work with Google developer products. You can always change your choices in Settings": "插件是技能和 MCP 的打包集合，用于协助 Antigravity 中的智能体使用 Google 开发者产品。你可以随时在设置中更改你的选择",
    "Plugins are packaged collections of skills and MCPs to help the Agent in Antigravity work with Google developer products.": "插件是技能和 MCP 的打包集合，用于协助 Antigravity 中的智能体使用 Google 开发者产品。",
    "Plugins are packaged collections of skills and MCPs to help the Agent in Antigravity work with Google developer products": "插件是技能和 MCP 的打包集合，用于协助 Antigravity 中的智能体使用 Google 开发者产品",
    "You can always change your choices in Settings.": "你可以随时在设置中更改你的选择。",
    "You can always change your choices in Settings": "你可以随时在设置中更改你的选择",
    "Plugins are packaged collections of skills and MCPs to help the Agent in": "插件是技能和 MCP 的打包集合，用于协助智能体在",
    "Plugins are packaged collections of skills and MCPs to help the Agent in ": "插件是技能和 MCP 的打包集合，用于协助智能体在 ",
    "Antigravity work with Google developer products. You can always change your choices in Settings.": "Antigravity 中协同 Google 开发者产品工作。你可以随时在设置中更改你的选择。",
    "Antigravity work with Google developer products. You can always change your choices in Settings": "Antigravity 中协同 Google 开发者产品工作。你可以随时在设置中更改你的选择",
    "Antigravity work with Google developer products.": "Antigravity 中协同 Google 开发者产品工作。",
    "Antigravity work with Google developer products": "Antigravity 中协同 Google 开发者产品工作",
    "work with Google developer products. You can always change your choices in Settings.": "协同 Google 开发者产品工作。你可以随时在设置中更改你的选择。",
    "work with Google developer products. You can always change your choices in Settings": "协同 Google 开发者产品工作。你可以随时在设置中更改你的选择",
    "work with Google developer products.": "协同 Google 开发者产品工作。",
    "work with Google developer products": "协同 Google 开发者产品工作",
    "Plugins built and maintained by Google to extend Antigravity capabilities.": "由 Google 官方构建并维护，用于全面扩展 Antigravity 各项能力的插件。",
    "Explore, install, and manage plugins to enhance your agent with specialized skills, MCP servers, and rules.": "浏览、安装并管理插件，为智能体扩展专属技能、MCP 服务器与执行规则。",
    "Discover plugins to integrate with Google APIs, Cloud services, and developer tools.": "发现并集成适用于 Google API、云服务及开发者工具的官方插件。",
    "Install Plugin": "安装插件",
    "Uninstall Plugin": "卸载插件",
    "Enable Plugin": "启用插件",
    "Disable Plugin": "禁用插件",
    "Installed Plugins": "已安装插件",
    "Available Plugins": "可用插件",
    "All Plugins": "全部插件",
    "Featured Plugins": "精选插件",
    "Search plugins...": "搜索插件...",
    "Search plugins": "搜索插件",
    "No plugins found": "未找到相关插件",
    "No plugins installed": "尚未安装任何插件",
    "Loading plugins...": "正在加载插件列表...",
    "Failed to load plugins": "加载插件列表失败",
    "Reload plugins": "重新加载插件",
    "Check for plugin updates": "检查插件更新",
    "Plugin Settings": "插件设置",
    "Plugin details": "插件详情",
    "View details": "查看详情",
    "View Documentation": "查看文档",
    "View documentation": "查看文档",
    "Bundled Skills": "内置技能",
    "Bundled skills": "内置技能",
    "bundled skills": "内置技能",
    "Bundled Rules": "内置规则",
    "Bundled rules": "内置规则",
    "bundled rules": "内置规则",
    "Bundled MCP Servers": "内置 MCP 服务器",
    "Bundled MCP servers": "内置 MCP 服务器",
    "bundled MCP servers": "内置 MCP 服务器",
    "Bundled Hooks": "内置生命周期钩子",
    "bundled hooks": "内置生命周期钩子",
    "Skills included": "包含技能",
    "Rules included": "包含规则",
    "MCP servers included": "包含 MCP 服务器",
    "Hooks included": "包含钩子",
    "Author: Google": "作者: Google",
    "Browse and enable plugins from the Build With Google catalog.": "浏览并启用来自 Build With Google 目录的官方插件。",
    "Browse and enable plugins from the Build With Google catalog": "浏览并启用来自 Build With Google 目录的官方插件",
    "Use Add MCP to browse the store, or add a custom server via the MCP config.": "使用“添加 MCP”浏览应用商店，或通过 MCP 配置文件添加自定义服务器。",
    "Use Add MCP to browse the store, or add a custom server via the MCP config": "使用“添加 MCP”浏览应用商店，或通过 MCP 配置文件添加自定义服务器",
    "No MCP servers installed": "未安装任何 MCP 服务器",
    "Add MCP": "添加 MCP",
    "Open MCP Config": "打开 MCP 配置文件",
    "Guidelines for interacting with GitHub and request permissions from the user when commands fail due to restrictions in the agent environment.": "与 GitHub 交互的执行规范；当命令因智能体环境受限失败时，向用户提请权限确认的指南。",
    // 官方 Firebase 与 Google Cloud 扩展插件深度汉化
    "Skills and MCP servers for building with Firebase.": "用于基于 Firebase 构建应用的专属技能与 MCP 服务器。",
    "Skills and MCP servers for building with Firebase": "用于基于 Firebase 构建应用的专属技能与 MCP 服务器",
    "Skills and MCP servers for working with Google Cloud.": "用于在 Google Cloud 云平台上进行开发的技能与 MCP 服务器。",
    "Skills and MCP servers for working with Google Cloud": "用于在 Google Cloud 云平台上进行开发的技能与 MCP 服务器",
    "Configure agent execution, queued message delivery, and permissions.": "配置智能体执行策略、消息队列发送机制以及安全权限。",
    "Configure agent execution, queued message delivery, and permissions": "配置智能体执行策略、消息队列发送机制以及安全权限",
    "Configure 智能体 执行, queued 消息 delivery, and 权限。": "配置智能体执行策略、消息队列发送机制以及安全权限。",
    "Configure 智能体 执行, queued 消息 delivery, and 权限": "配置智能体执行策略、消息队列发送机制以及安全权限",
    "Use Build With Google Plugins": "使用 Google 插件构建",
    "Use Build with Google Plugins": "使用 Google 插件构建",
    "Use Build With Google Plugins to": "使用 Google 插件构建以",
    "queued message delivery": "消息队列发送",
    "queued message": "排队消息",
    "queued messages": "排队消息",

    // ===== 官方插件市场 (Build with Antigravity Plugins) 深度全量汉化 =====
    "Build with Antigravity Plugins": "使用 Antigravity 插件构建",
    "Build with Antigravity plugins": "使用 Antigravity 插件构建",
    "Build With Antigravity Plugins": "使用 Antigravity 插件构建",
    "Build with Antigravity 插件": "使用 Antigravity 插件构建",
    "Plugins are packaged collections of skills and MCPs to help the Agent in Antigravity work with Google developer products. You can always change your choices in Settings.": "插件是技能与 MCP 服务器的打包集合，用于帮助 Antigravity 中的智能体更好地协同 Google 开发者产品。您可以随时在设置中更改配置。",
    "Plugins are packaged collections of skills and MCPs to help the Agent in Antigravity work with Google developer products.": "插件是技能与 MCP 服务器的打包集合，用于帮助 Antigravity 中的智能体更好地协同 Google 开发者产品。",
    "You can always change your choices in Settings.": "您可以随时在设置中更改配置。",

    // 1. Android
    "Core tools and knowledge required to develop for Android.": "面向 Android 应用开发所需的核心工具集与专业领域知识。",
    "Core tools and knowledge required to develop for Android": "面向 Android 应用开发所需的核心工具集与专业领域知识",
    "Core 工具 and knowledge required to develop 持续 Android": "面向 Android 应用开发所需的核心工具集与专业领域知识",
    "develop for Android": "Android 应用开发",

    // 2. Modern Web Guidance
    "Modern Web Guidance": "现代 Web 开发指南",
    "Keep your coding agent up to date with the latest web best practices.": "让您的编码智能体紧跟最新的 Web 最佳实践与现代技术规范。",
    "Keep your coding agent up to date with the latest web best practices": "让您的编码智能体紧跟最新的 Web 最佳实践与现代技术规范",
    "Keep your coding 智能体 已是最新版本 with the latest web best practices。": "让您的编码智能体紧跟最新的 Web 最佳实践与现代技术规范。",
    "Keep your coding 智能体 已是最新版本 with the latest web best practices": "让您的编码智能体紧跟最新的 Web 最佳实践与现代技术规范",
    "latest web best practices": "最新的 Web 最佳实践",

    // 3. Google Antigravity SDK
    "Google Antigravity SDK": "Google Antigravity SDK",
    "Using the Antigravity Python SDK to build AI agents.": "使用官方 Antigravity Python SDK 构建自定义 AI 智能体。",
    "Using the Antigravity Python SDK to build AI agents": "使用官方 Antigravity Python SDK 构建自定义 AI 智能体",
    "Using the Antigravity Python SDK to build AI 智能体": "使用官方 Antigravity Python SDK 构建自定义 AI 智能体",
    "build AI agents": "构建 AI 智能体",

    // 4. Science
    "Science": "科学研究",
    "Curated collection of agent skills for science.": "专为科学计算、学术研究与实验探索精选的智能体技能集合。",
    "Curated collection of agent skills for science": "专为科学计算、学术研究与实验探索精选的智能体技能集合",
    "agent skills for science": "科学研究智能体技能",

    // 5. Firebase
    "Prototype, build & run modern apps users love with Firebase's backend, AI, and operational infrastructure.": "借助 Firebase 强大的后端、AI 与运维基础设施，原型设计、构建并运行深受用户喜爱的现代应用程序。",
    "Prototype, build & run modern apps users love with Firebase's backend, AI, and operational infrastructure": "借助 Firebase 强大的后端、AI 与运维基础设施，原型设计、构建并运行深受用户喜爱的现代应用程序",
    "backend, AI, and operational infrastructure": "后端、AI 与运维基础设施",

    // 6. Chrome DevTools
    "Reliable automation, in-depth debugging, and performance analysis in Chrome using Chrome DevTools and Puppeteer.": "在 Chrome 中结合 Chrome DevTools 与 Puppeteer，实现高可靠的自动化操作、深度调试与性能分析。",
    "Reliable automation, in-depth debugging, and performance analysis in Chrome using Chrome DevTools and Puppeteer": "在 Chrome 中结合 Chrome DevTools 与 Puppeteer，实现高可靠的自动化操作、深度调试与性能分析",
    "in-depth debugging, and performance analysis in Chrome": "在 Chrome 中进行深度调试与性能分析",

    // 7. Dart and Flutter
    "Dart and Flutter": "Dart 与 Flutter",
    "Skills providing tailored instructions for happy path Dart and Flutter development workflows.": "为流畅、标准的 Dart 与 Flutter 开发工作流提供定制化指令与实践技能。",
    "Skills providing tailored instructions for happy path Dart and Flutter development workflows": "为流畅、标准的 Dart 与 Flutter 开发工作流提供定制化指令与实践技能",
    "happy path Dart and Flutter development workflows": "标准的 Dart 与 Flutter 开发工作流",

    // 8. Google Maps Platform
    "Google Maps Platform": "Google Maps Platform",
    "Build and prototype location-aware applications with Google Maps Platform. Integrate interactive maps, search and inspect Places details, calculate optimal routes.": "基于 Google Maps Platform 构建并原型设计位置感知应用。支持集成交互式地图、搜索与查看地点详情、计算最优行车路线。",
    "Build and prototype location-aware applications with Google Maps Platform. Integrate interactive maps, search and inspect Places details, calculate optimal routes": "基于 Google Maps Platform 构建并原型设计位置感知应用。支持集成交互式地图、搜索与查看地点详情、计算最优行车路线",
    "Integrate interactive maps, search and inspect Places details, calculate optimal routes.": "集成交互式地图、搜索与查看地点详情、计算最优行车路线。",
    "Integrate interactive maps, search and inspect Places details, calculate optimal routes": "集成交互式地图、搜索与查看地点详情、计算最优行车路线",

    // 9. Data Agent Kit
    "Data Agent Kit": "数据智能体套件",
    "Data 智能体 Kit": "数据智能体套件",
    "Specialized suite of skills for data engineers and database practitioners on Google Cloud.": "专为 Google Cloud 上的数据工程师与数据库从业者打造的专业技能套件。",
    "Specialized suite of skills for data engineers and database practitioners on Google Cloud": "专为 Google Cloud 上的数据工程师与数据库从业者打造的专业技能套件",
    "data engineers and database practitioners on Google Cloud": "Google Cloud 数据工程师与数据库从业者",

    // 官方首发插件 (gemini-api 及扩展体系) 长句深度汉化
    "Build applications with the Gemini Interactions API and Live API, including text generation, multi-turn chat, streaming, function calling, managed agents, and real-time audio/video.": "使用 Gemini Interactions API 和 Live API 构建应用，包括文本生成、多轮对话、流式响应、函数调用、托管智能体以及实时音视频处理。",
    "Use this skill when building applications with Gemini API hosted models, including Gemini and Gemma 4, working with multimodal content (text, images, audio, video), implementing function calling, using structured outputs, or needing current model specifications. Covers SDK usage (google-genai for Python, @google/genai for JavaScript/TypeScript, com.google.genai:google-genai for Java, google.golang.org/genai for Go), model selection, and API capabilities.": "在使用 Gemini API 托管模型（包括 Gemini 与 Gemma 4）构建应用、处理多模态内容（文本/图像/音频/视频）、实现函数调用、使用结构化输出或需要当前模型规格时使用此技能。覆盖各主流语言 SDK 使用、模型选择及 API 核心能力。",
    "Use this skill when writing code that calls the Gemini API for text generation, multi-turn chat, multimodal understanding, image generation, video generation, streaming responses, background research tasks, function calling, structured output, or migrating from the old generateContent API. This skill covers the Interactions API, the recommended way to use Gemini models and agents in Python and TypeScript.": "在编写调用 Gemini API 进行文本生成、多轮对话、多模态理解、图像/视频生成、流式响应、后台调研、函数调用、结构化输出或从旧版迁移时使用此技能。本技能覆盖 Interactions API，这是在 Python 和 TypeScript 中使用 Gemini 模型与智能体的官方推荐方式。",
    "Use this skill when building real-time, bidirectional streaming applications with the Gemini Live API. Covers WebSocket-based audio/video/text streaming, voice activity detection (VAD), native audio features, function calling, session management, ephemeral tokens for client-side auth, live translation, and all Live API configuration options. SDKs covered - google-genai (Python), @google/genai (JavaScript/TypeScript).": "在通过 Gemini Live API 构建低延迟双向实时流式应用时使用此技能。覆盖基于 WebSocket 的音视频/文本流、语音活动检测 (VAD)、原生音频特性、函数调用、会话管理、客户端临时令牌认证、实时翻译及所有 Live API 配置项。",
    "Use this skill for generative video editing, text-to-video, image-referenced video generation, first-frame-to-video, first-and-last-frame transitions, and video extensions using Gemini Omni 1.1 Flash (gemini-omni-1.1-flash) via the official google-genai SDK. Includes workflows for pre-processing/optimizing high-resolution or long source videos with ffmpeg, stripping audio for full sound regeneration, and handling turn-by-turn video editing and parallel execution.": "在使用 Gemini Omni 1.1 Flash (gemini-omni-1.1-flash) 通过官方 google-genai SDK 进行生成式视频编辑、文生视频、图像参考视频生成、首尾帧过渡及视频拓展时使用此技能。包含使用 ffmpeg 预处理优化高分辨率源视频、音频分离以及多轮分步编辑工作流。",
    "How to render rich interactive HTML widgets inline in the chat or as standalone artifacts. Use this skill when you want to show the user diagrams, data visualizations, interactive controls, educational walkthroughs, or any rich visual content beyond plain text and markdown.": "如何在对话中以内联方式或作为独立工件渲染丰富的交互式 HTML 小部件。当需要向用户展示架构图表、数据可视化、交互式控件、教程回顾或超出纯文本与 Markdown 的丰富视觉内容时使用此技能。",
    "Comprehensive guide and reference for the Antigravity Customization System. Use to explain how customizations work, their loading priority, discovery mechanisms, and to guide the creation of skills, rules, plugins, hooks, and MCP servers.": "Antigravity 自定义扩展系统的完整指南与技术参考。用于阐述自定义项的工作机制、加载优先级、自动发现机制，并指导技能、规则、插件、钩子及 MCP 服务器的创建。",
    "Provides a comprehensive guide, quick reference, and sitemap for Google Antigravity (AGY), including the Antigravity CLI (agy), Antigravity 2.0, Antigravity IDE, Python SDK, slash commands, keybindings, and customizations (skills, rules, MCP, sidecars). Activate this skill when the user asks questions about how to use, configure, or customize Antigravity, AGY, the agy CLI, the Antigravity IDE, or Antigravity 2.0.": "提供 Google Antigravity (AGY) 的完整指南、速查参考与系统导航，涵盖 Antigravity CLI (agy)、Antigravity 2.0、Antigravity IDE、Python SDK、斜杠命令、快捷键及自定义扩展（技能、规则、MCP、Sidecar）。",
    // Account
    "Account": "账号",
    "Manage your plan, credentials, and general preferences.": "管理您的计划、凭据和常规偏好。",
    "Enable Telemetry": "启用遥测",
    "When toggled on, Antigravity collects usage data to help Google enhance performance and features.": "开启后，Antigravity 会收集匿名使用数据，以帮助 Google 持续改进性能和功能。",
    "Marketing Emails": "营销电子邮件",
    "Receive product updates, tips, and promotions from Google Antigravity via email.": "通过电子邮件接收来自 Google Antigravity 的产品更新、技巧与促销信息。",
    "Your Plan:": "您的计划：",
    "Your Plan: Google AI Pro": "您的计划：Google AI Pro",
    "You can upgrade to a Google AI Ultra plan to receive the highest rate limits.": "您可以升级到 Google AI Ultra 计划以获得更高额的使用速率限制。",
    "Email": "电子邮件",
    
    // Browser & App Settings
    "Browser Settings": "浏览器设置",
    "Configure the browser subagent. It requires Google Chrome to be installed. The browser subagent can be invoked by typing /browser in the conversation input box.": "配置浏览器子智能体。这需要安装 Google Chrome。可以在对话输入框中输入 /browser 来调用浏览器子智能体。",
    "Configure the browser subagent. It requires Google Chrome to be installed. The browser subagent can be invoked by typing": "配置浏览器子智能体。这需要安装 Google Chrome。可以通过输入",
    "in the conversation input box.": "在对话输入框中调用该子智能体。",
    "Browser Javascript Execution Policy": "浏览器 JavaScript 执行策略",
    "Controls whether the agent can run custom JavaScript to automate complex browser actions.": "控制智能体是否可以运行自定义 JavaScript 以自动化复杂的浏览器操作。",
    "Request Review": "需要人工审核",
    "Disabled": "已禁用",
    "Block all browser JavaScript execution.": "禁止执行所有浏览器 JavaScript。",
    "Prompt for approval before running browser scripts.": "在运行浏览器脚本前需人工批准。",
    "Allow full browser script execution without prompting.": "允许执行所有浏览器脚本（无需提示）。",
    "Actuation Permissions": "动作执行权限",
    "Browser Actuation Rules": "浏览器操作控制规则",
    "Configure allowed and denied URLs for browser actuation.": "配置允许或禁止浏览器执行动作的 URL 列表。",
    "App Settings": "应用设置",
    "Prevent Sleep": "防止计算机休眠",
    "Prevent the computer from sleeping while the app is running.": "在应用运行时防止计算机进入休眠状态。",
    "Keep In Menu Bar": "常驻系统托盘",
    "The app will be accessible from the menu bar and will keep running in the background when all windows are closed.": "关闭所有窗口后，应用将常驻菜单栏并在后台保持运行。",
    "Notifications": "通知",
    "Notification Settings": "通知设置",
    "To modify notification settings, open your operating system's system preferences.": "如需修改通知设置，请打开您操作系统的系统偏好设置。",

    // Agent Settings
    "Agent Settings": "智能体设置",
    "Security Preset": "安全预设",
    "Choose a predefined security preset for the agent. This controls terminal auto-execution policy, and file access policy.": "为智能体选择预定义的安全预设。这将控制终端自动执行策略和文件访问策略。",
    "Choose a predefined security preset for the agent.": "为智能体选择预定义的安全预设。",
    "This controls terminal auto-execution policy, and file access policy.": "这将控制终端自动执行策略和文件访问策略。",
    "Learn more about Default": "了解关于默认预设的更多信息",
    "Default": "默认",
    "Agent Behavior": "智能体行为",
    "Artifact Review Policy": "工件审核策略",
    "Specifies agent's behavior when asking for review on artifacts, which are documents it creates to enable a richer conversation experience.": "设置智能体在请求审核工件时的行为方式。工件是其为提供更丰富对话体验而创建的文档。",
    "Always Ask": "始终询问",
    "Local Permissions": "项目专属权限",
    "Inherits from global settings. Local permissions have higher priority.": "继承自全局设置。项目专属权限具有更高的优先级。",
    "Inherits from global settings.": "继承自全局设置。",
    "Local permissions have higher priority.": "项目专属权限具有更高的优先级。",
    "Danger Zone": "危险区域",
    "Delete Project": "删除项目",
    "Permanently delete this project and all of its conversations.": "永久删除当前项目及其包含的所有历史对话。",
    
    // Additional Agent Settings & Context Menu
    "Custom": "自定义",
    "Outside of folders file access policy": "文件夹外文件访问策略",
    "Configures how the agent tries to access files outside of its working folders.": "配置智能体如何尝试访问其工作文件夹外部的文件。",
    "Terminal command Auto execution": "终端命令自动执行",
    "Controls whether terminal commands require your approval before running.": "控制终端命令在运行前是否需要您批准。",
    "Require Review": "需要审核",
    "Add Context": "添加上下文",
    "Media": "媒体",
    "Mentions": "提及",
    "Actions": "操作",
    "Browser": "浏览器",
    "Worktree": "工作树",
    "Projects": "项目",
    "Review Changes": "审核更改",
    "Ask anything, @ to mention, / for actions": "输入任何问题，输入 @ 提及，/ 触发操作",
    "Ask anything, @to mention, /for actions": "输入任何问题，输入 @ 提及，/ 触发操作",
    "Ask anything, @ to mention, / for commands": "输入任何问题，输入 @ 提及，/ 触发命令",
    "Ask anything, @to mention, /for commands": "输入任何问题，输入 @ 提及，/ 触发命令",
    "Overview": "概览",
    "Artifacts": "工件",
    "Conversations": "对话",
    "Agent settings and permissions for conversations outside of projects.": "项目外部对话的智能体设置和权限配置。",
    "Not in Project": "不在项目中",
    "Manage project folders, agent settings, and permissions.": "管理项目文件夹、智能体设置和专属权限。",

    // Security Presets
    "Requires manual review for all terminal commands and file accesses outside of the working folders.": "运行终端命令以及访问工作区外的文件时，均需手动人工审核。",
    "Full Machine": "完整本机访问",
    "All terminal commands require review. The agent can read or write to any file in the machine.": "所有终端命令均需审核，智能体可读写本机上的任意文件。",
    "Unrestricted": "无限制模式",
    "Disables all safety barriers for maximal iteration velocity.": "禁用所有安全屏障以获得极致的迭代效率。",
    "Manually customize individual settings.": "手动自定义各项具体设置。",
    "Always Proceed": "自动继续",

    // Themes
    "One Light": "One 浅色",
    "Solarized Light": "Solarized 浅色",
    "One Dark Pro": "One 深色 Pro",
    
    // Models
    "Configure AI models and view your quota.": "配置 AI 模型并查看您的配额与可用点数。",
    "Refresh": "刷新",
    "Model Credits": "模型额度",
    "Enable AI Credit Overages": "允许 AI 额度超限使用",
    "When toggled on, Antigravity will use your AI credits to fulfill model requests once you're out of model quota. Antigravity will always use your model quota first before using AI credits.": "开启后，当您的免费配额耗尽时，Antigravity 将使用您的 AI 点数来满足请求。系统会优先扣除免费模型配额，配额不足时再使用点数。",
    "Model Quota": "模型配额",
    "View your available model quota and AI credits. Model quota refreshes periodically based on your plan. Enable AI Credit Overages to continue using models when your quota is exhausted.": "查看您的可用模型配额与 AI 账户额度。模型配额会根据您的订阅计划定期刷新。额度耗尽后，可开启 AI 额度超限使用以继续体验。",

    // Shortcuts & UI
    "Shortcuts": "快捷键",
    "Keyboard shortcuts for quick navigation and control.": "用于快速导航与控制的键盘快捷键。",
    "Recommended": "推荐",
    "Open Conversation Picker": "打开对话选择器",
    "Open File Search": "打开文件搜索",
    "Focus Input": "聚焦输入框",
    "New Conversation": "新建对话",
    "Navigation": "导航",
    "Go Back": "后退",
    "Go Forward": "前进",
    "File Picker": "文件选择器",
    "Scheduled Tasks": "计划任务",
    "Select Previous Conversation": "选择上一个对话",
    "Select Next Conversation": "选择下一个对话",
    "Open Settings": "打开设置",
    "Conversation": "对话",
    "Conversation History": "历史对话",
    "Conversation history": "历史对话",
    "Toggle Model Selector": "切换模型选择器",
    "Toggle Voice Recording": "切换录音",
    "Find in Pane": "在窗格中查找",
    "Layout Controls": "布局控制",
    "Toggle Sidebar": "切换侧边栏",
    "Toggle Auxiliary Pane": "切换辅助窗格",
    "Zoom In": "放大",
    "Zoom Out": "缩小",
    "Reset Zoom": "重置缩放",

    // Feedback
    "Provide Feedback": "提供反馈",
    "Feedback Type": "反馈类型",
    "Bug Report": "Bug 报告",
    "Feature Request": "功能请求",
    "Auth and Billing": "账号与计费",
    "General Feedback": "常规反馈",
    "Please describe the feature you'd like to see. The more detailed the requirements, the easier it will be for our team to incorporate your ideas. Some helpful information includes:": "请描述您希望获得的新功能。需求描述越详尽，我们的团队就越容易采纳您的想法。以下是一些建议提供的信息：",
    "What is missing in your workflow": "您的工作流中缺少了什么",
    "What you would like to see to address this gap in your workflow": "您希望通过什么功能来解决这一需求",
    "How this feature would help you and other users": "此功能如何帮助您和其他用户",
    "Describe the feature you would like to see...": "请描述您希望获得的新功能...",
    "Attach a screenshot (optional)": "添加屏幕截图（可选）",
    "Attach Antigravity server logs": "附带 Antigravity 服务器日志",
    "Send feedback as": "发送反馈身份",
    "We recommend attaching logs. Attaching logs will help the Antigravity team act on and prioritize your feedback.": "我们建议附带日志。这将有助于 Antigravity 团队更快速、更有针对性地处理您的问题。",

    // Automatic Update Menus
    "Checking for Updates...": "正在检查更新...",
    "Downloading Update...": "正在下载更新...",
    "Restart to Update": "重启以应用更新",
    "Check for Updates": "检查更新",
    "No updates available": "当前已是最新版本",
    "Update available": "发现新版本",
    "Downloading...": "正在下载...",
    "Update downloaded": "更新已下载完成",
    "Error checking for updates": "检查更新失败",

    // ===== 2.2.1 新增 UI 文本补充 =====
    // 窗口与原生 UI
    "Window": "窗口",
    "Install IDE": "安装 IDE",
    "App": "应用",

    // 偏好设置区
    "Inherits from": "继承自",
    "Rules": "规则",
    "Skills": "技能",
    "Plugin": "插件",
    "Plugins": "插件",
    "Customize": "自定义",
    "Setup": "设置",

    // 账号区
    "Google AI Pro": "Google AI Pro",
    "Upgrade": "升级",
    "Sign Out": "退出登录",
    "By using this app, you agree to its": "使用本应用即表示您同意其",
    "Terms of Service": "服务条款",
    "Google Drive integration not available": "Google 云端硬盘集成不可用",

    // 外观与编辑器
    "Select light, dark, or inherit system settings.": "选择浅色、深色，或继承系统设置。",
    "Configure editor-specific behaviors and shortcuts.": "配置编辑器专属行为与快捷键。",
    "Tab": "制表符",
    "Configure tab completion, suggestions, and navigation behavior.": "配置 Tab 补全、建议以及导航行为。",

    // 编辑器与市场
    "Marketplace": "扩展市场",
    "Marketplace Item URL": "扩展市场项目 URL",
    "Marketplace Gallery URL": "扩展市场图库 URL",
    "Changes the base URL on each extension page. You must restart Antigravity to use the new marketplace after changing this value.": "更改每个扩展页面的基础 URL。更改此值后，必须重启 Antigravity 才能使用新的扩展市场。",
    "Changes the base URL for marketplace search results. You must restart Antigravity to use the new marketplace after changing this value.": "更改扩展市场搜索结果的基础 URL。更改此值后，必须重启 Antigravity 才能使用新的扩展市场。",
    "To modify editor settings, open Settings within the editor window.": "如需修改编辑器设置，请在编辑器窗口中打开“设置”。",
    "Editor": "编辑器",
    "Editor Settings": "编辑器设置",
    "Open Editor Settings": "打开编辑器设置",

    // 浏览器子智能体
    "Configure the browser subagent.": "配置浏览器子智能体。",
    "It requires": "它需要",
    "Google Chrome to be installed.": "安装 Google Chrome。",
    "The browser subagent can be invoked by typing": "可以通过输入",
    "/browser": "/browser",
    "in the conversation input box.": "在对话输入框中调用浏览器子智能体。",

    // 对话区
    "Conversation Width": "对话宽度",
    "Configure the maximum width of the conversation panel.": "配置对话面板的最大宽度。",
    "New Conversation in Project": "项目内新建对话",
    "Show": "显示",
    "all": "全部",

    // 分解统计
    "breakdown": "明细",
    "breakdowns": "明细",

    // Google Chat / Jetski
    "Configure a chat bot so you can use Jetski directly from Google Chat.": "配置一个聊天机器人，以便您可以直接在 Google Chat 中使用 Jetski。",
    "Jetski Chat": "Jetski 聊天",
    "Setup Jetski Chat": "设置 Jetski 聊天",
    "Bot Name": "机器人名称",
    "Avatar URL": "头像 URL",
    "Enter bot name (optional)": "输入机器人名称（可选）",
    "Enter avatar URL (optional)": "输入头像 URL（可选）",
    "Chat Space": "聊天空间",
    "Continue to help, visit": "如需继续获取帮助，请访问",

    // 反馈区
    "Please describe the issue in detail. The more actionable your feedback, the quicker our team can address your request. Some helpful information includes:": "请详细描述您遇到的问题。反馈越具可操作性，我们的团队就能越快处理您的请求。以下是一些有用的信息：",
    "Steps to reproduce the issue": "问题复现步骤",
    "Expected behavior": "预期行为",
    "Actual behavior": "实际行为",
    "Any relevant information": "任何相关信息",
    "Any error messages": "任何错误消息",
    "Steps to Reproduce": "复现步骤",
    "Submit": "提交",
    "Describe the bug you encountered...": "请描述您遇到的 Bug...",
    "Please list the steps to reproduce the issue": "请列出复现该问题的步骤",

    // 通知与其他
    "Manage your notification preferences.": "管理您的通知偏好。",
    "Manage application settings.": "管理应用设置。",
    "Refresh quota and credits data": "刷新配额与额度数据",

    // 权限与提示
    "Local permissions have higher priority.": "项目专属权限具有更高的优先级。",
    "No conversations yet": "暂无对话",
    "No conversation yet": "暂无对话",
    "of the customization budget is available.": "的自定义额度可用。",

    // MCP 相关
    "Add MCP": "添加 MCP",
    "Add an MCP Server": "添加 MCP 服务器",

    // 单词补充(2.2.1 新出现的)
    "width": "宽度",
    "priority": "优先级",
    "quota": "配额",
    "credits": "额度",
    "preference": "偏好",
    "preferences": "偏好",
    "application": "应用",
    "subagent": "子智能体",
    "notification": "通知",
    "notifications": "通知",
    "bot": "机器人",
    "space": "空间",
    "visit": "访问",
    "editor": "编辑器",
    "marketplace": "扩展市场",
    "avatar": "头像",
    "name": "名称",
    "messages": "消息",
    "message": "消息",

    // ===== 第2轮验证新增 (2.2.1 配额/限额/aria-label) =====
    "Weekly Limit": "每周限额",
    "Five Hour Limit": "五小时限额",
    "Hourly Limit": "每小时限额",
    "Daily Limit": "每日限额",
    "Monthly Limit": "每月限额",
    "limit": "限额",
    "limits": "限额",
    "weekly": "每周",
    "hourly": "每小时",
    "customization": "自定义",
    "budget": "额度",
    "available": "可用",

    // 浏览器设置残片补全
    "to be installed.": "需要安装。",
    "to be installed": "需要安装",
    "or join the": "或加入",

    // aria-label 无障碍标签 (这些会影响屏幕阅读器与提示)
    "Sidebar": "侧边栏",
    "Display Options": "显示选项",
    "Message input": "消息输入框",
    "Record voice memo": "录制语音备忘",
    "Typeahead menu": "预输入菜单",
    "voice memo": "语音备忘",
    "memo": "备忘",
    "typeahead": "预输入",

    // ===== 第3轮验证补充 =====
    "current": "当前",
    "Choose a model": "选择模型",
    "Select model": "选择模型",
    "current model": "当前模型",

    // ===== 第4轮验证补充 (显示选项下拉菜单) =====
    "Group By": "分组方式",
    "Last Updated": "最后更新",
    "Alphabetical (A-Z)": "字母顺序 (A-Z)",
    "Date Added": "添加日期",
    "Subtitles": "副标题",
    "No Subtitle": "无副标题",
    "Filter": "筛选",
    "Scheduled": "已计划",
    "Environment": "环境",
    "None": "无",
    "Fast": "快速",

    // 第5轮: 单数形式补全 (分组选项)
    "Project": "项目",
    "project": "项目",
    "projects": "项目",
    "Conversation": "对话",
    "conversation": "对话",
    "Workspace": "工作区",
    "workspace": "工作区",

    // ===== 第6轮彻底验证补充 =====
    // 窗口控制
    "Minimize": "最小化",
    "Maximize": "最大化",
    "Back": "返回",
    // 计划任务
    "No scheduled tasks configured.": "暂无已配置的计划任务。",
    // 配额提示 (含动态时间,用部分匹配)
    "You have used some of your weekly limit": "您已使用部分每周限额",
    "You have used some of your weekly limit.": "您已使用部分每周限额。",
    "You have used some of your 5-hour limit": "您已使用部分 5 小时限额",
    "You have used some of your 5-hour limit.": "您已使用部分 5 小时限额。",
    "You have used some of your Five Hour Limit": "您已使用部分 5 小时限额",
    "You have used some of your five-hour limit": "您已使用部分 5 小时限额",
    "You have used some of your five hour limit": "您已使用部分 5 小时限额",
    "it will fully refresh in": "它将在以下时间后完全刷新：",
    "hours": "小时",
    "minutes": "分钟",
    "days": "天",
    // 文件夹与权限
    "Folders": "文件夹",
    "folders": "文件夹",
    "including": "包括",
    "Allow/deny agent read access to specific files or directories.": "允许/拒绝智能体读取特定文件或目录。",
    "Allow/deny agent write access to specific files or directories.": "允许/拒绝智能体写入特定文件或目录。",
    "Allow/deny": "允许/拒绝",
    "read access": "读取权限",
    "write access": "写入权限",
    "specific files or directories": "特定文件或目录",
    // 浏览器子智能体说明(完整句)
    "The browser subagent can be invoked by typing /browser in the conversation input box.": "可以在对话输入框中输入 /browser 来调用浏览器子智能体。",

    // ===== 第7轮验证补充 (项目/文件夹状态提示) =====
    "Missing": "缺失",
    "Missing folder": "缺失文件夹",
    "Missing Folder": "缺失文件夹",
    "does not exist": "不存在",
    "not found": "未找到",
    "Not Found": "未找到",
    "No longer available": "已不可用",
    "Path": "路径",

    // ===== Antigravity 2.12.0+ 深度汉化补充 =====
    // 规划模式 (Planning Mode)
    "Planning Mode": "规划模式",
    "planning mode": "规划模式",
    "Planning Mode is ON": "规划模式已开启",
    "Planning Mode is OFF": "规划模式已关闭",
    "Implementation Plan": "实施计划",
    "implementation plan": "实施计划",
    "implementation_plan.md": "实施计划.md",
    "Walkthrough": "变更回顾",
    "walkthrough": "变更回顾",
    "walkthrough.md": "变更回顾.md",
    "User Review Required": "需用户审批",
    "Open Questions": "待确认问题",
    "Proposed Changes": "拟定变更",
    "Verification Plan": "验证计划",
    "Automated Tests": "自动化测试",
    "Manual Verification": "手动验证",
    "Proceed": "继续执行",
    "Plan Execution": "计划执行",
    "Approve Plan": "批准计划",
    "Reject Plan": "拒绝计划",
    "Plan approved": "计划已批准",
    "Plan rejected": "计划已拒绝",
    "Creating plan...": "正在生成计划...",
    "Updating plan...": "正在更新计划...",
    "Reviewing plan...": "正在审核计划...",
    "Implementation plan created": "实施计划已创建",
    "Implementation plan updated": "实施计划已更新",
    "Exit Planning Mode": "退出规划模式",
    "Enter Planning Mode": "进入规划模式",
    "Plan Mode": "规划模式",
    "Plan": "计划",
    "Goal Description": "目标描述",
    "Component Name": "组件名称",

    "Default model": "默认模型",
    "Inherit model": "继承模型",
    "Select a model": "选择模型",
    "Model tier": "模型级别",
    "Remaining tokens": "剩余 Token",
    "Remaining": "剩余",
    "remaining": "剩余",
    "Weekly limit remaining": "每周限额剩余",
    "Weekly limit Remaining": "每周限额剩余",
    "Weekly Limit Remaining": "每周限额剩余",
    "5-hour limit remaining": "5 小时限额剩余",
    "5-hour limit Remaining": "5 小时限额剩余",
    "5-Hour Limit Remaining": "5 小时限额剩余",
    "Five Hour Limit Remaining": "5 小时限额剩余",
    "Five Hour Limit remaining": "5 小时限额剩余",
    "Five hour limit remaining": "5 小时限额剩余",
    "Five-Hour Limit Remaining": "5 小时限额剩余",
    "Five-hour limit remaining": "5 小时限额剩余",
    "Five Hour Limit": "5 小时限额",
    "Five hour limit": "5 小时限额",
    "Five-Hour Limit": "5 小时限额",
    "Five-hour limit": "5 小时限额",
    "每周限额 Remaining": "每周限额剩余",
    "五小时限额 Remaining": "5 小时限额剩余",
    "Weekly limit": "每周限额",
    "weekly limit": "每周限额",
    "Weekly Limit": "每周限额",
    "5-hour limit": "5 小时限额",
    "5-Hour Limit": "5 小时限额",
    "Claude and GPT models": "Claude 与 GPT 模型",
    "Claude and GPT Models": "Claude 与 GPT 模型",
    "Claude and GPT 模型": "Claude 与 GPT 模型",
    "Gemini models": "Gemini 模型",
    "Gemini Models": "Gemini 模型",

    // 会话管理与右键/操作菜单 (Conversation Management & Context Menu)
    "Rename": "重命名",
    "rename": "重命名",
    "Mark Unread": "标记为未读",
    "Mark unread": "标记为未读",
    "mark unread": "标记为未读",
    "Mark as Unread": "标记为未读",
    "Mark as unread": "标记为未读",
    "Mark Read": "标记为已读",
    "Mark read": "标记为已读",
    "mark read": "标记为已读",
    "Mark as Read": "标记为已读",
    "Mark as read": "标记为已读",
    "Pin": "置顶",
    "pin": "置顶",
    "Unpin": "取消置顶",
    "unpin": "取消置顶",
    "Archive": "归档",
    "archive": "归档",
    "Unarchive": "取消归档",
    "unarchive": "取消归档",
    "Copy Conversation Name": "复制对话名称",
    "Copy conversation name": "复制对话名称",
    "Copy Conversation ID": "复制对话 ID",
    "Copy conversation id": "复制对话 ID",
    "Copy Project Name": "复制项目名称",
    "Copy project name": "复制项目名称",
    "Copy Terminal": "复制终端命令",
    "Copy terminal": "复制终端命令",
    "Copy terminal command": "复制终端命令",
    "Conversation name": "对话名称",
    "Conversation Name": "对话名称",
    "Delete Conversation": "删除对话",
    "delete conversation": "删除对话",

    // 多智能体协同与子智能体 (Subagents & Teamwork)
    "Teamwork": "团队协作",
    "teamwork": "团队协作",
    "Manage Subagents": "管理子智能体",
    "manage subagents": "管理子智能体",
    "Active Subagents": "活跃子智能体",
    "Invoke subagent": "调用子智能体",
    "Define subagent": "定义子智能体",
    "Kill subagent": "终止子智能体",
    "Kill all": "终止全部",
    "Waiting for input": "等待输入",
    "Waiting for dependents": "等待依赖任务",
    "Waiting for message": "等待消息",
    "Canceling": "正在取消",
    "Errored": "发生错误",
    "Idle": "空闲",
    "Unspecified": "未指定",
    "Research Agent": "调研智能体",
    "Codebase Researcher": "代码库调研员",
    "Conversation ID": "对话 ID",
    "Conversation transcript": "对话记录",
    "Transcript logs": "转录日志",
    "Reactive Wakeup": "响应式唤醒",
    "No polling needed": "无需轮询",
    "Subagent conversation": "子智能体对话",
    "Parent agent": "父智能体",
    "Child agent": "子智能体",

    // 工作区隔离与分支模式
    "Branch Workspace": "分支隔离工作区",
    "Share Workspace": "共享工作区",
    "Inherit Workspace": "继承工作区",
    "Isolated branch": "隔离分支",
    "Shared repository": "共享仓库",
    "Workspace directory permissions": "工作区目录权限",
    "Active workspace": "活动工作区",
    "Switch workspace": "切换工作区",
    "Add folder to workspace": "添加文件夹到工作区",
    "Remove from workspace": "从工作区移除",

    // MCP 与扩展工具体系
    "MCP Servers": "MCP 服务器",
    "MCP Server": "MCP 服务器",
    "MCP Tools": "MCP 工具",
    "Call MCP Tools": "调用 MCP 工具",
    "Active MCPs": "活跃 MCP 服务",
    "Connectors": "连接器",
    "Configure MCP server": "配置 MCP 服务器",
    "Inspect parameters": "检查参数",
    "Tool execution": "工具执行",
    "Tool call": "工具调用",
    "Tool calls": "工具调用",
    "Tool summary": "工具摘要",
    "Tool action": "工具操作",
    "Built-in tools": "内置工具",
    "External tools": "外部工具",
    "Running command": "运行命令",
    "Analyzing directory": "分析目录",
    "Analyzed directory": "分析目录",
    "analyzed directory": "分析目录",
    "Analyzed": "分析",
    "analyzed": "分析",
    "Searching the web": "搜索网页",
    "Editing file": "编辑文件",
    "Viewing file": "查看文件",
    "Semantic searching": "语义搜索",

    // 权限控制与沙盒增强
    "Sandbox": "沙盒",
    "Sandboxed": "沙盒内",
    "Unsandboxed": "沙盒外",
    "Commands Outside Sandbox": "沙盒外命令",
    "Terminal & Tooling Permissions": "终端与工具权限",
    "Network Access Rules": "网络访问规则",
    "File Access Rules": "文件访问规则",
    "Allowed paths": "允许路径",
    "Denied paths": "拒绝路径",
    "Allowed commands": "允许命令",
    "Denied commands": "拒绝命令",
    "Allowed URLs": "允许的 URL",
    "Denied URLs": "拒绝的 URL",
    "Always allow": "总是允许",
    "Ask every time": "每次询问",
    "Deny by default": "默认拒绝",
    "Allowlist": "白名单",
    "Denylist": "黑名单",
    "Global permissions": "全局权限",
    "Project permissions": "项目权限",

    // 定时任务与调度 (Schedule & Cron)
    "Schedule": "计划调度",
    "One-shot timer": "单次定时器",
    "Recurring cron": "循环定时任务",
    "Cron expression": "Cron 表达式",
    "Duration in seconds": "持续秒数",
    "Max iterations": "最大执行次数",
    "Timer condition": "定时条件",
    "Early termination": "提前终止",
    "Any message": "任何消息",
    "Specific sender": "特定发送者",
    "Expired": "已过期",

    // 自定义技能与规则 (Customizations & Skills)
    "Customizations": "自定义配置",
    "Skills": "技能",
    "Skill": "技能",
    "Rules": "规则",
    "Rule": "规则",
    "Plugins": "插件",
    "Sidecars": "伴生进程 (Sidecars)",
    "Hooks": "钩子",
    "App Data Directory": "应用数据目录",
    "Artifact": "工件",
    "Artifacts": "工件",
    "Artifact metadata": "工件元数据",

    // 通用界面与交互
    "Loading Antigravity": "正在加载 Antigravity...",
    "Setting up…": "正在启动/设置中...",
    "Setting up...": "正在启动/设置中...",
    "Recent Workspaces": "最近工作区",
    "Clear Cache": "清除缓存",
    "Reset Settings": "重置设置",
    "Log Out": "退出登录",
    "Sign In": "登录",
    "Sign in with Google": "使用 Google 账号登录",
    "Signed in as": "当前登录为",
    "Check for Updates": "检查更新",
    "Checking for Updates...": "正在检查更新...",
    "Downloading Update...": "正在下载更新...",
    "Restart to Update": "重启以应用更新",
    "Up to date": "已是最新版本",
    "New version available": "有新版本可用",
    "Automatic 检查更新": "自动检查更新",
    "Automatic check for updates": "自动检查更新",
    "Automatic Check for Updates": "自动检查更新",
    "Automatic Updates": "自动更新",
    "Automatic updates": "自动更新",
    "Automatically prompt you to restart the app when a new update is available. When disabled, you can check for updates manually from the app menu.": "当有新版本可用时，自动提示您重启应用以完成更新。禁用后，您仍可通过应用菜单手动检查更新。",
    "Automatically prompt you to restart the app when a new update is available. When disabled, you can check for updates manually from the app menu": "当有新版本可用时，自动提示您重启应用以完成更新。禁用后，您仍可通过应用菜单手动检查更新",
    "Automatically prompt you to restart the app when a new update is available.": "当有新版本可用时，自动提示您重启应用以完成更新。",
    "Automatically prompt you to restart the app when a new update is available": "当有新版本可用时，自动提示您重启应用以完成更新",
    "When disabled, you can check for updates manually from the app menu.": "禁用后，您仍可通过应用菜单手动检查更新。",
    "When disabled, you can check for updates manually from the app menu": "禁用后，您仍可通过应用菜单手动检查更新",
    "Copy code": "复制代码",
    "Copied!": "已复制！",
    "Copied": "已复制",
    "Collapse": "折叠",
    "Expand": "展开",
    "Show more": "显示更多",
    "Show less": "显示更少",
    "Details": "详情",
    "Overview": "概览",

    // ===== 对话流步骤标签与执行状态 (用户定制方案 3) =====
    "Ran": "运行",
    "ran": "运行",
    "Running": "运行中",
    "Thought": "思考过程",
    "thought": "思考过程",
    "Thinking...": "思考中...",
    "thinking...": "思考中...",
    "Thinking": "思考中",
    "thinking": "思考中",
    "Explored": "检索",
    "explored": "检索",
    "Exploring": "检索中",
    "exploring": "检索中",
    "Edited": "编辑",
    "edited": "编辑",
    "Editing": "编辑中",
    "editing": "编辑中",
    "Viewed": "查看",
    "viewed": "查看",
    "Viewing": "查看中",
    "viewing": "查看中",
    "Searched": "搜索",
    "searched": "搜索",
    "Searching": "搜索中",
    "searching": "搜索中",
    "Working...": "处理中...",
    "working...": "处理中...",
    "Working": "处理中",
    "working": "处理中",
    "Load older messages": "加载更早消息",
    "Artifact not found": "未找到产物文件",
    "could not be opened": "无法打开",
    "Tool definitions": "工具定义",
    "Subagent definitions": "子智能体定义",

    // ===== 顶部应用菜单与命令面板 (Application Menu & Command Palette) =====
    "Command Palette": "命令面板",
    "Command Palette...": "命令面板...",
    "Command palette": "命令面板",
    "command palette": "命令面板",
    "Palette": "面板",
    "palette": "面板",
    "命令palette": "命令面板",
    "命令 Palette": "命令面板",
    "命令 palette": "命令面板",
    "New Window": "新建窗口",
    "new window": "新建窗口",
    "Open Folder": "打开文件夹",
    "Open folder": "打开文件夹",
    "Open Folder...": "打开文件夹...",
    "Open Workspace": "打开工作区",
    "Open workspace": "打开工作区",
    "Open Workspace...": "打开工作区...",
    "Save As...": "另存为...",
    "Save As": "另存为",
    "Save as": "另存为",
    "Save all": "全部保存",
    "Save All": "全部保存",
    "Close Window": "关闭窗口",
    "close window": "关闭窗口",
    "Close Workspace": "关闭工作区",
    "close workspace": "关闭工作区",
    "Close Editor": "关闭编辑器",
    "close editor": "关闭编辑器",
    "Close Folder": "关闭文件夹",
    "close folder": "关闭文件夹",
    "Quit Antigravity": "退出 Antigravity",
    "Exit": "退出",
    "exit": "退出",

    // ===== 深度汉化补充：通用与应用设置 (General & App Settings) =====
    "Appearance": "外观",
    "appearance": "外观",
    "Theme": "主题",
    "Themes": "主题",
    "Theme mode": "主题模式",
    "Theme Mode": "主题模式",
    "theme mode": "主题模式",
    "Color theme": "颜色主题",
    "Custom theme": "自定义主题",
    "Light": "浅色",
    "Dark": "深色",
    "System": "跟随系统",
    "Follow system": "跟随系统",
    "Inherit from system": "跟随系统设置",
    "Conversation width": "对话区宽度",
    "Conversation Width": "对话区宽度",
    "conversation width": "对话区宽度",
    "Compact": "紧凑",
    "Comfortable": "适中",
    "Wide": "加宽",
    "Full width": "全宽",
    "Full Width": "全宽",
    "App Settings": "应用设置",
    "Keep computer awake": "保持电脑唤醒",
    "Keep computer awake while running tasks": "运行任务时防止电脑休眠",
    "Prevent the system from sleeping during long-running agent tasks.": "在智能体执行长时间任务期间防止系统进入休眠。",
    "Run in background": "后台运行",
    "Run in background when closed": "关闭窗口后在后台继续运行",
    "Run in background when all windows are closed": "关闭所有窗口后在后台继续运行",
    "Keep Antigravity running in the background when all windows are closed.": "关闭所有窗口后，保持 Antigravity 在系统后台运行。",
    "Auto-check for updates": "自动检查更新",
    "Auto check for updates": "自动检查更新",
    "Automatically check for updates": "自动检查软件更新",
    "Automatically check for and notify about application updates.": "自动检查并提示新版本应用程序更新。",
    "Notifications": "系统通知",
    "Enable system notifications": "启用系统通知",
    "Enable system notifications on task completion": "任务完成时发送系统通知",
    "Task completion notifications": "任务完成通知",
    "Receive desktop notifications when background tasks or agent turns finish.": "当后台任务或智能体回合完成时接收桌面通知。",
    "Play sound on task completion": "任务完成时播放提示音",
    "Sound effects": "声音效果",

    // ===== 深度汉化补充：远程控制 (Remote Control) =====
    "Remote Control": "远程控制",
    "Remote control": "远程控制",
    "remote control": "远程控制",
    "Scan the code to open this device in remote control, or copy link.": "扫描二维码以在远程控制中打开此设备，或复制链接。",
    "Scan the code to open this device in Remote Control, or copy link.": "扫描二维码以在远程控制中打开此设备，或复制链接。",
    "Scan the code to open this device in remote control, or copy link": "扫描二维码以在远程控制中打开此设备，或复制链接",
    "Scan the code to open this device in Remote Control, or copy link": "扫描二维码以在远程控制中打开此设备，或复制链接",
    "Scan the code to open this device in 远程控制, or copy link。": "扫描二维码以在远程控制中打开此设备，或复制链接。",
    "Scan the code to open this device in 远程控制, or copy link.": "扫描二维码以在远程控制中打开此设备，或复制链接。",
    "Scan the code to open this device in 远程控制, or copy link": "扫描二维码以在远程控制中打开此设备，或复制链接",
    "Scan the code to 打开 this device in 远程控制, or copy link。": "扫描二维码以在远程控制中打开此设备，或复制链接。",
    "Scan the code to 打开 this device in 远程控制, or copy link": "扫描二维码以在远程控制中打开此设备，或复制链接",
    "Scan the code to 打开 this 设备 in 远程 Control, or 复制链接": "扫描二维码以在远程控制中打开此设备，或复制链接。",
    "Scan the code to 打开 this 设备 in 远程 Control, or 复制链接。": "扫描二维码以在远程控制中打开此设备，或复制链接。",
    "Scan the code to 打开 this 设备 in 远程 Control, or 复制链接.": "扫描二维码以在远程控制中打开此设备，或复制链接。",
    "Scan the code to 打开 this 设备 in 远程 控制, or 复制链接": "扫描二维码以在远程控制中打开此设备，或复制链接。",
    "Scan the code to 打开 this 设备 in 远程 控制, or 复制链接。": "扫描二维码以在远程控制中打开此设备，或复制链接。",
    "Scan the code to 打开 this 设备 in 远程 控制, or 复制链接.": "扫描二维码以在远程控制中打开此设备，或复制链接。",
    "Scan the code to open this device in Remote Control, or": "扫描二维码以在远程控制中打开此设备，或",
    "Scan the code to open this device in remote control, or": "扫描二维码以在远程控制中打开此设备，或",
    "Scan the code to 打开 this 设备 in 远程 控制, or": "扫描二维码以在远程控制中打开此设备，或",
    "Scan the code to 打开 this 设备 in 远程 Control, or": "扫描二维码以在远程控制中打开此设备，或",
    "Scan the code to 打开 this device in 远程控制, or": "扫描二维码以在远程控制中打开此设备，或",
    "Scan the code to": "扫描二维码以",
    "scan the code to": "扫描二维码以",
    "open this device in Remote Control": "在远程控制中打开此设备",
    "open this device in remote control": "在远程控制中打开此设备",
    "this device in Remote Control": "在远程控制中的此设备",
    "Control": "控制",
    "control": "控制",
    "Scan the code to open this device": "扫描二维码以打开此设备",
    "in remote control": "在远程控制中",
    "in Remote Control": "在远程控制中",
    "or copy link.": "或复制链接。",
    "or copy link": "或复制链接",
    "Copy link": "复制链接",
    "copy link": "复制链接",
    "Copy Link": "复制链接",
    "Link copied": "链接已复制",
    "Link copied!": "链接已复制！",
    "Scan the code": "扫描二维码",
    "scan the code": "扫描二维码",
    "Scan code": "扫描二维码",
    "QR code": "二维码",
    "QR Code": "二维码",
    "Connect device": "连接设备",
    "Connect your device": "连接您的设备",
    "Open on your mobile device": "在移动设备上打开",
    "Open on this device": "在此设备上打开",
    "This device": "此设备",
    "this device": "此设备",

    // ===== 深度汉化补充：工具执行与自动审批策略 (Tool Execution & Approval) =====
    "Tool Execution Policy": "工具执行策略",
    "Tool execution policy": "工具执行策略",
    "Auto-Execution Policy": "自动执行策略",
    "Auto Execution Policy": "自动执行策略",
    "auto-execution policy": "自动执行策略",
    "Execution Policy": "执行策略",
    "execution policy": "执行策略",
    "Controls whether terminal commands require approval before running": "控制终端命令在运行前是否需要人工审批",
    "Controls whether terminal commands require approval before running.": "控制终端命令在运行前是否需要人工审批。",
    "Always proceed": "总是直接执行",
    "Always Proceed": "总是直接执行",
    "always-proceed": "总是直接执行",
    "Always proceed (Run without asking)": "总是直接执行 (无需询问)",
    "Request review": "请求人工审查",
    "Request Review": "请求人工审查",
    "request-review": "请求人工审查",
    "Request review (Ask before every command)": "请求人工审查 (每次运行命令前询问)",
    "Proceed in sandbox": "在沙盒中直接执行",
    "Proceed in Sandbox": "在沙盒中直接执行",
    "proceed-in-sandbox": "在沙盒中直接执行",
    "Proceed in sandbox (Run in sandbox without asking)": "在沙盒中直接执行 (沙盒内无需询问)",
    "Strict": "严格模式",
    "strict": "严格模式",
    "Strict (Ask for all tools)": "严格模式 (所有工具调用均需确认)",
    "Agent decides": "智能体自主决定",
    "agent-decides": "智能体自主决定",
    "Agent decides (Request review when recommended)": "智能体自主决定 (仅在有风险时请求审查)",
    "Asks for review": "询问审查",
    "Ask for review": "询问审查",
    "asks-for-review": "询问审查",
    "Turbo": "极速模式",
    "turbo": "极速模式",
    "Turbo mode": "极速模式",
    "turbo mode": "极速模式",
    "极速模式 mode": "极速模式",
    "Learn more about": "了解更多关于",
    "learn more about": "了解更多关于",
    "了解更多 about": "了解更多关于",

    // ===== 通用执行与排队消息策略 (Execution & Queued Messages) =====
    "Configure when follow-up messages are sent.": "配置后续跟进消息的发送时机。",
    "Configure when follow-up messages are sent": "配置后续跟进消息的发送时机",
    "Queue": "排队等待",
    "queue": "排队等待",
    "Send Immediately": "立即发送",
    "send immediately": "立即发送",
    "Steer": "实时插话指导",
    "steer": "实时插话指导",
    "Interrupt": "中断当前执行",
    "interrupt": "中断当前执行",
    "Controls the actions the agent can take.": "控制智能体可以执行的具体操作范围。",
    "Controls the actions the agent can take": "控制智能体可以执行的具体操作范围",
    "Controls the 操作 the 智能体 can take。": "控制智能体可以执行的具体操作范围。",
    "Controls the 操作 the 智能体 can take": "控制智能体可以执行的具体操作范围",
    "Whether the agent asks you to review its documents.": "控制智能体是否提请您审查其生成的文档工件。",
    "Whether the agent asks you to review its documents": "控制智能体是否提请您审查其生成的文档工件",
    "Modify permissions for files, terminal, and MCP tools.": "修改针对文件系统、终端命令以及 MCP 工具的安全权限。",
    "Modify permissions for files, terminal, and MCP tools": "修改针对文件系统、终端命令以及 MCP 工具的安全权限",
    "Modify 权限 持续 文件, 终端, and MCP 工具。": "修改针对文件系统、终端命令以及 MCP 工具的安全权限。",
    "Modify 权限 持续 文件, 终端, and MCP 工具": "修改针对文件系统、终端命令以及 MCP 工具的安全权限",
    "Modify permissions for 文件, 终端, and MCP 工具。": "修改针对文件系统、终端命令以及 MCP 工具的安全权限。",
    "Modify permissions for 文件, 终端, and MCP 工具": "修改针对文件系统、终端命令以及 MCP 工具的安全权限",
    "You can upgrade to a Google AI Ultra plan to receive higher rate limits.": "您可以升级至 Google AI Ultra 计划以获得更高额度的调用速率上限。",
    "You can upgrade to a Google AI Ultra plan to receive higher rate limits": "您可以升级至 Google AI Ultra 计划以获得更高额度的调用速率上限",
    "You can 升级 to a Google AI Ultra 计划 to receive higher rate 限额。": "您可以升级至 Google AI Ultra 计划以获得更高额度的调用速率上限。",
    "You can 升级 to a Google AI Ultra 计划 to receive higher rate 限额": "您可以升级至 Google AI Ultra 计划以获得更高额度的调用速率上限",
    "Keyboard Shortcuts": "键盘快捷键",
    "keyboard shortcuts": "键盘快捷键",
    "Keyboard 快捷键": "键盘快捷键",
    "Narrow": "紧凑",
    "narrow": "紧凑",

    // ===== 深度汉化补充：终端沙盒与安全隔离 (Terminal Sandbox & Security) =====
    "Terminal Sandbox": "终端沙盒",
    "terminal sandbox": "终端沙盒",
    "Sandbox Mode": "沙盒模式",
    "sandbox mode": "沙盒模式",
    "Enable Terminal Sandbox": "启用终端沙盒",
    "enable terminal sandbox": "启用终端沙盒",
    "Run agent commands inside a restricted sandbox environment for added security.": "在受限沙盒环境中运行智能体命令以提高系统安全性。",
    "Run agent commands inside a restricted sandbox environment": "在受限沙盒环境中运行智能体命令",
    "for added security.": "以提高安全性。",
    "Commands executed outside the sandbox require approval.": "在沙盒外执行的命令必须经过用户明确批准。",
    "Commands executed outside the sandbox require explicit user confirmation.": "在沙盒外执行的命令需要用户显式确认。",
    "Sandbox allowed domains": "沙盒允许访问的域名",
    "Sandbox Allowed Domains": "沙盒允许域名",

    // ===== 深度汉化补充：文件与网络访问策略 (File & Network Access) =====
    "Non-Workspace File Access": "工作区外文件访问",
    "Non-Workspace File Access Policy": "工作区外文件访问策略",
    "non-workspace file access policy": "工作区外文件访问策略",
    "File Access Policy": "文件访问策略",
    "file access policy": "文件访问策略",
    "Controls whether the agent can read or write files outside the current workspace root": "控制智能体是否可以读写当前工作区根目录之外的文件",
    "Controls whether the agent can read or write files outside the current workspace root.": "控制智能体是否可以读写当前工作区根目录之外的文件。",
    "Internet Access Policy": "网络访问策略",
    "internet access policy": "网络访问策略",
    "Controls whether the agent can make network requests": "控制智能体是否可以发起网络外部请求",
    "Controls whether the agent can make network requests.": "控制智能体是否可以发起网络外部请求。",
    "Allow agent access to .gitignore files": "允许智能体访问 .gitignore 忽略的文件",
    "Allow agent access to .gitignore files.": "允许智能体访问 .gitignore 忽略的文件。",
    "Allow": "允许",
    "allow": "允许",
    "Ask": "每次询问",
    "ask": "每次询问",
    "Deny": "拒绝",
    "deny": "拒绝",
    "Allow/deny": "允许/拒绝",
    "Allow/Deny": "允许/拒绝",

    // ===== 深度汉化补充：权限规则、白名单与黑名单 (Permissions & Lists) =====
    "Permission Grants": "权限授予规则",
    "permission grants": "权限授予规则",
    "Global permission grants": "全局权限规则",
    "Project-scoped permission grants": "项目专属权限规则",
    "Command Allowlist": "命令白名单",
    "Command Denylist": "命令黑名单",
    "Command Allowlist / Denylist": "命令白名单 / 黑名单",
    "Specify terminal commands that are always permitted or always blocked.": "指定始终允许直接执行或始终禁止执行的终端命令。",
    "Browser Allowlist": "浏览器白名单",
    "browser allowlist": "浏览器白名单",
    "Restrict which domains the agent's browser tools can navigate to.": "限制智能体浏览器工具可以访问的域名范围。",
    "Define global allow/deny rules for specific files, commands, and URLs.": "为特定的文件路径、终端命令及网络 URL 定义全局允许/拒绝规则。",
    "Add path": "添加路径",
    "Add Path": "添加路径",
    "Add command": "添加命令",
    "Add Command": "添加命令",
    "Add URL": "添加 URL",
    "Add domain": "添加域名",
    "Add Domain": "添加域名",
    "Add rule": "添加规则",
    "Add Rule": "添加规则",
    "Edit rule": "编辑规则",
    "Remove rule": "移除规则",
    "Delete rule": "删除规则",

    // ===== 深度汉化补充：工件审查模式 (Artifact Review Mode) =====
    "Artifact Review Mode": "工件审查模式",
    "artifact review mode": "工件审查模式",
    "Artifact Review": "工件审查",
    "artifact review": "工件审查",
    "Controls when the agent asks for artifact review": "控制智能体何时向用户提请工件审查",
    "Controls when the agent asks for artifact review.": "控制智能体何时向用户提请工件审查。",
    "Override artifact review behavior per project.": "在当前项目中覆盖工件审查行为设置。",

    // ===== 深度汉化补充：浏览器 JS 执行策略 (Browser JS Execution) =====
    "Browser JavaScript Execution": "浏览器 JavaScript 执行策略",
    "Browser JavaScript Execution Policy": "浏览器 JavaScript 执行策略",
    "Browser JS Execution Policy": "浏览器 JS 执行策略",
    "browser js execution policy": "浏览器 JS 执行策略",
    "Controls whether the browser tool can execute JavaScript on web pages.": "控制浏览器工具是否可以在网页上执行 JavaScript 脚本。",

    // ===== 深度汉化补充：远程控制 (Remote Control) =====
    "Remote Control": "远程控制",
    "remote control": "远程控制",
    "Enable Remote Control": "启用远程控制",
    "enable remote control": "启用远程控制",
    "Remote control hostname": "远程控制主机名",
    "Remote Control Hostname": "远程控制主机名",
    "Allow controlling this agent instance remotely via CLI or web.": "允许通过命令行工具或 Web 端远程控制当前智能体实例。",
    "Staying disconnected: Remote Control user setting is off": "保持断开：远程控制用户设置已关闭",

    // ===== 深度汉化补充：数据存储、缓存与维护 (Data, Storage & Reset) =====
    "Data & Storage": "数据与存储",
    "Data and Storage": "数据与存储",
    "Storage": "存储空间",
    "Clear cache": "清除缓存",
    "Clear Cache": "清除缓存",
    "Clear temporary data and cached assets.": "清除临时数据和缓存资源。",
    "Reset all settings": "重置所有设置",
    "Reset all settings to default": "恢复所有设置为默认值",
    "Reset Settings": "重置设置",
    "Restore all settings back to their factory default values.": "将所有配置选项还原为出厂默认设置。",
    "Open configuration folder": "打开配置所在文件夹",
    "Open application logs": "打开应用程序日志",
    "Open Logs Folder": "打开日志文件夹",
    "Data storage path": "数据存储路径",

    // ===== 深度汉化补充：点数用量与账号 (Credits & Account) =====
    "AI Credits": "AI 点数",
    "ai credits": "AI 点数",
    "Use AI credits": "使用个人 AI 点数",
    "use ai credits": "使用个人 AI 点数",
    "Consume personal tier credits for faster inference and higher rate limits.": "使用个人等级点数以获得更快的推理速度和更高的调用限额。",
    "Account": "账号",
    "Account & Profile": "账号与个人中心",
    "Sign in with Google": "使用 Google 账号登录",
    "Signed in as": "当前登录账号",
    "Log out": "退出登录",
    "Sign out": "退出登录",
    "Manage subscription": "管理订阅计划",
    "Manage Google account": "管理 Google 账号",

    // ===== 深度汉化补充：通用偏好、系统托盘与远程控制 =====
    "Manage Antigravity app settings.": "管理 Antigravity 应用程序偏好设置。",
    "Keep the app accessible from the menu bar and running in the background when all windows are closed.": "关闭所有窗口后，保持应用常驻系统托盘并继续在后台运行。",
    "Work with local agents from another device.": "支持从其他设备远程协同与控制本地智能体。",
    "Browser settings have moved": "浏览器设置已迁移",
    "Browser settings have moved to the Browser section of General settings.": "浏览器设置已移动到“常规设置”的“浏览器”板块中。",
    "Go to General settings": "前往常规设置",
    "Models & Usage": "模型配额与用量",
    "Manage your model quota and credits.": "管理您的模型配额与个人 AI 点数。",
    "Show Selection Actions": "显示划词快捷操作",
    "Show Selection Actions when selecting text": "选中文本时显示划词操作",
    'Show "Edit" and "Chat" buttons when selecting text in the editor.': '在编辑器中选中代码或文本时，浮动显示“编辑”与“聊天”快捷按钮。',
    "Selection Actions": "划词操作",
    "Previous Pane Tab": "切换到上一个窗格",
    "Next Pane Tab": "切换到下一个窗格",
    "Toggle Terminal": "切换终端面板",
    "Add to Chat/Quote": "添加到聊天引用",

    // ===== 深度汉化补充：Labs 实验功能与开发者工具 =====
    "Try out early-stage features before they ship. These may change or be removed at any time.": "在正式发布前抢先体验早期新特性。这些功能可能会随时变更或移除。",
    "Experimental features": "实验性功能",
    "Conversation Sharing": "对话分享",
    "Generate a link that lets any Googler load a read-only copy of a conversation. Sharing exports the conversation history to your public x20 folder, so it needs that folder to be readable by others.": "生成一个只读对话分享链接。分享操作会将对话记录导出至公开目录，需要该目录对外具备读取权限。",
    "Inline Actions": "内联操作卡片",
    "Show a floating notification card when background conversations need your input. Answer questions, approve commands, and grant permissions without leaving your current conversation. Share feedback at go/inline-actions-feedback.": "当后台对话需要您的输入时显示浮动通知卡片。无需切换离开当前对话即可直接回答问题、审批命令及授予权限。",
    "CitC Settings": "CitC 工作区设置",
    "Manage settings specific to Google CitC workspaces development.": "管理专用于 Google CitC 工作区开发的配置项。",
    "Best of N": "Best of N 策略配置",
    "Manage how Best of N sets up the workspaces its arms run in.": "配置 Best of N 在各分支运行时的工作区环境。",
    "Developer-only tools. These settings are stored locally in this browser and do not affect other users.": "仅限开发者使用的内部工具。这些设置仅保存在本地，不会影响其他用户。",
    "Regroup Google3 Chats": "重新归类 Google3 对话",
    "Google3 chats will be regrouped into their workspaces in the sidebar.": "侧边栏中的 Google3 对话将按所属工作区重新归类分组。",
    "This migration may mess up your settings, chats, and sidebar.": "此项迁移可能会影响您的偏好设置、对话记录及侧边栏布局。",
    "Follow the guide at go/jetski-project-migration to back up your data and run the migration.": "请按照相关指南备份您的数据后再执行迁移。",
    // ===== 全量预置 MCP 服务器卡片与生态长句深度汉化 (63 款官方与社区 MCP) =====
    // 1. MCP 标题与界面导航
    "Google Kubernetes Engine (Remote)": "Google Kubernetes Engine (远程)",
    "Google Cloud Bigtable Admin": "Google Cloud Bigtable 管理",
    "Google Cloud CLI (Preview)": "Google Cloud CLI (预览版)",
    "Google Cloud Apigee API hub": "Google Cloud Apigee API Hub",
    "Knowledge Catalog": "Knowledge Catalog 数据资产目录",
    "MCP Toolbox for Databases": "数据库 MCP 工具箱 (MCP Toolbox for Databases)",
    "Oracle Database": "Oracle 数据库",
    "Google Home Developer": "Google Home 开发者",
    "Perplexity Ask": "Perplexity 搜索 (Perplexity Ask)",
    "Sequential Thinking": "顺序思考 (Sequential Thinking)",
    "Sonatype Guide": "Sonatype 指南 (Sonatype Guide)",
    "Google Maps Platform Code Assist": "Google Maps Platform 编程助手",
    "ArizeTracingAssistant": "Arize Tracing 助手",
    "Google Developer Knowledge": "Google 开发者知识库",
    "Android Management API": "Android 管理 API",
    "Google Cloud Resource Manager": "Google Cloud 资源管理器",
    "Vertex AI Search": "Vertex AI 搜索",
    "Google Cloud Logging": "Google Cloud 日志",
    "Google Managed Service for Apache Kafka": "Google Cloud 托管 Apache Kafka 服务",
    "Google Cloud Monitoring": "Google Cloud 监控",
    "Google Cloud Quotas": "Google Cloud 配额管理",
    "Chrome DevTools for agents": "面向智能体的 Chrome DevTools",
    "Cloud Run": "Cloud Run",
    "Cloud 运行": "Cloud Run",
    "Search MCP servers...": "搜索 MCP 服务器...",
    "Search MCP servers": "搜索 MCP 服务器",
    "Available MCP Servers": "可用 MCP 服务器",
    "Available MCP servers": "可用 MCP 服务器",
    "All MCP Servers": "全部 MCP 服务器",
    "All MCP servers": "全部 MCP 服务器",
    "Featured MCP Servers": "精选 MCP 服务器",
    "Featured MCP servers": "精选 MCP 服务器",
    "Custom MCP Server": "自定义 MCP 服务器",
    "Add Custom MCP Server": "添加自定义 MCP 服务器",
    "Add custom MCP server": "添加自定义 MCP 服务器",
    "Install MCP Server": "安装 MCP 服务器",
    "Add Server": "添加服务器",
    "Remove MCP Server": "移除 MCP 服务器",
    "Configured MCP Servers": "已配置的 MCP 服务器",

    // 2. 预置 63 款 MCP 服务卡片描述长句
    "Investigate and fix software issues using AI-powered root cause analysis. This MCP server connects to your Antimetal account to search issues, read investigative reports with causal graphs, retrieve observability artifacts (logs, traces, metrics), and apply remediations—directly from your AI tools.": "利用 AI 驱动的根因分析调查并修复软件问题。该 MCP 服务器可连接到您的 Antimetal 账户，支持检索问题、阅读带因果关系图的调查报告、提取可观测性工件（日志、链路追踪、指标），并直接在您的 AI 工具中应用修复方案。",
    "Query and act on your marketing, analytics, CRM, e-commerce, and warehouse data across 325+ connectors (Meta Ads, Google Ads, TikTok Ads, GA4, HubSpot, Salesforce, Shopify, Stripe, BigQuery, Snowflake, and more) using natural language. Read live data and write changes back (pause or enable campaigns, set budgets, upload conversions) with no SQL and no custom integrations.": "通过自然语言查询并操作跨 325+ 个连接器（Meta Ads、Google Ads、TikTok Ads、GA4、HubSpot、Salesforce、Shopify、Stripe、BigQuery、Snowflake 等）的营销、分析、CRM、电商及数据仓库数据。无需编写 SQL 或定制集成，即可读取实时数据并回写变更（如暂停/启用营销活动、调整预算、上传转化数据）。",
    "Query your GitLab SDLC as a knowledge graph. Orbit indexes groups, projects, source code, merge requests, pipelines, work items, and security findings into a single graph so agents can answer blast radius, onboarding, and dependency mapping questions by traversing real relationships instead of grepping across separate systems.": "将您的 GitLab 软件开发生命周期 (SDLC) 作为知识图谱进行查询。Orbit 会将群组、项目、源码、合并请求 (MR)、流水线、工作项及安全漏洞索引到一个统一的图谱中，使智能体能通过遍历真实关联关系来解答影响范围 (blast radius)、新人上手以及依赖拓扑映射等问题，而无需在不同系统间进行机械 grep 搜索。",
    "Enable Antigravity to deploy apps to Google Cloud Run.": "让 Antigravity 能够直接将应用部署到 Google Cloud Run 无服务器容器平台。",
    'Ask questions. Get answers. The MCP is a server your coding agent talks to. Ask a question in English. It runs the query against your PostHog data. The answer lands in your editor. No SQL. No dashboards. No tabs full of charts you forgot you opened. Try things like: - "How many unique users signed up in the last 7 days, broken down by day?" - "Create an A/B test for our pricing page that measures conversion to checkout." - "What are the top 5 errors in my project this week?"': "提出问题，获取答案。该 MCP 服务器为您的编程智能体提供数据对话能力。直接用自然语言提问，它将对您的 PostHog 数据执行查询，并直接在编辑器中返回结果。无需编写 SQL，无需翻找仪表盘，也无需打开一堆遗忘的图表标签页。您可以尝试提问：“过去 7 天每天有多少独立用户注册？”、“为定价页面创建 A/B 测试以衡量结账转化率”、“本周我项目中排名前 5 的错误是什么？”",
    "Search and reference over 600,000 real-world app screens, user flows, and UI patterns from Mobbin directly within your AI tools.": "直接在您的 AI 工具中检索并参考来自 Mobbin 的 60 多万个真实移动应用界面、用户旅程流程及 UI 设计模式。",
    "Build, edit, deploy, and manage full-stack web apps with Lovable, the AI-powered app builder, using natural language. This MCP server connects your AI client to Lovable so you can create projects and workspaces, send build instructions to the Lovable agent, inspect generated code via diffs and file trees, read and write project knowledge, manage Postgres databases and connectors, and deploy apps directly from your AI tools.": "通过自然语言使用 AI 应用构建工具 Lovable 构建、编辑、部署和管理全栈 Web 应用。该 MCP 服务器将您的 AI 客户端连接至 Lovable，支持创建项目与工作区、向 Lovable 智能体发送构建指令、通过 Diff 和文件树审查生成代码、读写项目知识库、管理 Postgres 数据库与连接器，并直接在 AI 工具中完成应用部署。",
    "The GKE remote MCP server provides read write access to your GKE Kubernetes resources. It allows an AI agent to inspect and observe your environment.": "GKE 远程 MCP 服务器提供对您 GKE Kubernetes 资源的读写访问权限，允许 AI 智能体检查和观测您的集群与运行环境。",
    "The Dart and Flutter MCP server exposes Dart (and Flutter) development tool actions to compatible AI-assistant clients.": "Dart 与 Flutter MCP 服务器向兼容的 AI 助手客户端开放 Dart（及 Flutter）开发工具的各项操作指令。",
    "The Firebase Model Context Protocol (MCP) Server gives AI-powered development tools the ability to work with your Firebase projects and your app's codebase.": "Firebase MCP 服务器让 AI 驱动的开发工具具备协同操作 Firebase 项目及应用程序代码库的能力。",
    "The Genkit Model Context Protocol (MCP) Server gives AI-powered development tools the ability to build, debug and inspect your Genkit app.": "Genkit MCP 服务器让 AI 驱动的开发工具具备构建、调试和检查 Genkit 应用的能力。",
    "The gopls Model Context Protocol (MCP) server provides tools for semantic code analysis, live diagnostics, and transformation of your Go codebase.": "gopls MCP 服务器为您的 Go 代码库提供语义代码分析、实时诊断以及代码重构转换工具。",
    "Interact with your BigQuery data using natural language. This MCP server allows you to securely connect to your datasets to search the datasets, inspect table metadata, execute SQL queries, generate time-series forecasts, and perform contribution analysis directly from your AI tools.": "使用自然语言与您的 BigQuery 数据交互。该 MCP 服务器让您能够安全连接到数据集，直接在 AI 工具中搜索数据集、检查数据表元数据、执行 SQL 查询、生成时间序列预测并执行贡献度归因分析。",
    "The AlloyDB for PostgreSQL remote MCP server lets you access and run AlloyDB tools to manage AlloyDB clusters and instances, manage users, create and restore backups, administer users, import and export data, and run SQL queries from your AI-enabled development environments and AI agent platforms.": "AlloyDB for PostgreSQL 远程 MCP 服务器让您能从 AI 开发环境和智能体平台访问并运行 AlloyDB 工具，用以管理集群与实例、管理用户权限、创建与恢复备份、导入导出数据以及执行 SQL 查询。",
    "The Bigtable Admin remote MCP server lets you manage Bigtable resources.": "Bigtable Admin 远程 MCP 服务器让您能够全面管理 Google Cloud Bigtable 资源。",
    "Manage Google Cloud resources with gcloud and bq CLI tools in a remote sandbox environment": "在远程沙盒环境中通过 gcloud 和 bq 命令行工具管理 Google Cloud 云资源",
    "The Cloud SQL remote MCP server lets you access and run Cloud SQL tools to manage Cloud SQL instances, manage users, create and restore backups, administer users, import and export data, and run SQL queries from your AI-enabled development environments and AI agent platforms.": "Cloud SQL 远程 MCP 服务器让您能从 AI 开发环境和智能体平台访问并运行 Cloud SQL 工具，用以管理实例、管理用户权限、创建与恢复备份、导入导出数据以及执行 SQL 查询。",
    "The Spanner remote MCP server lets you access and run Spanner tools to create, manage, and query Spanner resources from your AI-enabled development environments and AI agent platforms.": "Spanner 远程 MCP 服务器让您能从 AI 开发环境和智能体平台访问并运行 Spanner 工具，以创建、管理和查询 Spanner 分布式数据库资源。",
    "The Apigee API hub remote MCP server lets you manage the APIs, versions, specs, operations, deployments, attributes, external APIs, and dependencies registered in your API hub instance - including creating, reading, updating, and deleting them - and search across resources, using natural language.": "Apigee API Hub 远程 MCP 服务器让您能通过自然语言管理在 API Hub 实例中注册的 API、版本、规范、操作、部署、属性、外部 API 及依赖项（包括增删改查），并跨资源进行智能检索。",
    "Connect your AI assistants to Looker business intelligence. This MCP server enables data exploration and content management by allowing you to execute natural language queries, run saved Looks, create and manage dashboards, and perform instance health checks within your Looker environment.": "将您的 AI 助手连接到 Looker 商业智能平台。该 MCP 服务器支持通过自然语言执行查询、运行已保存的 Look 分析、创建和管理仪表盘，并在 Looker 环境中执行实例健康检查，赋能数据探索与内容管理。",
    "Connect your AI assistants to the Knowledge Catalog (formerly known as Dataplex). This MCP server enables data discovery and governance by allowing you to search for data assets, retrieve detailed metadata such as schemas and ownership, and explore aspect types across your distributed data.": "将您的 AI 助手连接到 Knowledge Catalog（前身为 Dataplex）。该 MCP 服务器支持数据发现与数据治理，允许您搜索数据资产、检索表结构模式 (Schema) 与归属权等详细元数据，并探索分布式数据中的切面类型。",
    "The MCP Toolbox for Databases is an open-source MCP server designed to simplify and secure the development of tools for interacting with databases.": "MCP Toolbox for Databases 是一个开源 MCP 服务器，旨在简化并保障数据库交互工具开发的安全与效率。",
    "Interact with your Oracle Database data using natural language. This MCP server allows you to securely connect to your databases for executing SQL queries, inspecting table schemas, and troubleshooting database performance issues directly from your AI tools.": "使用自然语言与您的 Oracle 数据库交互。该 MCP 服务器让您能够安全连接到数据库，直接在 AI 工具中执行 SQL 查询、检查表模式结构，并排查数据库性能瓶颈与故障。",
    "The Dev Mode MCP Server brings Figma directly into your workflow by providing important design information and context to AI agents generating code from Figma design files.": "Dev Mode MCP 服务器将 Figma 深度融入您的开发工作流，为从 Figma 设计稿生成代码的 AI 智能体提供关键的设计信息与上下文依据。",
    "The GitHub MCP Server is a Model Context Protocol (MCP) server that provides seamless integration with GitHub APIs, enabling advanced automation and interaction capabilities for developers and tools.": "GitHub MCP 服务器提供与 GitHub API 的无缝集成，为开发者和工具赋能强大的自动化协同与操作能力。",
    "The Google Home Developer MCP server allows you to search through Google Home documentation, OpenThread and Matter specifications documentation.": "Google Home Developer MCP 服务器让您能够检索 Google Home 文档、OpenThread 以及 Matter 智能家居协议规范文档。",
    "Neon MCP Server is an open-source tool that lets you interact with your Neon Postgres databases in natural language.": "Neon MCP Server 是一款开源工具，支持通过自然语言与您的 Neon Serverless Postgres 数据库进行交互操作。",
    "The Stripe Model Context Protocol server allows you to integrate with Stripe APIs through function calling. This protocol supports various tools to interact with different Stripe services.": "Stripe MCP 服务器允许您通过函数调用 (Function Calling) 与 Stripe API 集成，支持使用多种内置工具与各类 Stripe 支付及账务服务进行交互。",
    "Interact with Redis key-value stores": "与 Redis 键值存储数据库进行高效交互",
    "A Model Context Protocol server for interacting with MongoDB Atlas.": "用于与 MongoDB Atlas 云数据库进行交互的 MCP 服务器。",
    "Official Notion MCP Server that allows interaction with Notion workspaces, pages, databases, and comments via the Notion API.": "官方 Notion MCP 服务器，支持通过 Notion API 与 Notion 工作区、页面、数据库及评论进行协同交互。",
    "Official Linear.app MCP Server for interacting with Linear projects, issues, and workflows.": "官方 Linear.app MCP 服务器，用于与 Linear 项目、Issue 问题工单以及研发工作流进行交互。",
    "An MCP server implementation that integrates the Perplexity Sonar API to provide real-time, web-wide research capabilities.": "集成 Perplexity Sonar API 的 MCP 服务器实现，为智能体提供实时、全网范围的深度检索与信息调研能力。",
    "Official PayPal MCP Server that allows integration with PayPal APIs for payment processing, transaction management, and account operations.": "官方 PayPal MCP 服务器，支持与 PayPal API 集成以处理在线支付、交易管理及账户操作。",
    "The Heroku Platform MCP Server enables seamless interaction with Heroku Platform resources, allowing LLMs to read, manage, and operate applications, add-ons, databases, and more.": "Heroku Platform MCP 服务器实现与 Heroku 平台资源的无缝交互，允许大语言模型读取、管理和运维应用程序、附加组件 (Add-ons)、数据库等。",
    "The Pinecone MCP Server enables AI tools to search Pinecone documentation, configure indexes, generate code informed by your index configuration, and upsert/search data in your Pinecone indexes.": "Pinecone MCP 服务器让 AI 工具能够检索 Pinecone 文档、配置向量索引、根据索引配置生成代码，并在 Pinecone 索引中执行数据更新 (upsert) 与向量相似度搜索。",
    "Connect your Supabase projects to AI assistants. This MCP server allows managing tables, fetching config, executing SQL queries, managing edge functions, and working with database schema in your Supabase projects.": "将您的 Supabase 项目连接至 AI 助手。该 MCP 服务器支持管理数据表、拉取项目配置、执行 SQL 查询、管理 Edge Functions 边缘函数，以及维护数据库架构模式。",
    "The Prisma MCP Server enables AI tools to interact with Prisma for creating and managing Postgres databases easily.": "Prisma MCP 服务器让 AI 工具能够与 Prisma 交互，轻松创建和管理 Postgres 数据库。",
    "The Locofy MCP Server enables Locofy.ai code to be integrated and extended with your IDE.": "Locofy MCP 服务器支持将 Locofy.ai 前端生成代码集成并拓展到您的 IDE 编辑器中。",
    "Airweave lets agents search any app.": "Airweave 赋予智能体检索任意第三方应用数据的能力。",
    "Atlassian MCP Server for interacting with Atlassian products.": "用于与 Jira、Confluence 等 Atlassian 旗下产品进行交互的 MCP 服务器。",
    "Interact with your Harness account using natural language. This MCP server lets AI agents inspect and manage CI/CD pipelines, executions, services, environments, connectors, feature flags, cloud costs, security findings, chaos experiments, and other Harness platform resources.": "通过自然语言与您的 Harness 账户交互。该 MCP 服务器让 AI 智能体能够检查并管理 CI/CD 流水线、执行记录、微服务、部署环境、连接器、功能开关 (Feature Flags)、云成本、安全发现、混沌工程实验以及其他 Harness 平台资源。",
    "SonarQube MCP Server enables AI assistants to interact with SonarQube instances for code quality analysis, project management, and quality gate operations.": "SonarQube MCP 服务器让 AI 助手能够与 SonarQube 实例交互，执行代码质量分析、项目管理以及质量阀 (Quality Gate) 门禁操作。",
    "Netlify MCP Server enables AI assistants to interact with Netlify's platform for managing sites, deployments, domains, and other web development workflows.": "Netlify MCP 服务器让 AI 助手能够与 Netlify 平台交互，以管理网站、部署记录、自定义域名及其他 Web 开发工作流。",
    "A Model Context Protocol server that provides structured thinking and reasoning capabilities for LLM conversations.": "为大语言模型对话提供结构化深思、思维链推演与逻辑推导能力的 MCP 服务器。",
    "Sonatype MCP server for interacting with our dependency management and security intelligence platform.": "用于与 Sonatype 依赖项管理及开源安全情报平台进行交互的 MCP 服务器。",
    "The Google Maps Platform Code Assist MCP server provides your favorite AI coding assistant with up-to-date, official Google Maps Platform documentation, code samples, and best practices. By grounding your AI assistant in our official resources, it can generate more accurate, reliable, and useful code.": "Google Maps Platform Code Assist MCP 服务器为您的 AI 编程助手提供最新官方 Google Maps Platform 文档、代码示例和最佳实践。通过将 AI 助手的认知锚定在官方权威资源中，能够生成更精确、更可靠、更具实用价值的代码。",
    "This MCP server provides your LLM with docs and examples to instrument your AI apps with Arize AX. It also provides access to Arize support. Connect it to your IDE or LLM and get curated tracing examples, best practices and Arize support!": "该 MCP 服务器为大语言模型提供文档和示例，帮助使用 Arize AX 埋点监控您的 AI 应用，同时提供对 Arize 支持服务的访问。连接到您的 IDE 或大模型，即可获取精心策划的链路追踪示例、最佳实践与官方支持！",
    "The Postman MCP Server connects Postman to AI tools, giving AI agents and assistants the ability to access workspaces, manage collections and environments, evaluate APIs, and automate workflows through natural language interactions.": "Postman MCP 服务器将 Postman 连接至 AI 工具，让 AI 智能体与助手能通过自然语言交互访问工作区、管理集合 (Collections) 与环境变量、评估 API，并实现接口自动化工作流。",
    "The Stitch MCP server enables AI assistants to interact with Stitch for vibe design: generating UI designs from text and images, and accessing project and screen details. See https://stitch.withgoogle.com/docs for more details.": "Stitch MCP 服务器让 AI 助手能够与 Stitch 交互以进行即兴设计 (Vibe Design)：根据文本和图像生成 UI 设计，并访问项目及屏幕界面细节。详见 https://stitch.withgoogle.com/docs。",
    "The Google Developer Knowledge MCP server gives AI-powered development tools the ability to search Google's official developer documentation and retrieve information for Google's products such as Firebase, Google Cloud, Android, Maps, and more. By connecting your AI application straight to our official library of documentation, it ensures the code and guidance you receive are up-to-date and based on authoritative context.": "Google Developer Knowledge MCP 服务器让 AI 驱动的开发工具能够检索 Google 官方开发者文档，并获取 Firebase、Google Cloud、Android、Maps 等 Google 产品的信息。通过将您的 AI 应用直接接入官方文档库，确保您获得的代码和技术指导保持最新并基于权威上下文。",
    "The ClickHouse MCP server enables agents to securely interact with ClickHouse databases. It provides a universal interface to execute SQL, explore data, and view backup & billing details, allowing agentic tooling to leverage ClickHouse's high-performance analytical capabilities.": "ClickHouse MCP 服务器使智能体能够安全地与 ClickHouse 数据库交互。它提供用于执行 SQL、探索数据以及查看备份与计费详情的通用接口，赋能智能体工具充分利用 ClickHouse 极致的高性能分析能力。",
    "Perform a range of infrastructure management tasks, including: manage virtual machine (VM) instances, manage instance group managers and instance templates, manage disks and snapshots, retrieve information about reservations and commitments.": "执行一系列基础架构管理任务，包括：管理虚拟机 (VM) 实例、管理实例组管理器与实例模板、管理磁盘与快照、获取预留资源与承诺使用折扣信息。",
    "Access enterprise mobility data using natural language queries about device fleets, automated auditing of policy compliance, and the integration of device management data into broader automated workflows.": "使用自然语言查询获取企业移动管理数据，涵盖设备机群状态、合规策略自动化审计，以及将设备管理数据无缝集成到更广泛的自动化工作流中。",
    "Search your Google Cloud projects using natural language.": "通过自然语言快速检索您的 Google Cloud 项目与资源层级。",
    "Perform searches on ingested data in Google-owned data stores.": "在 Google 托管的数据存储区中，对已摄取的数据执行智能语义与向量搜索。",
    "Interact with documents stored in a Firestore database using natural language.": "使用自然语言与存储在 Firestore 数据库中的文档进行交互与查询。",
    "Access resources in the Cloud Logging platform using natural language.": "使用自然语言访问和查询 Cloud Logging 日志平台中的各类资源与日志流。",
    "Manage clusters for Managed Service for Apache Kafka and Kafka Connect using natural language.": "使用自然语言管理 Google Cloud 托管 Apache Kafka 服务集群与 Kafka Connect 连接器。",
    "Access resources in the Cloud Monitoring platform using natural language.": "使用自然语言访问和查看 Cloud Monitoring 监控平台中的各类监控资源与指标度量。",
    "Manage Pub/Sub resources and publish messages. Create, list, get, update, and delete Pub/Sub topics, subscriptions, and snapshots, as well as publish messages to topics.": "管理 Pub/Sub 资源并发布消息。支持创建、列出、获取、更新和删除 Pub/Sub 主题 (Topics)、订阅 (Subscriptions) 及快照，并向指定主题投递消息。",
    "The Cloud Quotas MCP server allows you to view quota allocations, request quota increases, and manage Quota Adjuster configurations.": "Cloud Quotas MCP 服务器允许您查看配额分配情况、申请提升服务配额，以及管理 Quota Adjuster 自动配额调整器配置。",
    "Enable Antigravity to control and inspect a live Chrome browser, with access to the full power of Chrome DevTools for reliable automation, in-depth debugging, and performance analysis.": "让 Antigravity 能够直接控制并检查运行中的 Chrome 浏览器，充分调用 Chrome DevTools 的强大能力，实现高可靠的自动化操作、深度调试与性能分析。",
  };

  const coreWords = {
    "create": "创建", "delete": "删除", "new": "新建", "edit": "编辑", "save": "保存", "cancel": "取消", "confirm": "确认",
    "close": "关闭", "open": "打开", "stop": "停止", "start": "启动", "run": "运行", "add": "添加", "remove": "移除",
    "update": "更新", "select": "选择", "clear": "清除", "search": "搜索", "find": "查找", "view": "查看", "show": "显示", "hide": "隐藏",
    "agent": "智能体", "agents": "智能体", "subagent": "子智能体", "subagents": "子智能体", "task": "任务", "tasks": "任务",
    "workspace": "工作区", "workspaces": "工作区", "directory": "目录", "folder": "文件夹", "file": "文件", "files": "文件",
    "command": "命令", "commands": "命令", "palette": "面板", "terminal": "终端", "console": "控制台", "output": "输出", "input": "输入", "remote": "远程", "control": "控制", "device": "设备", "devices": "设备", "link": "链接",
    "log": "日志", "logs": "日志", "setting": "设置", "settings": "设置", "preference": "偏好", "preferences": "偏好", "permission": "权限", "permissions": "权限",
    "theme": "主题", "themes": "主题", "model": "模型", "models": "模型", "capability": "能力", "capabilities": "能力",
    "running": "运行中", "completed": "已完成", "failed": "已失败", "pending": "等待中", "success": "成功", "error": "错误",
    "system": "系统", "prompt": "提示词", "instructions": "指令", "description": "描述", "name": "名称", "version": "版本",
    "active": "活跃", "background": "后台", "parent": "父级", "child": "子级", "branch": "分支", "share": "共享", "inherit": "继承",
    "original": "原始", "backup": "备份", "duration": "持续时间", "seconds": "秒", "timer": "定时器", "timers": "定时器",
    "schedule": "调度", "cron": "定时任务", "tools": "工具", "tool": "工具", "execute": "执行", "execution": "执行", "plan": "计划",
    "changed": "已更改", "review": "审核", "reviewing": "审核中", "reviewed": "已审核",
    "canceled": "已取消", "js": "Js",
    "explore": "探索", "search": "搜索", "change": "更改", "changes": "更改",
    "turn": "回合", "turns": "回合",
    "analyzed": "分析", "analyzing": "分析"
  };

  const combinedDict = Object.assign({}, coreWords, dictionary);
  // 性能优化 1：预先构建全小写字典 Map，将未命中小写查找由 O(N) 降低为 O(1)
  const lowerDictionary = new Map();
  for (const k in dictionary) {
    const lk = k.toLowerCase();
    if (!lowerDictionary.has(lk)) {
      lowerDictionary.set(lk, dictionary[k]);
    }
  }

  const stringCache = new Map();
  const MAX_STRING_CACHE = 5000;

  const escapeRegExp = (str) => {
    const specials = ['[', ']', '(', ')', '{', '}', '*', '+', '?', '.', '^', '$', '|', '\\\\'];
    return str.split('').map(c => specials.includes(c) ? '\\\\' + c : c).join('');
  };

  // 性能优化 4：启动阶段一次性预编译单次联合分词正则，彻底消灭运行时 80 次循环迭代正则匹配
  const sortedCoreKeys = Object.keys(coreWords)
    .sort((a, b) => b.length - a.length)
    .filter(w => w.length > 2 || /^[a-zA-Z0-9]+$/.test(w));
  const escapedCoreUnion = sortedCoreKeys.map(w => escapeRegExp(w)).join('|');
  const CORE_WORDS_UNION_REGEX = new RegExp('\\\\b(' + escapedCoreUnion + ')\\\\b', 'gi');

  function translateString(text) {
    if (!text) return text;
    const trimmed = text.trim();
    if (!trimmed) return text;

    // 性能优化 2：极速短路。若文本完全不包含任何英文字母（纯中文/纯数字/纯标点），绝对无需查英文词典或跑正则，瞬间原样返回
    if (!/[a-zA-Z]/.test(trimmed)) {
      return text;
    }

    // 0. 极速缓存查询（O(1) 命中瞬间返回）
    if (stringCache.has(trimmed)) {
      return text.replace(trimmed, stringCache.get(trimmed));
    }

    if (trimmed.includes('could not be opened')) {
      const replacedCouldNot = trimmed.replace(/could not be opened/gi, '无法打开');
      if (stringCache.size < MAX_STRING_CACHE) stringCache.set(trimmed, replacedCouldNot);
      return text.replace(trimmed, replacedCouldNot);
    }

    if (/Scan the code to/i.test(trimmed)) {
      if (/Scan the code to.*,\\s*or\\s*$/i.test(trimmed)) {
        const fixed = '扫描二维码以在远程控制中打开此设备，或';
        if (stringCache.size < MAX_STRING_CACHE) stringCache.set(trimmed, fixed);
        return text.replace(trimmed, fixed);
      }
      if (/Scan the code to.*(?:copy link|复制链接)/i.test(trimmed)) {
        const fixed = '扫描二维码以在远程控制中打开此设备，或复制链接。';
        if (stringCache.size < MAX_STRING_CACHE) stringCache.set(trimmed, fixed);
        return text.replace(trimmed, fixed);
      }
      if (/Scan the code to.*(?:Remote Control|远程\\s*控制)/i.test(trimmed)) {
        const fixed = '扫描二维码以在远程控制中打开此设备';
        if (stringCache.size < MAX_STRING_CACHE) stringCache.set(trimmed, fixed);
        return text.replace(trimmed, fixed);
      }
    }

    if (/^Modify permissions for/i.test(trimmed)) {
      const fixed = '修改针对文件系统、终端命令以及 MCP 工具的安全权限。';
      if (stringCache.size < MAX_STRING_CACHE) stringCache.set(trimmed, fixed);
      return text.replace(trimmed, fixed);
    }

    if (/^(?:Tool[\\s ]+Permissions|工具[\\s ]*Permissions)$/i.test(trimmed)) {
      const fixed = '工具权限';
      if (stringCache.size < MAX_STRING_CACHE) stringCache.set(trimmed, fixed);
      return text.replace(trimmed, fixed);
    }

    if (/% of the (?:customization )?budget is (?:available|used)/i.test(trimmed)) {
      let fixed = trimmed;
      if (/^%\\s*of the (?:customization )?budget is available[.。]?$/i.test(trimmed)) {
        fixed = '% 的自定义额度可用。';
      } else if (/^%\\s*of the (?:customization )?budget is used[.。]?$/i.test(trimmed)) {
        fixed = '% 的自定义额度已使用。';
      } else if (/available/i.test(trimmed)) {
        fixed = trimmed.replace(/(\\d+(?:\\.\\d+)?)% of the (?:customization )?budget is available[.。]?/i, '自定义额度尚有 $1% 可用。');
      } else if (/used/i.test(trimmed)) {
        fixed = trimmed.replace(/(\\d+(?:\\.\\d+)?)% of the (?:customization )?budget is used[.。]?/i, '已使用 $1% 的自定义额度。');
      }
      if (stringCache.size < MAX_STRING_CACHE) stringCache.set(trimmed, fixed);
      return text.replace(trimmed, fixed);
    }

    if (/^Plugins are packaged collections of/i.test(trimmed)) {
      let fixed = '';
      if (/Google developer products/i.test(trimmed)) {
        if (/change your choices in Settings/i.test(trimmed)) {
          fixed = '插件是技能和 MCP 的打包集合，用于协助 Antigravity 中的智能体使用 Google 开发者产品。你可以随时在设置中更改你的选择。';
        } else {
          fixed = '插件是技能和 MCP 的打包集合，用于协助 Antigravity 中的智能体使用 Google 开发者产品。';
        }
      } else {
        fixed = '插件是技能和 MCP 的打包集合，用于协助智能体在';
      }
      if (stringCache.size < MAX_STRING_CACHE) stringCache.set(trimmed, fixed);
      return text.replace(trimmed, fixed);
    }

    if (/^You can always change your choices in Settings[.。]?$/i.test(trimmed)) {
      const fixed = '你可以随时在设置中更改你的选择。';
      if (stringCache.size < MAX_STRING_CACHE) stringCache.set(trimmed, fixed);
      return text.replace(trimmed, fixed);
    }

    if (/^Antigravity work with Google developer products/i.test(trimmed)) {
      let fixed = 'Antigravity 中协同 Google 开发者产品工作。';
      if (/change your choices in Settings/i.test(trimmed)) {
        fixed = 'Antigravity 中协同 Google 开发者产品工作。你可以随时在设置中更改你的选择。';
      }
      if (stringCache.size < MAX_STRING_CACHE) stringCache.set(trimmed, fixed);
      return text.replace(trimmed, fixed);
    }

    if (/^work with Google developer products/i.test(trimmed)) {
      let fixed = '协同 Google 开发者产品工作。';
      if (/change your choices in Settings/i.test(trimmed)) {
        fixed = '协同 Google 开发者产品工作。你可以随时在设置中更改你的选择。';
      }
      if (stringCache.size < MAX_STRING_CACHE) stringCache.set(trimmed, fixed);
      return text.replace(trimmed, fixed);
    }

    // --- Dynamic Agent Logs Regex Rules (Fixed Escaping) ---
    let dynamicMatch = trimmed;
    let isDynamic = false;
    
    // 用户定制方案 3：思考了 (时间) 与 总耗时 (时间) 动态正则
    if (/^Thought (?:for|持续) (.+)$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Thought (?:for|持续) (.+)$/i, '思考了 $1');
      isDynamic = true;
    }
    if (/^Worked (?:for|持续) (.+)$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Worked (?:for|持续) (.+)$/i, '总耗时 $1');
      isDynamic = true;
    }
    if (/^\\d+ files? changed(.*)$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^(\\d+) files? changed(.*)/i, '$1 个文件已更改$2');
      isDynamic = true;
    }
    if (/^(\\d+)\\s+searches?$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^(\\d+)\\s+searches?/i, '$1 次搜索');
      isDynamic = true;
    }
    if (/^Edited (.*) \\+(\\d+) -(\\d+)$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Edited (.*) \\+(\\d+) -(\\d+)/i, '编辑 $1 (+$2 -$3)');
      isDynamic = true;
    }
    if (/^Canceled taskkill/.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Canceled (.*)/, '已取消 $1');
      isDynamic = true;
    }
    if (/^\\d+(?:\\.\\d+)?% of the (?:customization )?budget is (?:available|used)[.。]?$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch
        .replace(/(\\d+(?:\\.\\d+)?)% of the (?:customization )?budget is available[.。]?/i, '自定义额度尚有 $1% 可用。')
        .replace(/(\\d+(?:\\.\\d+)?)% of the (?:customization )?budget is used[.。]?/i, '已使用 $1% 的自定义额度。');
      isDynamic = true;
    }

    // 限额剩余标题动态匹配 (例如 "Five Hour Limit Remaining", "Weekly Limit Remaining", "5-hour limit remaining")
    if (/^(Weekly|Five[- ]Hour|5[- ]Hour|Hourly|Daily)\\s+Limit\\s+Remaining$/i.test(trimmed)) {
      const lower = trimmed.toLowerCase();
      if (lower.includes('weekly')) dynamicMatch = '每周限额剩余';
      else if (lower.includes('five') || lower.includes('5')) dynamicMatch = '5 小时限额剩余';
      else if (lower.includes('hourly')) dynamicMatch = '每小时限额剩余';
      else if (lower.includes('daily')) dynamicMatch = '每日限额剩余';
      isDynamic = true;
    }

    // 配额提示句 (含动态天数/小时/分钟，支持全英或半中文状态下自愈清洗)
    if (/(?:You have used some of your|您已使用了部分).*(?:limit|限额)/i.test(trimmed)) {
      dynamicMatch = dynamicMatch
        .replace(/^(?:You have used some of your|您已使用了部分)\\s*(?:weekly|每周)\\s*(?:limit|限额)?/i, '您已使用了部分每周限额')
        .replace(/^(?:You have used some of your|您已使用了部分)\\s*(?:5[- ]hour|five[- ]hour|5 小时|五小时)\\s*(?:limit|限额)?/i, '您已使用了部分 5 小时限额')
        .replace(/^(?:You have used some of your|您已使用了部分)\\s*(?:hourly|每小时)\\s*(?:limit|限额)?/i, '您已使用了部分每小时限额')
        .replace(/^(?:You have used some of your|您已使用了部分)\\s*(?:daily|每日)\\s*(?:limit|限额)?/i, '您已使用了部分每日限额')
        .replace(/(?:it will fully refresh in|它将在以下时间后完全刷新[：:]?)\\s*/i, ' 它将在以下时间后完全刷新：')
        .replace(/(\\d+)\\s*days?/gi, ' $1 天')
        .replace(/(\\d+)\\s*hours?/gi, ' $1 小时')
        .replace(/(\\d+)\\s*minutes?\\.?$/gi, ' $1 分钟')
        .replace(/\\s+/g, ' ')
        .trim();
      isDynamic = true;
    }
    // 模型分组配额说明长句
    if (/^Within each group, models share/.test(trimmed)) {
      dynamicMatch = '在每个分组中，模型共享每周限额和 5 小时限额。配额按 token 成本比例消耗。因此，较短的任务或使用更具性价比的模型时，限额可持续更长时间。5 小时限额用于平滑总需求，以便在所有用户间公平分配全球容量，而每周限额则与您的个人等级直接挂钩。';
      isDynamic = true;
    }

    // 模型配额剩余动态匹配 (例如 "100% Remaining", "85.4% remaining")
    if (/^(\\d+(?:\\.\\d+)?%?)\\s+remaining$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^(\\d+(?:\\.\\d+)?%?)\\s+remaining$/i, '$1 剩余');
      isDynamic = true;
    }
    // 剩余时间刷新动态匹配 (例如 "15 minutes", "1 hour 26 minutes", "2 hours", "1 day")
    if (/^(\\d+)\\s+hours?\\s+(\\d+)\\s+minutes?$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^(\\d+)\\s+hours?\\s+(\\d+)\\s+minutes?$/i, '$1 小时 $2 分钟');
      isDynamic = true;
    }
    if (/^(\\d+)\\s+minutes?$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^(\\d+)\\s+minutes?$/i, '$1 分钟');
      isDynamic = true;
    }
    if (/^(\\d+)\\s+hours?$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^(\\d+)\\s+hours?$/i, '$1 小时');
      isDynamic = true;
    }
    if (/^(\\d+)\\s+days?$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^(\\d+)\\s+days?$/i, '$1 天');
      isDynamic = true;
    }

    // 项目/路径不存在的动态提示 (项目名 + " does not exist"，超3词无法走分词)
    if (/^.+ does not exist\\.?$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^(.+) does not exist\\.?$/i, '$1 不存在');
      isDynamic = true;
    }
    // "xxx was not found" 动态提示
    if (/^.+ was not found\\.?$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^(.+) was not found\\.?$/i, '$1 未找到');
      isDynamic = true;
    }

    // 步骤与回合动态提示
    if (/^Step \\d+ \\([^\\)]+\\):?$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Step (\\d+) \\(([^\\)]+)\\):?/i, '步骤 $1 ($2)：');
      isDynamic = true;
    }
    if (/^\\d+ turns?$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^(\\d+) turns?$/i, '$1 回合');
      isDynamic = true;
    }
    if (/^Turn \\d+$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Turn (\\d+)$/i, '第 $1 回合');
      isDynamic = true;
    }
    if (/^Task id "[^"]+" finished with result:$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Task id "([^"]+)" finished with result:$/i, '任务 "$1" 执行完成：');
      isDynamic = true;
    }
    if (/^Tool is running as a background task with task id: (.+)$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Tool is running as a background task with task id: (.+)$/i, '工具正在后台运行 (任务ID: $1)');
      isDynamic = true;
    }
    if (/^Thought (?:for|持续) (.+)$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Thought (?:for|持续) (.+)$/i, '思考了 $1');
      isDynamic = true;
    }
    if (/^Thinking (?:for|持续) (.+)$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Thinking (?:for|持续) (.+)$/i, '思考了 $1');
      isDynamic = true;
    }
    if (/^Thinking \\((.+)\\)$/i.test(trimmed)) {
      dynamicMatch = dynamicMatch.replace(/^Thinking \\((.+)\\)$/i, '正在思考 ($1)');
      isDynamic = true;
    }

    if (isDynamic) {
      return text.replace(trimmed, dynamicMatch);
    }
    // --- End Dynamic Regex ---

    // 1. Direct Literal Match (Exact match including punctuation)
    if (dictionary[trimmed]) {
      return text.replace(trimmed, dictionary[trimmed]);
    }

    // Normalizing internal multiple whitespace/newlines for multi-sentence cards
    const normalizedSpace = trimmed.replace(/\\s+/g, ' ');
    if (dictionary[normalizedSpace]) {
      return text.replace(trimmed, dictionary[normalizedSpace]);
    }
    
    const trimmedLower = trimmed.toLowerCase();
    for (const key in dictionary) {
      if (key.toLowerCase() === trimmedLower) {
        return text.replace(trimmed, dictionary[key]);
      }
    }

    // 2. Intelligent Punctuation Stripping & Reconstruction
    let core = trimmed;
    let trailPunc = '';
    let matchPunc = '';

    // Strip trailing common punctuation
    const puncRegex = /(\\.\\.\\.|…|\\.|\\?|!|:|：|？|！|。)$/;
    const match = core.match(puncRegex);
    if (match) {
      matchPunc = match[0];
      core = core.slice(0, -matchPunc.length).trim();
      
      // Determine the correct Chinese counterpart punctuation
      if (matchPunc === '.') trailPunc = '。';
      else if (matchPunc === '?') trailPunc = '？';
      else if (matchPunc === '!') trailPunc = '！';
      else if (matchPunc === ':') trailPunc = '：';
      else if (matchPunc === '：') trailPunc = '：';
      else if (matchPunc === '？') trailPunc = '？';
      else if (matchPunc === '！') trailPunc = '！';
      else if (matchPunc === '。') trailPunc = '。';
      else trailPunc = matchPunc; // keep ..., …
    }

    // Check stripped core in dictionary (O(1) exact or O(1) case-insensitive)
    const coreTranslated = dictionary[core] || lowerDictionary.get(core.toLowerCase()) || '';

    if (coreTranslated) {
      return text.replace(trimmed, coreTranslated + trailPunc);
    }

    // 3. Fallback to word-by-word ONLY for short strings (<= 3 words)
    // 如果短语中已经包含了中文字符（即原本就是汉化内容或中英混排），则严禁进入英文分词翻译
    // 这可以完美阻止像中英文混排短语被分词规则执行二次翻译导致重叠和污染
    if (/[\\u4e00-\\u9fa5]/.test(core)) {
      return text;
    }
    // This prevents long unmatched sentences from getting mangled into Chinglish.
    const wordsCount = core.split(/\\s+/).filter(Boolean).length;
    if (wordsCount > 3) {
      return text; // Do not translate, keep original English sentence clean
    }

    let replaced = false;
    let temp = core.replace(CORE_WORDS_UNION_REGEX, (matched) => {
      const lower = matched.toLowerCase();
      if (coreWords[lower]) {
        replaced = true;
        return coreWords[lower];
      }
      return matched;
    });

    let finalTranslated = replaced ? temp : core;
    // 消除中文字符之间可能由分词替换残留的英文空格，提升翻译句子的连贯精致度
    finalTranslated = finalTranslated.replace(/([\\u4e00-\\u9fa5])\\s+([\\u4e00-\\u9fa5])/g, '$1$2');
    // 特殊去重清洗：防止前置分词造成的“使用使用”与半中半英长句残留
    finalTranslated = finalTranslated.replace(/使用使用 Google 插件构建/g, '使用 Google 插件构建');
    finalTranslated = finalTranslated.replace(/Configure 智能体 执行[,\\s]+queued 消息 delivery[,\\s]+and 权限[。.]?/g, '配置智能体执行策略、消息队列发送机制以及安全权限。');
    finalTranslated = finalTranslated.replace(/Automatic 检查更新/g, '自动检查更新');
    finalTranslated = finalTranslated.replace(/每周限额\\s*Remaining/gi, '每周限额剩余');
    finalTranslated = finalTranslated.replace(/五小时限额\\s*Remaining/gi, '5 小时限额剩余');
    finalTranslated = finalTranslated.replace(/Claude and GPT 模型/g, 'Claude 与 GPT 模型');
    finalTranslated = finalTranslated.replace(/命令\\s*palette/gi, '命令面板');
    finalTranslated = finalTranslated.replace(/Scan the code to .*(?:copy link|复制链接)[。.]?/gi, '扫描二维码以在远程控制中打开此设备，或复制链接。');
    finalTranslated = finalTranslated.replace(/Scan the code to (?:打开|open) this (?:设备|device) in 远程\\s*(?:Control|控制)[,\\s]+or (?:复制链接|copy link)[。.]?/gi, '扫描二维码以在远程控制中打开此设备，或复制链接。');
    finalTranslated = finalTranslated.replace(/(?:工作了\\s*持续|总耗时\\s*持续|Worked for)\\s*(.+)/gi, '总耗时 $1');
    finalTranslated = finalTranslated.replace(/(?:Thought\\s*持续|思考了\\s*持续)\\s*(.+)/gi, '思考了 $1');
    finalTranslated = finalTranslated.replace(/查看\\s*could not be opened/gi, '查看文件无法打开');
    finalTranslated = finalTranslated.replace(/could not be opened/gi, '无法打开');
    finalTranslated = finalTranslated.replace(/(\\d+)\\s+searches?/gi, '$1 次搜索');
    if (matchPunc) {
      finalTranslated += trailPunc;
    }
    if (stringCache.size < MAX_STRING_CACHE) {
      stringCache.set(trimmed, finalTranslated);
    }
    return text.replace(trimmed, finalTranslated);
  }

  // 用于精确匹配代码编辑器、语法高亮等容器类名（收敛范围，防止误杀带 font-mono 或 viewer 的正常 UI）
  const codeClassPattern = /(?:^|[\\s_-])(monaco-editor|editor-instance|hljs|shiki|prism|codemirror|line-content|gutter|codeblock|code-block|code-line|view-line)(?:$|[\\s_-])/i;

  const skipCache = new WeakMap();

  function shouldSkipNode(node) {
    if (!node) return true;
    
    // 如果是文本节点，我们检查其父元素；如果是属性/元素节点，检查自身
    const element = node.nodeType === Node.TEXT_NODE ? node.parentElement : node;
    if (!element) return false;

    // 1. 记忆化缓存查询：O(1) 瞬间返回，消除折叠栏展开时的万次重复检查
    if (skipCache.has(element)) {
      return skipCache.get(element);
    }

    // 2. 绝对不能翻译的脚本/样式/按键标签
    const skipTags = ['SCRIPT', 'STYLE', 'NOSCRIPT', 'KBD', 'SAMP', 'VAR'];
    if (skipTags.includes(element.tagName)) {
      skipCache.set(element, true);
      return true;
    }

    // 思考过程触发药丸按钮（如“Thought for 4s”折叠栏标题）：必须放行汉化为“思考了 4s”
    const isThinkingTrigger = element.closest && element.closest('button[data-testid="thinking-collapsible-trigger"]');
    if (isThinkingTrigger) {
      skipCache.set(element, false);
      return false;
    }

    // 3. 特殊特权放行：针对执行步骤的药丸标签（如 Ran, Explored, Edited, Viewed, Thought, Thinking, Working 等）
    // 无论其父级为 SPAN、CODE 还是 BUTTON，只要是系统执行药丸且不在用户提问气泡内，一律无条件放行汉化
    const textContent = (element.innerText || element.textContent || '').trim();
    const isActionPill = textContent.length <= 25 && /^(Explored|Ran|Viewed|Edited|Thought|Thinking|Working)$/i.test(textContent);
    if (isActionPill) {
      let inUserInput = false;
      let inThinkingContent = false;
      let checkCur = element;
      while (checkCur && checkCur !== document.body) {
        if (checkCur.classList) {
          if (checkCur.classList.contains('group/user-input-step') || checkCur.classList.contains('cursor-edit')) {
            inUserInput = true;
            break;
          }
        }
        if (checkCur.parentElement) {
          const trigger = checkCur.parentElement.querySelector(':scope > button[data-testid="thinking-collapsible-trigger"]');
          if (trigger && checkCur !== trigger && !trigger.contains(checkCur)) {
            inThinkingContent = true;
            break;
          }
        }
        checkCur = checkCur.parentElement;
      }
      if (!inUserInput && !inThinkingContent) {
        skipCache.set(element, false);
        return false;
      }
    }

    if (element.tagName === 'CODE') {
      if (!isActionPill) {
        skipCache.set(element, true);
        return true;
      }
    }
    if (element.tagName === 'PRE') {
      skipCache.set(element, true);
      return true;
    }

    // 4. 输入框/文本域/富文本编辑器/用户提问气泡绝对跳过（输入前、输入中、发送后 100% 原样保留）
    if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
      skipCache.set(element, true);
      return true;
    }
    if (element.getAttribute && (
        element.getAttribute('contenteditable') === 'true' ||
        element.getAttribute('role') === 'textbox' ||
        element.getAttribute('data-lexical-editor') === 'true'
    )) {
      skipCache.set(element, true);
      return true;
    }

    // 5. 检查元素自身是否带有代码语言标记属性
    if (element.getAttribute) {
      if (element.getAttribute('data-language') || 
          element.getAttribute('data-code') ||
          element.getAttribute('data-line') ||
          element.getAttribute('data-line-number')) {
        skipCache.set(element, true);
        return true;
      }
    }

    // 6. 向上递归检查祖先节点（带路径记忆化剪枝）
    let cur = element;
    let shouldSkip = false;
    while (cur && cur !== document.body) {
      if (skipCache.has(cur)) {
        shouldSkip = skipCache.get(cur);
        break;
      }

      // 核心防御：模型思考链正文容器绝对跳过
      // 思考链为 AI 运行时生成的自由英文/动态推理流，切勿进行逐词或断句翻译，否则会导致中英夹杂混乱
      if (cur.classList && (
        cur.classList.contains('cursor-edit') ||
        cur.classList.contains('thought-content') ||
        cur.classList.contains('thinking-content') ||
        cur.classList.contains('thought-box')
      )) {
        shouldSkip = true;
        break;
      }

      // 思考折叠栏内容区域：位于 thinking-collapsible-trigger 旁的展开正文容器
      if (cur.parentElement) {
        const trigger = cur.parentElement.querySelector(':scope > button[data-testid="thinking-collapsible-trigger"]');
        if (trigger && cur !== trigger && !trigger.contains(cur)) {
          shouldSkip = true;
          break;
        }
      }

      // 用户输入框与富文本编辑器（输入前/输入中绝对不翻译）
      if (cur.getAttribute && (
          cur.getAttribute('contenteditable') === 'true' ||
          cur.getAttribute('role') === 'textbox' ||
          cur.getAttribute('data-lexical-editor') === 'true'
      )) {
        shouldSkip = true;
        break;
      }

      if (cur.getAttribute && (
          cur.getAttribute('data-language') || 
          cur.getAttribute('data-code') ||
          cur.getAttribute('data-line') ||
          cur.getAttribute('data-line-number') ||
          cur.getAttribute('role') === 'code'
      )) {
        shouldSkip = true;
        break;
      }

      if (cur.classList && (
        cur.classList.contains('group/user-input-step') ||
        cur.classList.contains('user-message') ||
        cur.classList.contains('cursor-text') ||
        cur.classList.contains('monaco-editor') || 
        cur.classList.contains('editor-instance') ||
        cur.classList.contains('input-area') ||
        cur.classList.contains('chat-input')
      )) {
        shouldSkip = true;
        break;
      }

      if (cur.className && typeof cur.className === 'string') {
        const lowerClass = cur.className.toLowerCase();
        if (
          lowerClass.includes('code-line') ||
          lowerClass.includes('view-line') ||
          codeClassPattern.test(cur.className)
        ) {
          shouldSkip = true;
          break;
        }
      }

      if (cur.tagName === 'PRE') {
        shouldSkip = true;
        break;
      }

      cur = cur.parentElement;
    }

    skipCache.set(element, shouldSkip);
    return shouldSkip;
  }

  // 性能优化 3：已处理文本节点记忆化 WeakSet，消除父容器重绘时的重复遍历
  const translatedNodes = new WeakSet();

  function translateNode(node) {
    if (!node) return;
    if (shouldSkipNode(node)) return;

    if (node.nodeType === Node.TEXT_NODE) {
      if (translatedNodes.has(node)) return;
      const original = node.nodeValue;
      if (!original || !original.trim()) return;
      const translated = translateString(original);
      if (original !== translated) {
        node.nodeValue = translated;
        translatedNodes.add(node);
      } else if (!/[a-zA-Z]/.test(original)) {
        translatedNodes.add(node);
      }
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      ['placeholder', 'title', 'aria-label', 'value'].forEach(attr => {
        if (node.hasAttribute && node.hasAttribute(attr)) {
          // 双重锁死：绝对不翻译任何输入框或编辑区的用户 value 属性
          if (attr === 'value' && (node.tagName === 'INPUT' || node.tagName === 'TEXTAREA')) {
            return;
          }
          const original = node.getAttribute(attr);
          if (original && (node.tagName !== 'INPUT' || node.type === 'button' || node.type === 'submit' || attr !== 'value')) {
            const translated = translateString(original);
            if (original !== translated) {
              node.setAttribute(attr, translated);
            }
          }
        }
      });
      if (node.shadowRoot) {
        observeRoot(node.shadowRoot);
        translateNode(node.shadowRoot);
      }
      for (let i = 0; i < node.childNodes.length; i++) {
        translateNode(node.childNodes[i]);
      }
    } else if (node.nodeType === Node.DOCUMENT_FRAGMENT_NODE) {
      for (let i = 0; i < node.childNodes.length; i++) {
        translateNode(node.childNodes[i]);
      }
    }
  }

  const observerConfig = {
    childList: true,
    subtree: true,
    characterData: true,
    attributes: true,
    attributeFilter: ['placeholder', 'title', 'aria-label', 'value']
  };

  const observedRoots = new WeakSet();
  let isTranslating = false;
  let batchRafHandle = null;
  const pendingAddedNodes = new Set();
  const pendingTextNodes = new Set();
  const pendingAttrNodes = new Map();

  const scheduleBatchFrame = (fn) => {
    if (typeof queueMicrotask === 'function') {
      queueMicrotask(fn);
    } else if (typeof requestAnimationFrame === 'function') {
      requestAnimationFrame(fn);
    } else {
      setTimeout(fn, 0);
    }
  };

  function scheduleBatchTranslation() {
    if (batchRafHandle !== null) return;
    batchRafHandle = true;
    scheduleBatchFrame(processBatchTranslation);
  }

  function processBatchTranslation() {
    batchRafHandle = null;
    if (isTranslating) return;
    isTranslating = true;

    try {
      // 1. 批量处理属性变更
      if (pendingAttrNodes.size > 0) {
        for (const [target, attrs] of pendingAttrNodes) {
          if (!shouldSkipNode(target)) {
            for (const attrName of attrs) {
              if (attrName === 'value' && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) {
                continue;
              }
              const original = target.getAttribute(attrName);
              if (original) {
                const translated = translateString(original);
                if (original !== translated) {
                  target.setAttribute(attrName, translated);
                }
              }
            }
          }
        }
        pendingAttrNodes.clear();
      }

      // 2. 批量处理文本变更 (characterData)
      if (pendingTextNodes.size > 0) {
        for (const node of pendingTextNodes) {
          if (!shouldSkipNode(node)) {
            const original = node.nodeValue;
            if (original && original.trim()) {
              const translated = translateString(original);
              if (original !== translated) {
                node.nodeValue = translated;
                translatedNodes.add(node);
              } else if (!/[a-zA-Z]/.test(original)) {
                translatedNodes.add(node);
              }
            }
          }
        }
        pendingTextNodes.clear();
      }

      // 3. 批量处理新增节点（性能优化 6：祖先包含剪枝，彻底消灭 O(N^2) 嵌套递归）
      if (pendingAddedNodes.size > 0) {
        const rootNodes = [];
        for (const node of pendingAddedNodes) {
          let hasAncestor = false;
          let p = node.parentElement;
          while (p) {
            if (pendingAddedNodes.has(p)) {
              hasAncestor = true;
              break;
            }
            p = p.parentElement;
          }
          if (!hasAncestor) {
            rootNodes.push(node);
          }
        }
        pendingAddedNodes.clear();

        for (let i = 0; i < rootNodes.length; i++) {
          const node = rootNodes[i];
          if (node.shadowRoot) {
            observeRoot(node.shadowRoot);
          }
          if (!shouldSkipNode(node)) {
            translateNode(node);
          }
        }
      }
    } catch (e) {
      console.error('Batch translation error:', e);
    } finally {
      isTranslating = false;
    }
  }

  function observeRoot(root) {
    if (!root || observedRoots.has(root)) return;
    observedRoots.add(root);

    const observer = new MutationObserver((mutations) => {
      let needsSchedule = false;
      for (let i = 0; i < mutations.length; i++) {
        const mutation = mutations[i];
        if (mutation.type === 'childList') {
          const added = mutation.addedNodes;
          for (let j = 0; j < added.length; j++) {
            const node = added[j];
            if (node.shadowRoot) {
              observeRoot(node.shadowRoot);
            }
            pendingAddedNodes.add(node);
            needsSchedule = true;
          }
        } else if (mutation.type === 'characterData') {
          translatedNodes.delete(mutation.target);
          pendingTextNodes.add(mutation.target);
          needsSchedule = true;
        } else if (mutation.type === 'attributes') {
          const target = mutation.target;
          let attrSet = pendingAttrNodes.get(target);
          if (!attrSet) {
            attrSet = new Set();
            pendingAttrNodes.set(target, attrSet);
          }
          attrSet.add(mutation.attributeName);
          needsSchedule = true;
        }
      }

      if (needsSchedule) {
        scheduleBatchTranslation();
      }
    });

    observer.observe(root, observerConfig);
  }

  // Hook attachShadow
  const originalAttachShadow = Element.prototype.attachShadow;
  Element.prototype.attachShadow = function() {
    const shadowRoot = originalAttachShadow.apply(this, arguments);
    observeRoot(shadowRoot);
    return shadowRoot;
  };

  function safeScan() {
    if (document.body) {
      try {
        translateNode(document.body);
      } catch (e) {
        console.error('Translation scan error:', e);
      }
      observeRoot(document.body);
    }
  }

  function startObserver() {
    safeScan();

    // 1. 渐进式多阶挂载兜底 (Progressive Mounting Backstop)
    // 应对托盘重开、温热加载下 React 异步挂载延迟与路由初次渲染
    [50, 150, 400, 1000, 2500].forEach(delay => {
      setTimeout(safeScan, delay);
    });

    // 2. 窗口激活 (Focus) 与可见性恢复 (VisibilityChange) 兜底
    // 无论是窗口从最小化还原、托盘重新唤醒，还是失焦后重新聚焦，自动触发增量补丁
    window.addEventListener('focus', safeScan);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        safeScan();
      }
    });

    // 3. 单页应用 (SPA) 路由切换监听 (History API Hook)
    // 保证在不同会话、项目切换、从欢迎根路径跳转至具体任务视图时即时汉化
    try {
      const origPushState = history.pushState;
      history.pushState = function() {
        const ret = origPushState.apply(this, arguments);
        setTimeout(safeScan, 50);
        return ret;
      };
      const origReplaceState = history.replaceState;
      history.replaceState = function() {
        const ret = origReplaceState.apply(this, arguments);
        setTimeout(safeScan, 50);
        return ret;
      };
      window.addEventListener('popstate', () => setTimeout(safeScan, 50));
    } catch (_) {}
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', startObserver);
  } else {
    startObserver();
  }


})();
`;

// Helper to replace text in file cleanly
function replaceInFile(filePath, target, replacement) {
  if (!fs.existsSync(filePath)) {
    throw new Error(`找不到要修改的文件: ${filePath}`);
  }
  let content = fs.readFileSync(filePath, 'utf-8');
  if (content.includes(replacement)) {
    log(`文件 ${path.basename(filePath)} 已经应用过此汉化修改，跳过。`);
    return;
  }
  content = content.replace(target, replacement);
  fs.writeFileSync(filePath, content, 'utf-8');
  log(`已成功修改 ${path.basename(filePath)}`);
}

// Perform localization modification operations on extracted files
function applyTranslations() {
  log('开始对解压的文件进行汉化替换和代码注入...');

  // 智能注入与版本热升级: 若目标文件已包含注入标记，则截断替换为最新版本；若不存在则追加注入。
  function injectOrUpdate(filePath, content, startMarker, desc) {
    if (!fs.existsSync(filePath)) {
      throw new Error(`找不到要修改的文件: ${filePath}`);
    }
    let existing = fs.readFileSync(filePath, 'utf-8');
    const markerIndex = existing.indexOf(startMarker);
    if (markerIndex !== -1) {
      existing = existing.substring(0, markerIndex).trimEnd() + '\n\n' + content;
      fs.writeFileSync(filePath, existing, 'utf-8');
      log(`已更新 ${path.basename(filePath)} 中的 ${desc} 为最新版本。`);
    } else {
      fs.appendFileSync(filePath, '\n\n' + content, 'utf-8');
      log(`已向 ${path.basename(filePath)} 注入 ${desc}。`);
    }
  }

  // 1. Inject DOM Localization in dist/preload.js
  const preloadPath = path.join(EXTRACT_DIR, 'dist', 'preload.js');
  injectOrUpdate(preloadPath, DOM_TRANSLATOR_INJECTION, '// Antigravity 2.0 Chinese Localization Engine', 'Web UI 实时汉化引擎');

  // 2. Inject DOM Localization in dist/ideInstall/wizardPreload.js
  const wizardPreloadPath = path.join(EXTRACT_DIR, 'dist', 'ideInstall', 'wizardPreload.js');
  injectOrUpdate(wizardPreloadPath, DOM_TRANSLATOR_INJECTION, '// Antigravity 2.0 Chinese Localization Engine', '新版向导 Web UI 汉化引擎');

  // 3. Localize dist/menu.js (Native Application Menu)
  const menuPath = path.join(EXTRACT_DIR, 'dist', 'menu.js');
  const menuInjectCode = `
const menuTranslationMap = {
  'File': '文件',
  'Edit': '编辑',
  'View': '视图',
  'Window': '窗口',
  'Help': '帮助',
  'New Window': '新建窗口',
  'Docs': '使用文档',
  'Toggle Developer Tools': '开发者工具',
  'Check for Updates': '检查更新',
  'Checking for Updates...': '正在检查更新...',
  'Downloading Update...': '正在下载更新...',
  'Restart to Update': '重启以应用更新',
  'Undo': '撤销',
  'Redo': '重做',
  'Cut': '剪切',
  'Copy': '复制',
  'Paste': '粘贴',
  'Select All': '全选',
  'Minimize': '最小化',
  'Close': '关闭',
  'Quit Antigravity': '退出 Antigravity',
  'About Antigravity': '关于 Antigravity',
  'Services': '服务',
  'Hide Antigravity': '隐藏 Antigravity',
  'Hide Others': '隐藏其他',
  'Show All': '显示全部',
  'Force Reload': '强制重新加载',
  'Reload': '重新加载',
  'Actual Size': '实际大小',
  'Zoom In': '放大',
  'Zoom Out': '缩小',
  'Toggle Full Screen': '切换全屏'
};
function translateMenu(menuItem) {
  if (menuItem.label && menuTranslationMap[menuItem.label]) {
    menuItem.label = menuTranslationMap[menuItem.label];
  }
  if (menuItem.submenu && menuItem.submenu.items) {
    menuItem.submenu.items.forEach(translateMenu);
  }
}
`;
  // Append definitions at the end of the file
  injectOrUpdate(menuPath, menuInjectCode, 'const menuTranslationMap = {', '原生菜单翻译映射');

  // Replace menu application step safely
  replaceInFile(
    menuPath,
    'electron_1.Menu.setApplicationMenu(menu);',
    `if (typeof translateMenu === 'function') { menu.items.forEach(translateMenu); } electron_1.Menu.setApplicationMenu(menu);`
  );

  // 4. Localize dist/tray.js (Native System Tray)
  const trayPath = path.join(EXTRACT_DIR, 'dist', 'tray.js');
  
  // Replace active agents counts
  replaceInFile(
    trayPath,
    `countItem.label =
                (count > 0 ? \`\${count}\` : 'No') +
                    ' agent' +
                    (count === 1 ? '' : 's') +
                    ' running';`,
    `countItem.label = count > 0 ? \`\${count} 个智能体运行中\` : '没有智能体在运行';`
  );

  // Replace default action labels in createTray
  replaceInFile(
    trayPath,
    `contextMenu = electron_1.Menu.buildFromTemplate(actions);`,
    `const translatedActions = actions.map(action => {
        if (action.label === 'No agents running') action.label = '没有智能体在运行';
        if (action.label && action.label.startsWith('Open ')) action.label = '打开 Antigravity';
        if (action.label === 'Quit') action.label = '退出';
        return action;
    });
    contextMenu = electron_1.Menu.buildFromTemplate(translatedActions);`
  );

  // 5. Localize dist/loadingOverlay.js (Starting loading screen)
  const loadingOverlayPath = path.join(EXTRACT_DIR, 'dist', 'loadingOverlay.js');
  if (fs.existsSync(loadingOverlayPath)) {
    replaceInFile(
      loadingOverlayPath,
      '<div class="text">Loading Antigravity</div>',
      '<div class="text">正在加载 Antigravity...</div>'
    );
  }

  log('汉化修改注入完成！');
}

// Full workflow runner
async function runLocalizationWorkflow(appDir) {
  const resourcesDir = getResourcesDir(appDir);
  const asarPath = path.join(resourcesDir, 'app.asar');
  const backupPath = path.join(resourcesDir, 'app.asar.bak');

  logs = [];
  log('=================== 开始汉化流程 ===================');
  log(`目标程序目录: ${appDir}`);

  // Check path
  if (!fs.existsSync(asarPath)) {
    throw new Error(`找不到 app.asar 路径: ${asarPath}\n请确认软件是否安装在指定路径。`);
  }

  // 1. Kill running instances
  killApp();

  // 2. Backup app.asar
  if (!fs.existsSync(backupPath)) {
    log('正在创建 app.asar 的初始安全备份...');
    fs.copyFileSync(asarPath, backupPath);
    log('安全备份创建成功：' + backupPath);
  } else {
    log('安全备份已存在，跳过备份。备份文件: ' + backupPath);
  }

  // 3. Clean up existing extract dir if any
  if (fs.existsSync(EXTRACT_DIR)) {
    log('正在清理历史解压目录...');
    if (typeof fs.rmSync === 'function') {
      fs.rmSync(EXTRACT_DIR, { recursive: true, force: true });
    } else {
      fs.rmdirSync(EXTRACT_DIR, { recursive: true });
    }
  }

  // 4. Unpack app.asar
  //    注意：必须解包当前 app.asar（而非 .bak 备份），因为 Electron 的
  //    app.asar.unpacked 配套目录不会被备份，从 .bak 解包会因缺失 unpacked
  //    文件而失败。重复注入问题由 applyTranslations() 内的幂等检查解决。
  log('正在解包 app.asar...');
  try {
    execSync(`${getAsarCmd()} extract "${asarPath}" "${EXTRACT_DIR}"`, { cwd: WORKSPACE_DIR });
    log('解包成功。');
  } catch (e) {
    throw new Error('解压 app.asar 失败: ' + e.message);
  }

  // 5. Apply modifications
  applyTranslations();

  // 6. Repack to temporary file
  const tempAsar = path.join(WORKSPACE_DIR, 'app.asar.temp');
  if (fs.existsSync(tempAsar)) {
    fs.unlinkSync(tempAsar);
  }

  log('正在将修改后的文件重新打包为 app.asar...');
  try {
    execSync(`${getAsarCmd()} pack "${EXTRACT_DIR}" "${tempAsar}" --unpack-dir "**/chrome-devtools-mcp/**"`, { cwd: WORKSPACE_DIR });
    log('打包成功。');
  } catch (e) {
    throw new Error('打包新 asar 失败: ' + e.message);
  }

  // 7. Deploy newly packed app.asar
  log('正在部署新的汉化 app.asar...');
  try {
    fs.copyFileSync(tempAsar, asarPath);
    fs.unlinkSync(tempAsar);
    log('汉化 app.asar 部署成功！');
  } catch (e) {
    throw new Error('复制汉化包到系统程序目录失败 (请检查是否有读写权限): ' + e.message);
  }

  log('🎉 Antigravity 2.0 一键汉化成功完成！现在您可以安全启动程序了。');
  log('=================== 汉化流程结束 ===================');
}

// Restore workflow
function runRestoreWorkflow(appDir) {
  const resourcesDir = getResourcesDir(appDir);
  const asarPath = path.join(resourcesDir, 'app.asar');
  const backupPath = path.join(resourcesDir, 'app.asar.bak');

  logs = [];
  log('=================== 开始还原流程 ===================');
  log(`目标程序目录: ${appDir}`);
  if (!fs.existsSync(backupPath)) {
    throw new Error('未找到备份文件 `app.asar.bak`。无法执行恢复！');
  }

  killApp();

  log('正在从备份恢复原始 app.asar...');
  try {
    fs.copyFileSync(backupPath, asarPath);
    log('还原原始 app.asar 成功！软件已恢复为纯英文版。');
  } catch (e) {
    throw new Error('恢复文件失败: ' + e.message);
  }
  log('=================== 还原流程结束 ===================');
}

const server = http.createServer((req, res) => {
  // CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // API routing
  if (req.url.startsWith('/api/status') && req.method === 'GET') {
    const urlObj = new URL(req.url, `http://${req.headers.host}`);
    const username = urlObj.searchParams.get('username') || '';
    const useDefault = urlObj.searchParams.get('useDefault') !== 'false';
    const customPath = urlObj.searchParams.get('customPath') || '';

    const appDir = getAppDir(username, useDefault, customPath);
    const resourcesDir = getResourcesDir(appDir);
    const asarPath = path.join(resourcesDir, 'app.asar');
    const backupPath = path.join(resourcesDir, 'app.asar.bak');

    const isInstalled = fs.existsSync(asarPath);
    const hasBackup = fs.existsSync(backupPath);
    const isRunning = isAppRunning();
    
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({
      isInstalled,
      hasBackup,
      isRunning,
      asarPath,
      backupPath,
      platform: process.platform,
      defaultUsername: getHostUsername()
    }));
  } 
  else if (req.url === '/api/localize' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const params = body ? JSON.parse(body) : {};
        const appDir = getAppDir(params.username, params.useDefault, params.customPath);
        runLocalizationWorkflow(appDir)
          .then(() => {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, logs }));
          })
          .catch((err) => {
            log(`汉化流程失败: ${err.message}`);
            res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: err.message, logs }));
          });
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: '请求解析失败: ' + e.message, logs }));
      }
    });
  } 
  else if (req.url === '/api/restore' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const params = body ? JSON.parse(body) : {};
        const appDir = getAppDir(params.username, params.useDefault, params.customPath);
        runRestoreWorkflow(appDir);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, logs }));
      } catch (err) {
        log(`恢复流程失败: ${err.message}`);
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: err.message, logs }));
      }
    });
  } 
  else if (req.url === '/api/launch' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const params = body ? JSON.parse(body) : {};
        const appDir = getAppDir(params.username, params.useDefault, params.customPath);

        if (process.platform === 'darwin') {
          // macOS: 使用 open 命令启动 .app 包
          // 提取以 .app 结尾的完整应用路径
          const match = appDir.match(/^.*\.app/);
          const appBundlePath = match ? match[0] : appDir;
          log(`正在尝试启动 Antigravity 2.0 (macOS: open -a ${appBundlePath})...`);
          spawn('open', ['-a', appBundlePath], { detached: true, stdio: 'ignore' }).unref();
          log('Antigravity 2.0 启动指令已发送。');
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({ success: true, logs }));
        } else {
          const exeName = process.platform === 'win32' ? 'Antigravity.exe' : 'antigravity';
          const appPath = path.join(appDir, exeName);
          log(`正在尝试启动 Antigravity 2.0 (路径: ${appPath})...`);
          if (fs.existsSync(appPath)) {
            spawn(appPath, [], { detached: true, stdio: 'ignore' }).unref();
            log('Antigravity 2.0 启动指令已发送。');
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: true, logs }));
          } else {
            res.writeHead(404, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({ success: false, error: '未找到可执行程序: ' + appPath, logs }));
          }
        }
      } catch (e) {
        res.writeHead(400, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: '请求解析失败: ' + e.message, logs }));
      }
    });
  }
  else if (req.url === '/api/kill' && req.method === 'POST') {
    try {
      killApp();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: true, logs }));
    } catch (e) {
      res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({ success: false, error: e.message, logs }));
    }
  }
  else if (req.url === '/api/clean-cache' && req.method === 'POST') {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => {
      try {
        const params = body ? JSON.parse(body) : {};
        const count = cleanAppCache(params.username);
        res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: true, cleanedCount: count, logs }));
      } catch (e) {
        res.writeHead(500, { 'Content-Type': 'application/json; charset=utf-8' });
        res.end(JSON.stringify({ success: false, error: e.message, logs }));
      }
    });
  }
  else if (req.url === '/api/logs' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ logs }));
  }
  else if (req.url === '/api/check-release' && req.method === 'GET') {
    const options = {
      hostname: 'api.github.com',
      path: '/repos/liominsb/Antigravity-Chinese-Localization/releases/latest',
      headers: {
        'User-Agent': 'Antigravity-Chinese-Localization-Console'
      },
      timeout: 8000
    };

    const ghReq = https.get(options, (ghRes) => {
      let data = '';
      ghRes.on('data', chunk => { data += chunk; });
      ghRes.on('end', () => {
        try {
          if (ghRes.statusCode >= 200 && ghRes.statusCode < 300) {
            const release = JSON.parse(data);
            const latestTag = release.tag_name || '';
            const cleanLatest = latestTag.replace(/^[vV]/, '');
            const hasUpdate = compareVersions(cleanLatest, CURRENT_VERSION) > 0;
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              success: true,
              currentVersion: CURRENT_VERSION,
              latestVersion: cleanLatest,
              hasUpdate,
              releaseName: release.name || latestTag,
              releaseUrl: release.html_url,
              publishedAt: release.published_at,
              body: release.body || ''
            }));
          } else {
            res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
            res.end(JSON.stringify({
              success: false,
              currentVersion: CURRENT_VERSION,
              error: `GitHub API 响应异常 (HTTP ${ghRes.statusCode})`
            }));
          }
        } catch (err) {
          res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
          res.end(JSON.stringify({
            success: false,
            currentVersion: CURRENT_VERSION,
            error: '解析 GitHub Release 数据失败: ' + err.message
          }));
        }
      });
    });

    ghReq.on('error', (err) => {
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: false,
        currentVersion: CURRENT_VERSION,
        error: '连接 GitHub 失败: ' + err.message
      }));
    });

    ghReq.on('timeout', () => {
      ghReq.destroy();
      res.writeHead(200, { 'Content-Type': 'application/json; charset=utf-8' });
      res.end(JSON.stringify({
        success: false,
        currentVersion: CURRENT_VERSION,
        error: '请求 GitHub API 超时 (网络连接受限)'
      }));
    });
  }
  // Serve the dashboard
  else if (req.url === '/' || req.url === '/index.html') {
    const indexPath = path.join(WORKSPACE_DIR, 'index.html');
    if (fs.existsSync(indexPath)) {
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      res.end(fs.readFileSync(indexPath));
    } else {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('index.html not found.');
    }
  } 
  else {
    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
  }
});

if (process.argv.includes('--now')) {
  const defaultAppDir = getAppDir(getHostUsername(), true, '');
  runLocalizationWorkflow(defaultAppDir)
    .then(() => {
      console.log('🎉 汉化打包部署成功！');
      process.exit(0);
    })
    .catch((err) => {
      console.error('❌ 汉化出错:', err.message);
      process.exit(1);
    });
} else {
  server.on('error', (err) => {
    if (err.code === 'EADDRINUSE') {
      console.log(`\n======================================================`);
      console.log(` [提示] Antigravity 2.0 汉化服务已经在运行中！(端口 ${PORT})`);
      console.log(` 本地管理面板: http://localhost:${PORT}`);
      console.log(`======================================================\n`);
    } else {
      console.error('服务启动异常:', err.message);
    }
  });

  server.listen(PORT, () => {
    console.log(`\n======================================================`);
    console.log(` Antigravity 2.0 汉化服务已在后台运行！`);
    console.log(` 本地管理面板: http://localhost:${PORT}`);
    console.log(`======================================================\n`);
  });
}
