'use strict';

const assert = require('node:assert/strict');
const { loadTranslatorSandbox } = require('./helpers/translator-loader');

function matchesSimpleSelector(el, singleSel) {
  const s = singleSel.trim();
  if (!s) return false;
  const attrMatch = s.match(/^([a-zA-Z0-9_-]+)?\[([^=\]]+)(?:="([^"]*)")?\]$/);
  if (attrMatch) {
    const [, tag, attr, val] = attrMatch;
    if (tag && el.tagName !== tag.toUpperCase()) return false;
    if (!el.hasAttribute(attr)) return false;
    return val === undefined ? true : el.getAttribute(attr) === val;
  }
  if (s.startsWith('.')) {
    const rawCls = s.slice(1).replace(/\\\//g, '/');
    return el.classList.contains(rawCls);
  }
  return el.tagName === s.toUpperCase();
}

function createElement(tagName, attributes = {}, children = [], { withClosest = true } = {}) {
  const attrs = { ...attributes };
  const classes = String(attrs.class || '').split(/\s+/).filter(Boolean);
  const node = {
    nodeType: 1,
    tagName: tagName.toUpperCase(),
    className: attrs.class || '',
    classList: { contains: (name) => classes.includes(name) },
    childNodes: children,
    firstChild: children[0] ?? null,
    parentElement: null,
    hasAttribute: (name) => Object.hasOwn(attrs, name),
    getAttribute: (name) => (Object.hasOwn(attrs, name) ? attrs[name] : null),
    setAttribute: (name, value) => { attrs[name] = value; },
    get textContent() {
      return this.childNodes.map((c) => (c.nodeType === 3 ? c.nodeValue : c.textContent)).join('');
    },
  };
  if (withClosest) {
    node.matches = (selectorList) => String(selectorList)
      .split(',')
      .some((sel) => matchesSimpleSelector(node, sel));
    node.closest = (selectorList) => {
      let cur = node;
      while (cur && cur.nodeType === 1) {
        if (cur.matches(selectorList)) return cur;
        cur = cur.parentElement;
      }
      return null;
    };
  }
  for (const child of children) {
    child.parentElement = node;
  }
  return node;
}

function createText(value) {
  return { nodeType: 3, nodeValue: value, parentElement: null };
}

// 1. 左侧边栏项目标题卡片（完整属性：data-project-card="true" + data-testid="project-header"）
const devText = createText('Developer');
const devSpan = createElement('span', { title: 'Developer' }, [devText]);
const devHeader = createElement('button', {
  'data-project-card': 'true',
  'data-testid': 'project-header',
  title: 'Developer',
  'aria-label': 'Project',
}, [devSpan]);

// 2. 命中 isActionPill 特权词的项目名（Run / Done）
const runText = createText('Run');
const runSpan = createElement('span', {}, [runText]);
const runHeader = createElement('button', {
  'data-project-card': 'true',
  'data-testid': 'project-header',
}, [runSpan]);

// 3. 短词拼接（coreWords）项目名（Agent Tools）与仅带 data-project-card="true" 的按钮
const agentToolsText = createText('Agent Tools');
const cardOnlyHeader = createElement('button', {
  'data-project-card': 'true',
  title: 'Docs',
}, [createElement('span', {}, [agentToolsText])]);

// 4. 仅带 data-testid="project-header"（无 closest 方法，验证祖先遍历兜底分支）
const projectText = createText('Project');
const noClosestSpan = createElement('span', {}, [projectText], { withClosest: false });
const headerOnlyDiv = createElement('div', {
  'data-testid': 'project-header',
}, [noClosestSpan], { withClosest: false });

// 5. project-header 内部不应被 translateComposerLabel 穿透
const protectedVoiceInsideHeader = createElement('button', {
  'aria-label': 'Start Voice mode',
});
const headerWithAria = createElement('button', {
  'data-project-card': 'true',
  'data-testid': 'project-header',
  'aria-label': 'Message input',
}, [protectedVoiceInsideHeader]);

// 6. 同级侧边栏分区标题与项目行右侧兄弟按钮（应正常汉化）
const sectionHeadingText = createText('Projects');
const sectionHeading = createElement('div', {
  'data-sidebar-section-drop-id': 'main-section-header',
}, [createElement('span', {}, [sectionHeadingText])]);

const siblingActionText = createText('New Conversation');
const siblingActionBtn = createElement('button', {
  title: 'Settings',
}, [siblingActionText]);

const projectRowWrapper = createElement('div', {
  'data-sidebar-section-drop-id': 'file:///Users/demo/Developer',
  'data-index': '1',
}, [devHeader, siblingActionBtn]);

// 7. 复用同一 project-header 组件的系统内置分组标题（按状态 / 按环境 / 独立 / Unknown Project）：应正常汉化
function makeGroupRow(dropId, label, icon = 'custom') {
  const txt = createText(label);
  const span = createElement('span', {}, [txt]);
  const btn = createElement('button', {
    'data-project-card': 'true',
    'data-testid': 'project-header',
    'data-project-label': label,
    'data-project-icon': icon,
  }, [span]);
  const row = dropId
    ? createElement('div', { 'data-sidebar-section-drop-id': dropId }, [btn])
    : btn;
  return { row, btn, txt };
}

const sysBlocked = makeGroupRow('status-blocked', 'Blocked');
const sysInProgress = makeGroupRow('status-in-progress', 'In Progress');
const sysIdle = makeGroupRow('status-idle', 'Idle');
const sysLocal = makeGroupRow('location-local', 'This Computer');
const sysRemote = makeGroupRow('location-cloud', 'Remote');
const sysStandalone = makeGroupRow('standalone', 'Standalone', 'folder');
const sysUnknown = makeGroupRow('proj-unknown-id', 'Unknown Project', 'folder');
const sysDetachedCustom = makeGroupRow(null, 'This Computer', 'custom');

// 8. 与系统分组同名撞词的真实用户项目目录 & 用户自定义对话分组（convgroup:*）：必须严格跳过保护
const userFolderRemote = makeGroupRow('file:///Users/demo/Remote', 'Remote', 'folder');
const userFolderBlocked = makeGroupRow('file:///Users/demo/Blocked', 'Blocked', 'folder');
const userConvGroupRemote = makeGroupRow('convgroup:custom-1', 'Remote', 'custom');

const sidebarContainer = createElement('div', {
  'data-sidebar-scroll-container': 'true',
}, [
  sectionHeading,
  projectRowWrapper,
  runHeader,
  cardOnlyHeader,
  headerOnlyDiv,
  headerWithAria,
  sysBlocked.row,
  sysInProgress.row,
  sysIdle.row,
  sysLocal.row,
  sysRemote.row,
  sysStandalone.row,
  sysUnknown.row,
  sysDetachedCustom.row,
  userFolderRemote.row,
  userFolderBlocked.row,
  userConvGroupRemote.row,
]);

const body = createElement('body', {}, [sidebarContainer]);

let notifyObserver;
const { shouldSkipNode, translateNode } = loadTranslatorSandbox({
  document: { body, readyState: 'complete', addEventListener() {} },
  MutationObserver: class {
    constructor(callback) { notifyObserver = callback; }
    observe() {}
  },
});

// 验证 shouldSkipNode 精确判定
assert.equal(shouldSkipNode(devText), true, 'project-header 内文本应跳过');
assert.equal(shouldSkipNode(devHeader), true, 'project-header 按钮自身应跳过');
assert.equal(shouldSkipNode(runText), true, 'project-header 内命中 isActionPill 的 Run 仍应跳过');
assert.equal(shouldSkipNode(agentToolsText), true, 'button[data-project-card="true"] 内文本应跳过');
assert.equal(shouldSkipNode(projectText), true, '无 closest 环境下 data-testid="project-header" 祖先仍应跳过');
assert.equal(shouldSkipNode(sectionHeadingText), false, '侧边栏分区标题 Projects 不应跳过');
assert.equal(shouldSkipNode(siblingActionText), false, '项目行兄弟操作按钮不应跳过');

// 验证首屏扫描结果：项目名与属性全部保持原样，侧边栏 UI 控件正常汉化
assert.equal(devText.nodeValue, 'Developer');
assert.equal(devSpan.getAttribute('title'), 'Developer');
assert.equal(devHeader.getAttribute('title'), 'Developer');
assert.equal(devHeader.getAttribute('aria-label'), 'Project');
assert.equal(runText.nodeValue, 'Run');
assert.equal(agentToolsText.nodeValue, 'Agent Tools');
assert.equal(cardOnlyHeader.getAttribute('title'), 'Docs');
assert.equal(projectText.nodeValue, 'Project');
assert.equal(headerWithAria.getAttribute('aria-label'), 'Message input');
assert.equal(protectedVoiceInsideHeader.getAttribute('aria-label'), 'Start Voice mode');
assert.equal(sectionHeadingText.nodeValue, '项目');
assert.equal(siblingActionText.nodeValue, '新建对话');
assert.equal(siblingActionBtn.getAttribute('title'), '设置');

// 验证 MutationObserver 增量变更（characterData / attributes / childList）同样保护项目名
devText.nodeValue = 'Tools';
devHeader.setAttribute('title', 'Workspace');
devHeader.setAttribute('aria-label', 'Message input');
const dynamicNameText = createText('Docs');
const dynamicHeader = createElement('button', {
  'data-project-card': 'true',
  'data-testid': 'project-header',
  title: 'Tools',
}, [createElement('span', {}, [dynamicNameText])]);
sidebarContainer.childNodes.push(dynamicHeader);
dynamicHeader.parentElement = sidebarContainer;

notifyObserver([
  { type: 'characterData', target: devText },
  { type: 'attributes', target: devHeader, attributeName: 'title' },
  { type: 'attributes', target: devHeader, attributeName: 'aria-label' },
  { type: 'childList', addedNodes: [dynamicHeader] },
]);

assert.equal(devText.nodeValue, 'Tools');
assert.equal(devHeader.getAttribute('title'), 'Workspace');
assert.equal(devHeader.getAttribute('aria-label'), 'Message input');
assert.equal(dynamicNameText.nodeValue, 'Docs');
assert.equal(dynamicHeader.getAttribute('title'), 'Tools');

// 验证直接调用 translateNode 也不会误译动态项目卡片
translateNode(dynamicHeader);
assert.equal(dynamicNameText.nodeValue, 'Docs');
assert.equal(dynamicHeader.getAttribute('title'), 'Tools');

// 验证系统内置分组标题放行汉化，且不误伤同名用户目录或自定义对话分组
assert.equal(shouldSkipNode(sysBlocked.txt), false, 'status-blocked 系统分组应放行汉化');
assert.equal(shouldSkipNode(sysInProgress.txt), false, 'status-in-progress 系统分组应放行汉化');
assert.equal(shouldSkipNode(sysIdle.txt), false, 'status-idle 系统分组应放行汉化');
assert.equal(shouldSkipNode(sysLocal.txt), false, 'location-local 系统分组应放行汉化');
assert.equal(shouldSkipNode(sysRemote.txt), false, 'location-cloud 系统分组应放行汉化');
assert.equal(shouldSkipNode(sysStandalone.txt), false, 'standalone 系统分组应放行汉化');
assert.equal(shouldSkipNode(sysUnknown.txt), false, 'Unknown Project 占位应放行汉化');
assert.equal(shouldSkipNode(sysDetachedCustom.txt), false, '无外层 drop-id 时 custom 图标系统分组兜底应放行');

assert.equal(sysBlocked.txt.nodeValue, '已阻止');
assert.equal(sysInProgress.txt.nodeValue, '进行中');
assert.equal(sysIdle.txt.nodeValue, '空闲');
assert.equal(sysLocal.txt.nodeValue, '本机');
assert.equal(sysRemote.txt.nodeValue, '远程');
assert.equal(sysStandalone.txt.nodeValue, '独立');
assert.equal(sysUnknown.txt.nodeValue, '未知项目');
assert.equal(sysDetachedCustom.txt.nodeValue, '本机');

assert.equal(shouldSkipNode(userFolderRemote.txt), true, '名为 Remote 的真实用户项目目录必须跳过');
assert.equal(shouldSkipNode(userFolderBlocked.txt), true, '名为 Blocked 的真实用户项目目录必须跳过');
assert.equal(shouldSkipNode(userConvGroupRemote.txt), true, '名为 Remote 的用户自定义分组(convgroup:*)必须跳过');
assert.equal(userFolderRemote.txt.nodeValue, 'Remote');
assert.equal(userFolderBlocked.txt.nodeValue, 'Blocked');
assert.equal(userConvGroupRemote.txt.nodeValue, 'Remote');

// 9. 对话悬浮卡片（I2c + b6）：带 data-project-glyph 的项目名行保持原样，后续时间/状态/类型行正常汉化
const hoverProjectText = createText('Developer');
const hoverProjectSpan = createElement('span', { class: 'truncate' }, [hoverProjectText]);
const hoverProjectRow = createElement('div', { class: 'flex items-center gap-1 text-sm text-muted-foreground' }, [
  createElement('span', { class: 'shrink-0 flex items-center' }, [
    createElement('svg', { 'data-project-glyph': 'folder' }, []),
  ]),
  hoverProjectSpan,
]);

const hoverRunProjectText = createText('Run');
const hoverRunProjectRow = createElement('div', { class: 'flex items-center gap-1 text-sm text-muted-foreground' }, [
  createElement('span', { class: 'shrink-0 flex items-center' }, [
    createElement('svg', { 'data-project-glyph': 'cloud' }, []),
  ]),
  createElement('span', { class: 'truncate' }, [hoverRunProjectText]),
]);

const hoverUpdatedText = createText('Updated 10:59');
const hoverUpdatedRow = createElement('div', { class: 'flex items-center gap-1 text-sm text-muted-foreground' }, [
  createElement('span', { class: 'shrink-0 flex items-center' }, [createElement('svg', {}, [])]),
  createElement('span', { class: 'truncate' }, [hoverUpdatedText]),
]);

const hoverWorkingText = createText('Working');
const hoverWorkingRow = createElement('div', { class: 'flex items-center gap-1 text-sm text-muted-foreground' }, [
  createElement('span', { class: 'shrink-0 flex items-center' }, [createElement('svg', {}, [])]),
  createElement('span', { class: 'truncate' }, [hoverWorkingText]),
]);

const hoverCard = createElement('div', { class: 'flex flex-col gap-1.5' }, [
  hoverProjectRow,
  hoverUpdatedRow,
  hoverWorkingRow,
  hoverRunProjectRow,
]);
body.childNodes.push(hoverCard);
hoverCard.parentElement = body;
translateNode(hoverCard);

assert.equal(shouldSkipNode(hoverProjectText), true, '悬浮卡片项目名 Developer 必须跳过');
assert.equal(shouldSkipNode(hoverRunProjectText), true, '悬浮卡片命中 isActionPill 的项目名 Run 必须跳过');
assert.equal(shouldSkipNode(hoverUpdatedText), false, '悬浮卡片紧随项目行后的 Updated 时间戳必须放行');
assert.equal(shouldSkipNode(hoverWorkingText), false, '悬浮卡片状态行 Working 必须放行');
assert.equal(hoverProjectText.nodeValue, 'Developer');
assert.equal(hoverRunProjectText.nodeValue, 'Run');
assert.equal(hoverUpdatedText.nodeValue, '更新于 10:59');
assert.equal(hoverWorkingText.nodeValue, '正在工作');

// 10. 侧边栏对话副标题 / 搜索结果（直连 <svg data-project-glyph> + <span>项目名</span>）
const subtitleDevText = createText('Developer');
const subtitleUnknownText = createText('Unknown Project');
const subtitleRow = createElement('span', { class: 'flex items-center gap-1' }, [
  createElement('svg', { 'data-project-glyph': 'folder' }, []),
  createElement('span', { class: 'truncate' }, [subtitleDevText]),
  createElement('svg', { 'data-project-glyph': 'folder' }, []),
  createElement('span', { class: 'truncate' }, [subtitleUnknownText]),
]);
body.childNodes.push(subtitleRow);
subtitleRow.parentElement = body;
translateNode(subtitleRow);

assert.equal(shouldSkipNode(subtitleDevText), true, '直连 data-project-glyph 后的项目名 Developer 必须跳过');
assert.equal(subtitleDevText.nodeValue, 'Developer');
assert.equal(subtitleUnknownText.nodeValue, '未知项目');

// 11. 设置页左侧边栏（settings-sidebar）：仅跳过 Projects/Workspaces 分组下的用户项目项，放行官方 Developer 设置项、Show All 与 Not in Project
function makeSettingsNavItem(name) {
  const txt = createText(name);
  const btn = createElement('button', {
    type: 'button',
    'data-testid': `settings-nav-item-${name}`,
  }, [createElement('span', {}, [txt])]);
  const wrapper = createElement('div', { class: 'relative group/nav-item mx-2' }, [btn]);
  return { wrapper, btn, txt };
}

const settingsOfficialDev = makeSettingsNavItem('Developer');
const settingsProjectDev = makeSettingsNavItem('Developer');
const settingsProjectRun = makeSettingsNavItem('Run');
const settingsShowAllText = createText('Show All');
const settingsShowAllBtn = createElement('button', { type: 'button' }, [settingsShowAllText]);
const settingsWorkspaceTools = makeSettingsNavItem('Tools');
const settingsNotInProjectConv = makeSettingsNavItem('Conversations');
const settingsProjectsH2Text = createText('Projects');

const settingsSidebar = createElement('div', { 'data-testid': 'settings-sidebar' }, [
  createElement('div', { class: 'flex-1 flex flex-col gap-1 py-3 overflow-y-auto' }, [
    createElement('div', { class: 'px-4' }, [createElement('h1', {}, [createText('Settings')])]),
    createElement('div', { class: 'flex flex-col gap-0.5' }, [settingsOfficialDev.wrapper]),
    createElement('div', { class: 'px-4 mt-2' }, [createElement('h2', {}, [createText('Workspaces')])]),
    createElement('div', { class: 'flex flex-col gap-0.5' }, [settingsWorkspaceTools.wrapper]),
    createElement('div', { class: 'px-4 mt-2' }, [createElement('h2', {}, [settingsProjectsH2Text])]),
    createElement('div', { class: 'flex flex-col gap-0.5' }, [
      settingsProjectDev.wrapper,
      settingsProjectRun.wrapper,
      settingsShowAllBtn,
    ]),
    createElement('div', { class: 'px-4 mt-2' }, [createElement('h2', {}, [createText('Not in Project')])]),
    createElement('div', { class: 'flex flex-col gap-0.5' }, [settingsNotInProjectConv.wrapper]),
  ]),
]);
body.childNodes.push(settingsSidebar);
settingsSidebar.parentElement = body;
translateNode(settingsSidebar);

assert.equal(settingsProjectsH2Text.nodeValue, '项目', '设置页 Projects 分组标题本身应正常汉化');
assert.equal(settingsOfficialDev.txt.nodeValue, '开发者', '设置页顶部 Settings 分组下的官方 Developer 开发者模式项必须正常汉化');
assert.equal(settingsProjectDev.txt.nodeValue, 'Developer', '设置页 Projects 分组下的项目名 Developer 必须跳过');
assert.equal(settingsProjectRun.txt.nodeValue, 'Run', '设置页 Projects 分组下撞 isActionPill 的项目名 Run 必须跳过');
assert.equal(settingsShowAllText.nodeValue, '显示全部', '设置页 Projects 分组下的 Show All 按钮必须正常汉化');
assert.equal(settingsWorkspaceTools.txt.nodeValue, 'Tools', '设置页 Workspaces 分组下的工作区名 Tools 必须跳过');
assert.equal(settingsNotInProjectConv.txt.nodeValue, '对话', '设置页 Not in Project 分组下的 Conversations 必须正常汉化');

// 验证分组标题已被汉化为「项目」后，增量新增/修改项目名依然保持保护
settingsProjectDev.txt.nodeValue = 'Docs';
notifyObserver([{ type: 'characterData', target: settingsProjectDev.txt }]);
assert.equal(settingsProjectDev.txt.nodeValue, 'Docs');

// 12. 设置页右侧项目详情大标题（紧邻 Edit project name 编辑按钮）
const settingsTitleText = createText('Developer');
const settingsTitleSpan = createElement('span', { class: 'text-xl font-medium truncate' }, [settingsTitleText]);
const settingsEditBtn = createElement('button', { 'aria-label': 'Edit project name' }, [createElement('svg', {}, [])]);
const settingsFoldersText = createText('Folders');
const settingsDetailPanel = createElement('div', {}, [
  createElement('div', { class: 'flex items-center gap-2 h-7' }, [settingsTitleSpan, settingsEditBtn]),
  createElement('h2', {}, [settingsFoldersText]),
]);
body.childNodes.push(settingsDetailPanel);
settingsDetailPanel.parentElement = body;
translateNode(settingsDetailPanel);

assert.equal(settingsTitleText.nodeValue, 'Developer', '设置页右侧项目大标题 Developer 必须跳过');
assert.equal(settingsFoldersText.nodeValue, '文件夹', '设置页右侧 Folders 分区标题应正常汉化');

// 验证编辑按钮 aria-label 变为中文后，切换项目名依旧跳过
settingsEditBtn.setAttribute('aria-label', '编辑项目名称');
settingsTitleText.nodeValue = 'Tools';
notifyObserver([{ type: 'characterData', target: settingsTitleText }]);
assert.equal(settingsTitleText.nodeValue, 'Tools');

// 13. 对话顶部面包屑中的项目名（[data-testid="breadcrumb-segment"] + aria-label="Project: ..."）
const breadcrumbDevText = createText('Developer');
const breadcrumbDevLink = createElement('a', {
  'data-testid': 'breadcrumb-segment',
  'aria-label': 'Project: Developer',
}, [createElement('span', {}, [breadcrumbDevText])]);
const breadcrumbNewProjectText = createText('New Project');
const breadcrumbNewProjectLink = createElement('a', {
  'data-testid': 'breadcrumb-segment',
  'aria-label': 'Project: New Project',
}, [createElement('span', {}, [breadcrumbNewProjectText])]);
const breadcrumbNav = createElement('nav', { 'aria-label': 'Breadcrumb' }, [
  breadcrumbDevLink,
  breadcrumbNewProjectLink,
]);
body.childNodes.push(breadcrumbNav);
breadcrumbNav.parentElement = body;
translateNode(breadcrumbNav);

assert.equal(breadcrumbDevText.nodeValue, 'Developer', '顶部面包屑项目名 Developer 必须跳过');
assert.equal(breadcrumbDevLink.getAttribute('aria-label'), 'Project: Developer');
assert.equal(breadcrumbNewProjectText.nodeValue, '新建项目', '顶部面包屑 New Project 占位应正常汉化');

// 14. 补充精修回归：窄屏平铺设置页（sXb 无 settings-sidebar 容器）、桌面端无 Not in Project 时底部 Provide Feedback 防误伤、Workspace 占位词放行
const narrowSettingsDev = makeSettingsNavItem('Developer');
const narrowWs1 = makeSettingsNavItem('Developer');
const narrowWs2 = makeSettingsNavItem('Tools');
const narrowWs3 = makeSettingsNavItem('Run');
const narrowFeedback = makeSettingsNavItem('Provide Feedback');
const narrowSettingsList = createElement('div', { class: 'relative h-full w-full overflow-hidden' }, [
  createElement('div', { class: 'px-4 pt-3 pb-1' }, [createElement('h2', {}, [createText('Settings')])]),
  narrowSettingsDev.btn,
  narrowFeedback.btn,
  createElement('div', { class: 'px-4 pt-3 pb-1' }, [createElement('h2', {}, [createText('Workspaces')])]),
  narrowWs1.btn,
  narrowWs2.btn,
  narrowWs3.btn,
]);
// 调整平铺节点的 parentElement（makeSettingsNavItem 原本包了一层 wrapper）
for (const item of [narrowSettingsDev, narrowFeedback, narrowWs1, narrowWs2, narrowWs3]) {
  item.btn.parentElement = narrowSettingsList;
}
body.childNodes.push(narrowSettingsList);
narrowSettingsList.parentElement = body;
translateNode(narrowSettingsList);

assert.equal(narrowSettingsDev.txt.nodeValue, '开发者', '窄屏 Settings 分组下官方 Developer 必须正常汉化');
assert.equal(narrowFeedback.txt.nodeValue, '提供反馈', '窄屏 Settings 分组下 Provide Feedback 必须正常汉化');
assert.equal(narrowWs1.txt.nodeValue, 'Developer', '窄屏 Workspaces 分组下第 1 个工作区 Developer 必须跳过');
assert.equal(narrowWs2.txt.nodeValue, 'Tools', '窄屏 Workspaces 分组下第 2 个工作区 Tools 必须跳过');
assert.equal(narrowWs3.txt.nodeValue, 'Run', '窄屏 Workspaces 分组下第 3 个工作区 Run 必须跳过');

// 桌面端 settings-sidebar 隐藏 Not in Project 时，底部 Provide Feedback 经 flex-1 隔断不可误判为 Projects 分组项
const desktopProjOnly = makeSettingsNavItem('Developer');
const desktopBottomFeedback = makeSettingsNavItem('Provide Feedback');
const desktopSidebarNoStandalone = createElement('div', { 'data-testid': 'settings-sidebar' }, [
  createElement('div', { class: 'flex-1 flex flex-col gap-1 py-3 overflow-y-auto' }, [
    createElement('div', { class: 'px-4 mt-2' }, [createElement('h2', {}, [createText('Projects')])]),
    createElement('div', { class: 'flex flex-col gap-0.5' }, [desktopProjOnly.wrapper]),
    createElement('div', { class: 'flex-1' }, []),
    desktopBottomFeedback.wrapper,
  ]),
]);
body.childNodes.push(desktopSidebarNoStandalone);
desktopSidebarNoStandalone.parentElement = body;
translateNode(desktopSidebarNoStandalone);

assert.equal(desktopProjOnly.txt.nodeValue, 'Developer', '桌面端 Projects 下项目名 Developer 必须跳过');
assert.equal(desktopBottomFeedback.txt.nodeValue, '提供反馈', '桌面端无 Not in Project 时底部 Provide Feedback 不可被误跳过');

// 顶部面包屑 Workspace 占位词（New Workspace / Unknown Workspace）应正常放行汉化，真实工作区名应跳过
const breadcrumbWsDevText = createText('Developer');
const breadcrumbWsDevLink = createElement('a', {
  'data-testid': 'breadcrumb-segment',
  'aria-label': 'Workspace: Developer',
}, [createElement('span', {}, [breadcrumbWsDevText])]);
const breadcrumbNewWsText = createText('New Workspace');
const breadcrumbNewWsLink = createElement('a', {
  'data-testid': 'breadcrumb-segment',
  'aria-label': 'Workspace: New Workspace',
}, [createElement('span', {}, [breadcrumbNewWsText])]);
const breadcrumbUnknownWsText = createText('Unknown Workspace');
const breadcrumbUnknownWsLink = createElement('a', {
  'data-testid': 'breadcrumb-segment',
  'aria-label': 'Workspace: Unknown Workspace',
}, [createElement('span', {}, [breadcrumbUnknownWsText])]);
const breadcrumbWsNav = createElement('nav', { 'aria-label': 'Breadcrumb' }, [
  breadcrumbWsDevLink,
  breadcrumbNewWsLink,
  breadcrumbUnknownWsLink,
]);
body.childNodes.push(breadcrumbWsNav);
breadcrumbWsNav.parentElement = body;
translateNode(breadcrumbWsNav);

assert.equal(breadcrumbWsDevText.nodeValue, 'Developer', '顶部面包屑真实工作区名 Developer 必须跳过');
assert.equal(breadcrumbNewWsText.nodeValue, '新建工作区', '顶部面包屑 New Workspace 占位应正常汉化');
assert.equal(breadcrumbUnknownWsText.nodeValue, '未知工作区', '顶部面包屑 Unknown Workspace 占位应正常汉化');

// 15. Ew 图标回退为 google-symbols 字体 ligature（非空 textContent 如 "cloud"）时，图标与紧邻项目名均须受保护
const ligatureGlyphText = createText('cloud');
const ligatureProjectText = createText('Developer');
const ligatureHoverRow = createElement('div', { class: 'flex items-center gap-1 text-sm text-muted-foreground' }, [
  createElement('span', { class: 'shrink-0 flex items-center' }, [
    createElement('span', { class: 'google-symbols', 'data-project-glyph': 'cloud' }, [ligatureGlyphText]),
  ]),
  createElement('span', { class: 'truncate' }, [ligatureProjectText]),
]);
body.childNodes.push(ligatureHoverRow);
ligatureHoverRow.parentElement = body;
translateNode(ligatureHoverRow);

assert.equal(ligatureGlyphText.nodeValue, 'cloud', 'google-symbols 字体图标 ligature 不得被误译为汉字');
assert.equal(ligatureProjectText.nodeValue, 'Developer', '字体图标包裹下的悬浮卡片项目名 Developer 同样必须跳过');

// 16. 输入框上方项目/工作区选择器触发按钮（data-testid="project-selector-trigger"）：
// 真实项目名（含撞 isActionPill、字体图标回退、无 data-project-icon 的 deprecated 态、与系统词同名文件夹）必须跳过；
// 占位态（Select Project / Select Workspace / No Project / New Workspace）及同栏兄弟按钮（This Computer / Local Checkout）与外部 tooltip 应正常汉化
const triggerDevText = createText('Developer');
const triggerDevIconLigature = createText('folder');
const triggerDevBtn = createElement('button', {
  type: 'button',
  'data-testid': 'project-selector-trigger',
  'aria-label': 'Select project, current: Developer',
}, [
  createElement('span', { class: 'relative inline-flex shrink-0' }, [
    createElement('span', { class: 'google-symbols', 'data-project-icon': 'folder' }, [triggerDevIconLigature]),
  ]),
  createElement('span', { class: 'truncate flex-1 min-w-0' }, [triggerDevText]),
  createElement('span', { class: 'google-symbols' }, [createText('keyboard_arrow_down')]),
]);

const triggerRunText = createText('Run');
const triggerRunBtn = createElement('button', {
  type: 'button',
  'data-testid': 'project-selector-trigger',
}, [
  createElement('span', { class: 'relative inline-flex shrink-0' }, [
    createElement('svg', { 'data-project-icon': 'cloud' }, []),
  ]),
  createElement('span', { class: 'truncate flex-1 min-w-0' }, [triggerRunText]),
  createElement('svg', {}, []),
]);

// 与系统占位词同名的真实用户项目目录（带 data-project-icon="folder"）
const triggerFolderNamedNoProjectText = createText('No Project');
const triggerFolderNamedNoProjectBtn = createElement('button', {
  type: 'button',
  'data-testid': 'project-selector-trigger',
}, [
  createElement('span', { class: 'relative inline-flex shrink-0' }, [
    createElement('svg', { 'data-project-icon': 'folder' }, []),
  ]),
  createElement('span', { class: 'truncate flex-1 min-w-0' }, [triggerFolderNamedNoProjectText]),
  createElement('svg', {}, []),
]);

// deprecated google3 警告态（无 data-project-icon，但文本是真实项目名）
const triggerWarningDevText = createText('Developer');
const triggerWarningDevBtn = createElement('button', {
  type: 'button',
  'data-testid': 'project-selector-trigger',
}, [
  createElement('span', { class: 'google-symbols' }, [createText('warning')]),
  createElement('span', { class: 'truncate flex-1 min-w-0' }, [triggerWarningDevText]),
  createElement('span', { class: 'google-symbols' }, [createText('keyboard_arrow_down')]),
]);

// 系统占位态（无 data-project-icon）：Select Project / Select Workspace / No Project / New Workspace 均应放行汉化
const triggerSelectProjText = createText('Select Project');
const triggerSelectProjBtn = createElement('button', {
  type: 'button',
  'data-testid': 'project-selector-trigger',
}, [
  createElement('span', { class: 'truncate flex-1 min-w-0' }, [triggerSelectProjText]),
  createElement('svg', {}, []),
]);

const triggerSelectWsText = createText('Select Workspace');
const triggerSelectWsBtn = createElement('button', {
  type: 'button',
  'data-testid': 'project-selector-trigger',
}, [
  createElement('span', { class: 'truncate flex-1 min-w-0' }, [triggerSelectWsText]),
  createElement('svg', {}, []),
]);

const triggerNoProjectText = createText('No Project');
const triggerNoProjectBtn = createElement('button', {
  type: 'button',
  'data-testid': 'project-selector-trigger',
}, [
  createElement('span', { class: 'truncate flex-1 min-w-0' }, [triggerNoProjectText]),
  createElement('span', { class: 'google-symbols' }, [createText('keyboard_arrow_down')]),
]);

const triggerNewWsText = createText('New Workspace');
const triggerNewWsBtn = createElement('button', {
  type: 'button',
  'data-testid': 'project-selector-trigger',
}, [
  createElement('svg', {}, []),
  createElement('span', { class: 'truncate flex-1 min-w-0' }, [triggerNewWsText]),
  createElement('svg', {}, []),
]);

// 同栏兄弟控件（本机 / 本地检出）与外部悬浮提示
const toolbarLocationText = createText('This Computer');
const toolbarLocationBtn = createElement('button', { 'data-testid': 'location-selector-trigger' }, [
  createElement('span', { class: 'truncate flex-1 min-w-0' }, [toolbarLocationText]),
]);
const toolbarLocalCheckoutText = createText('Local Checkout');
const toolbarLocalCheckoutBtn = createElement('button', {}, [
  createElement('span', { class: 'truncate' }, [toolbarLocalCheckoutText]),
]);
const triggerTooltipText = createText('Select Project');
const triggerTooltip = createElement('div', { role: 'tooltip' }, [
  createElement('span', {}, [triggerTooltipText]),
]);

const composerTopToolbar = createElement('div', { 'data-testid': 'input-box-bottom-toolbar' }, [
  toolbarLocationBtn,
  triggerDevBtn,
  triggerRunBtn,
  triggerFolderNamedNoProjectBtn,
  triggerWarningDevBtn,
  triggerSelectProjBtn,
  triggerSelectWsBtn,
  triggerNoProjectBtn,
  triggerNewWsBtn,
  toolbarLocalCheckoutBtn,
  triggerTooltip,
]);
body.childNodes.push(composerTopToolbar);
composerTopToolbar.parentElement = body;
translateNode(composerTopToolbar);

assert.equal(triggerDevText.nodeValue, 'Developer', '输入框上方项目选择器触发按钮项目名 Developer 必须跳过');
assert.equal(triggerDevIconLigature.nodeValue, 'folder', '项目选择器触发按钮 google-symbols 图标 ligature 不得被误译');
assert.equal(triggerDevBtn.getAttribute('aria-label'), 'Select project, current: Developer');
assert.equal(triggerRunText.nodeValue, 'Run', '输入框上方项目选择器命中 isActionPill 的项目名 Run 必须跳过');
assert.equal(triggerFolderNamedNoProjectText.nodeValue, 'No Project', '带 data-project-icon 且名为 No Project 的真实目录必须跳过');
assert.equal(triggerWarningDevText.nodeValue, 'Developer', 'warning 警告态下的真实项目名 Developer 必须跳过');
assert.equal(triggerSelectProjText.nodeValue, '选择项目', 'Select Project 占位态应正常汉化');
assert.equal(triggerSelectWsText.nodeValue, '选择工作区', 'Select Workspace 占位态应正常汉化');
assert.equal(triggerNoProjectText.nodeValue, '无项目', 'No Project 占位态应正常汉化');
assert.equal(triggerNewWsText.nodeValue, '新建工作区', 'New Workspace 占位态应正常汉化');
assert.equal(toolbarLocationText.nodeValue, '本机', '同栏左侧 This Computer 应正常汉化');
assert.equal(toolbarLocalCheckoutText.nodeValue, '本地检出', '同栏右侧 Local Checkout 应正常汉化');
assert.equal(triggerTooltipText.nodeValue, '选择项目', '外部 Select Project 悬浮提示应正常汉化');

// 验证动态切换项目名（MutationObserver characterData）同样受保护且不毒化 skipCache
triggerDevText.nodeValue = 'Tools';
notifyObserver([{ type: 'characterData', target: triggerDevText }]);
assert.equal(triggerDevText.nodeValue, 'Tools', '输入框上方触发按钮动态切换为 Tools 时仍须跳过');

// 17. 项目选择器下拉列表项（project-selector-item）与克隆子菜单项（clone-remote / clone-local）：
// 精准保护项目名与 title，同时放行右侧 Project Settings 设置按钮与克隆副标题（Clone locally / Open in Remote）
const dropdownDevText = createText('Developer');
const dropdownDevSpan = createElement('span', { class: 'truncate flex-1 min-w-0', title: 'Developer' }, [dropdownDevText]);
const dropdownItemSettingsBtn = createElement('button', {
  type: 'button',
  'data-testid': 'project-selector-item-settings',
  'aria-label': 'Project Settings',
  title: 'Project Settings',
}, [createElement('svg', {}, [])]);
const dropdownDevItem = createElement('div', {
  role: 'menuitem',
  'data-testid': 'project-selector-item',
  'data-project-name': 'Developer',
}, [
  createElement('span', { 'data-icon': '', class: 'relative inline-flex shrink-0' }, [
    createElement('span', { class: 'google-symbols', 'data-project-icon': 'folder' }, [createText('folder')]),
  ]),
  dropdownDevSpan,
  createElement('span', { class: 'ml-auto flex shrink-0 items-center gap-2' }, [
    dropdownItemSettingsBtn,
    createElement('span', {}, [createElement('svg', { 'data-testid': 'menu-item-check' }, [])]),
  ]),
]);

const dropdownPseudoRunText = createText('Run');
const dropdownPseudoSpan = createElement('span', { class: 'truncate flex-1 min-w-0', title: 'Run' }, [dropdownPseudoRunText]);
const dropdownPseudoItem = createElement('div', {
  role: 'menuitem',
  'data-testid': 'project-selector-item',
  'data-project-name': 'Run',
  'data-pseudo-project': 'true',
}, [
  createElement('svg', {}, []),
  dropdownPseudoSpan,
]);

const cloneRemoteDevText = createText('Developer');
const cloneRemoteSubText = createText('Clone locally');
const cloneRemoteItem = createElement('div', {
  role: 'menuitem',
  'data-testid': 'project-selector-clone-remote-item',
  'data-project-name': 'Developer',
}, [
  createElement('span', { 'data-icon': '' }, [createElement('svg', {}, [])]),
  createElement('span', { class: 'flex min-w-0 flex-col' }, [
    createElement('span', { class: 'truncate' }, [
      createElement('span', { class: 'truncate flex-1 min-w-0' }, [cloneRemoteDevText]),
    ]),
    createElement('span', { class: 'truncate text-sm text-muted-foreground' }, [cloneRemoteSubText]),
  ]),
]);

const cloneLocalRunText = createText('Run');
const cloneLocalSubText = createText('Cloning locally…');
const cloneLocalItem = createElement('div', {
  role: 'menuitem',
  'data-testid': 'project-selector-clone-local-item',
  'data-project-name': 'Run',
}, [
  createElement('span', { 'data-icon': '' }, [createElement('svg', {}, [])]),
  createElement('span', { class: 'flex min-w-0 flex-col' }, [
    createElement('span', { class: 'truncate' }, [
      createElement('span', { class: 'truncate flex-1 min-w-0' }, [cloneLocalRunText]),
    ]),
    createElement('span', { class: 'truncate text-sm text-muted-foreground' }, [cloneLocalSubText]),
  ]),
]);

const dropdownList = createElement('div', { 'data-testid': 'project-selector-list' }, [
  dropdownDevItem,
  dropdownPseudoItem,
  cloneRemoteItem,
  cloneLocalItem,
]);
body.childNodes.push(dropdownList);
dropdownList.parentElement = body;
translateNode(dropdownList);

assert.equal(dropdownDevText.nodeValue, 'Developer', '下拉列表项目名 Developer 必须跳过');
assert.equal(dropdownDevSpan.getAttribute('title'), 'Developer', '下拉列表项目名 title 属性必须跳过');
assert.equal(dropdownDevItem.childNodes[0].childNodes[0].childNodes[0].nodeValue, 'folder', '下拉列表图标 ligature 不得被误译');
assert.equal(dropdownItemSettingsBtn.getAttribute('title'), '项目设置', '下拉项目右侧悬停设置按钮 title 应正常汉化');
assert.equal(dropdownItemSettingsBtn.getAttribute('aria-label'), '项目设置', '下拉项目右侧悬停设置按钮 aria-label 应正常汉化');
assert.equal(dropdownPseudoRunText.nodeValue, 'Run', '下拉列表伪项目项撞 isActionPill 的 Run 必须跳过');
assert.equal(dropdownPseudoSpan.getAttribute('title'), 'Run');
assert.equal(cloneRemoteDevText.nodeValue, 'Developer', 'Clone from Remote 子菜单项目名 Developer 必须跳过');
assert.equal(cloneRemoteSubText.nodeValue, '克隆到本地', 'Clone from Remote 子菜单副标题 Clone locally 应正常汉化');
assert.equal(cloneLocalRunText.nodeValue, 'Run', 'Clone from This Computer 子菜单项目名 Run 必须跳过');

// 验证克隆项内层文本动态变更（characterData）依然受保护
cloneRemoteDevText.nodeValue = 'Docs';
notifyObserver([{ type: 'characterData', target: cloneRemoteDevText }]);
assert.equal(cloneRemoteDevText.nodeValue, 'Docs', '克隆子菜单项目名动态变更后仍须跳过');

// 18. 对话菜单「Move to Project」子菜单中的项目勾选项（conversation-project-*）：
// 仅保护单数 conversation-project-*，不影响复数 conversation-projects-submenu / new / remove
const moveMenuTriggerText = createText('Move to Project');
const moveMenuTrigger = createElement('div', { 'data-testid': 'conversation-projects-submenu' }, [
  createElement('span', { class: 'truncate' }, [moveMenuTriggerText]),
]);
const moveProjDevText = createText('Developer');
const moveProjDevItem = createElement('div', { 'data-testid': 'conversation-project-proj-1' }, [
  createElement('span', { class: 'truncate' }, [moveProjDevText]),
  createElement('span', { class: 'ml-auto flex shrink-0 items-center gap-2 pl-4' }, [
    createElement('svg', { 'data-testid': 'menu-item-check' }, []),
  ]),
]);
const moveProjRunText = createText('Run');
const moveProjRunItem = createElement('div', { 'data-testid': 'conversation-project-proj-2' }, [
  createElement('span', { class: 'truncate' }, [moveProjRunText]),
]);
const moveProjUnknownText = createText('Unknown Project');
const moveProjUnknownItem = createElement('div', { 'data-testid': 'conversation-project-unknown' }, [
  createElement('span', { class: 'truncate' }, [moveProjUnknownText]),
]);
const moveMenuNewText = createText('New Project...');
const moveMenuNewItem = createElement('div', { 'data-testid': 'conversation-projects-new' }, [
  createElement('span', { class: 'truncate' }, [moveMenuNewText]),
]);
const moveMenuRemoveText = createText('Remove from Project');
const moveMenuRemoveItem = createElement('div', { 'data-testid': 'conversation-projects-remove' }, [
  createElement('span', { class: 'truncate' }, [moveMenuRemoveText]),
]);
const moveMenuContainer = createElement('div', { role: 'menu' }, [
  moveMenuTrigger,
  moveProjDevItem,
  moveProjRunItem,
  moveProjUnknownItem,
  moveMenuNewItem,
  moveMenuRemoveItem,
]);
body.childNodes.push(moveMenuContainer);
moveMenuContainer.parentElement = body;
translateNode(moveMenuContainer);

assert.equal(moveMenuTriggerText.nodeValue, '移动到项目', 'conversation-projects-submenu 应正常汉化');
assert.equal(moveProjDevText.nodeValue, 'Developer', 'conversation-project-* 真实项目名 Developer 必须跳过');
assert.equal(moveProjRunText.nodeValue, 'Run', 'conversation-project-* 撞 isActionPill 的项目名 Run 必须跳过');
assert.equal(moveProjUnknownText.nodeValue, '未知项目', 'conversation-project-* 中的 Unknown Project 占位应放行汉化');
assert.equal(moveMenuRemoveText.nodeValue, '从项目中移除', 'conversation-projects-remove 应正常汉化');

console.log('PASS: 左侧项目栏及悬浮卡片/设置页(桌面+窄屏)/面包屑/项目选择器/移动菜单项目名隔离与系统内置分组放行回归测试全部通过');
