'use strict';

const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const crypto = require('crypto');
const { readAsarPackageVersion } = require('./asar-version');

// 特征指纹检测：判断 asar 文件是否已经注入汉化代码
function isLocalizedAsar(filePath) {
  if (!fs.existsSync(filePath)) return false;
  try {
    const buf = fs.readFileSync(filePath);
    return buf.includes(Buffer.from('// Antigravity 2.0 Chinese Localization Engine')) ||
           buf.includes(Buffer.from('menuTranslationMap')) ||
           buf.includes(Buffer.from('DOM_TRANSLATOR_INJECTION'));
  } catch (_) {
    return false;
  }
}

// 计算文件的 SHA256 哈希
async function hashFile(filePath) {
  const hash = crypto.createHash('sha256');
  for await (const chunk of fs.createReadStream(filePath)) {
    hash.update(chunk);
  }
  return hash.digest('hex');
}

// 标准化版本字符串（移除前缀 v/V 与空白）
function normalizeVersion(ver) {
  if (!ver || typeof ver !== 'string') return '';
  return ver.trim().replace(/^[vV]/, '');
}

/**
 * 寻找本地可用的汉化补丁包
 * 优先级：
 * 1. 根目录的 app.asar.ready（离线完整包或就绪包）
 * 2. releaseManager 缓存目录 downloads/ 中的已验证包
 */
async function findAvailablePatch({ workspaceDir, targetVersion, releaseManager } = {}) {
  const wsDir = workspaceDir || path.resolve(__dirname);
  const candidates = [];

  // 1. 根目录 app.asar.ready
  const readyPath = path.join(wsDir, 'app.asar.ready');
  if (fs.existsSync(readyPath)) {
    try {
      const stat = await fsp.stat(readyPath);
      if (stat.isFile() && stat.size > 0) {
        const patchVersion = readAsarPackageVersion(readyPath);
        candidates.push({
          source: 'ready-file',
          path: readyPath,
          version: patchVersion,
          size: stat.size
        });
      }
    } catch (_) {}
  }

  // 2. downloads/ 缓存目录中由 releaseManager 下载的补丁包
  if (releaseManager && typeof releaseManager.listCachedFiles === 'function') {
    try {
      const cached = await releaseManager.listCachedFiles();
      for (const item of cached) {
        if (item.valid && item.path && fs.existsSync(item.path)) {
          const patchVersion = readAsarPackageVersion(item.path) || normalizeVersion(item.tag);
          candidates.push({
            source: 'download-cache',
            cacheId: item.id,
            tag: item.tag,
            path: item.path,
            version: patchVersion,
            size: item.size,
            sha256: item.sha256
          });
        }
      }
    } catch (_) {}
  } else {
    // 即使未注入 releaseManager，也可直接扫描 downloads 目录
    const downloadsDir = path.join(wsDir, 'downloads');
    if (fs.existsSync(downloadsDir)) {
      try {
        const files = await fsp.readdir(downloadsDir);
        for (const file of files) {
          if (file.endsWith('.asar') && !file.startsWith('.')) {
            const fullPath = path.join(downloadsDir, file);
            try {
              const stat = await fsp.stat(fullPath);
              if (stat.isFile() && stat.size > 0) {
                const patchVersion = readAsarPackageVersion(fullPath);
                candidates.push({
                  source: 'downloads-dir',
                  path: fullPath,
                  version: patchVersion,
                  size: stat.size
                });
              }
            } catch (_) {}
          }
        }
      } catch (_) {}
    }
  }

  if (candidates.length === 0) {
    return null;
  }

  const normTarget = normalizeVersion(targetVersion);

  // 如果目标版本明确，优先查找版本精确匹配的补丁
  if (normTarget) {
    const exactMatch = candidates.find(c => normalizeVersion(c.version) === normTarget);
    if (exactMatch) {
      return { ...exactMatch, isMatch: true };
    }
  }

  // 若无精确匹配，按优先级返回第一个候选（并标记是否匹配）
  const primary = candidates[0];
  const primaryNorm = normalizeVersion(primary.version);
  const isMatch = Boolean(!normTarget || !primaryNorm || normTarget === primaryNorm);

  return { ...primary, isMatch };
}

/**
 * 诊断客户端当前状态
 */
async function checkClientStatus({ appDir, getResourcesDir } = {}) {
  if (!appDir) {
    throw new Error('appDir 参数必填');
  }
  const resDirFn = getResourcesDir || (dir => path.join(dir, 'resources'));
  const resourcesDir = path.resolve(resDirFn(appDir));
  const asarPath = path.join(resourcesDir, 'app.asar');
  const backupPath = path.join(resourcesDir, 'app.asar.bak');

  const isInstalled = fs.existsSync(asarPath);
  if (!isInstalled) {
    return {
      isInstalled: false,
      appDir,
      resourcesDir,
      asarPath,
      appVersion: null,
      isLocalized: false,
      hasBackup: false,
      isUpdateOverwritten: false
    };
  }

  const appVersion = readAsarPackageVersion(asarPath);
  const isLocalized = isLocalizedAsar(asarPath);
  const hasBackup = fs.existsSync(backupPath) && !isLocalizedAsar(backupPath);
  // 当程序已安装但未汉化时，说明是官方原版安装或官方更新覆盖
  const isUpdateOverwritten = !isLocalized;

  return {
    isInstalled: true,
    appDir,
    resourcesDir,
    asarPath,
    backupPath,
    appVersion,
    isLocalized,
    hasBackup,
    isUpdateOverwritten
  };
}

/**
 * 执行自动恢复与安全安装
 */
async function executeAutoRestore({
  appDir,
  getResourcesDir,
  workspaceDir,
  releaseManager,
  isAppRunning,
  stopProcesses,
  forceStop = true,
  candidatePatch = null,
  stopTimeoutMs = 3000
} = {}) {
  const wsDir = workspaceDir || path.resolve(__dirname);
  const status = await checkClientStatus({ appDir, getResourcesDir });

  if (!status.isInstalled) {
    return {
      success: false,
      code: 'NOT_INSTALLED',
      message: `未在目标目录找到 Antigravity 程序：${appDir}`
    };
  }

  if (status.isLocalized) {
    return {
      success: true,
      code: 'ALREADY_LOCALIZED',
      appVersion: status.appVersion,
      message: `当前客户端 (v${status.appVersion || '未知'}) 已处于汉化状态，无需重复安装。`
    };
  }

  // 寻找或使用指定的补丁包
  const patch = candidatePatch || await findAvailablePatch({
    workspaceDir: wsDir,
    targetVersion: status.appVersion,
    releaseManager
  });

  if (!patch) {
    return {
      success: false,
      code: 'NO_PATCH_FOUND',
      appVersion: status.appVersion,
      message: '本地未找到可用的汉化补丁包 (app.asar.ready 或 downloads 缓存)，请启动控制中心下载。'
    };
  }

  const appNorm = normalizeVersion(status.appVersion);
  const patchNorm = normalizeVersion(patch.version);

  // 核心安全拦截：版本兼容性校验
  // 如果客户端版本与补丁包版本均明确且不一致，坚决阻止盲目覆盖！
  if (appNorm && patchNorm && appNorm !== patchNorm) {
    return {
      success: false,
      code: 'VERSION_MISMATCH',
      appVersion: status.appVersion,
      patchVersion: patch.version,
      patchPath: patch.path,
      message: `[安全拦截] 客户端已由官方更新为 v${status.appVersion}，但本地补丁版本为 v${patch.version}。为防止界面崩溃或白屏，已阻止覆盖。请通过控制中心下载对应 v${status.appVersion} 的汉化包。`
    };
  }

  // 检查并关闭运行中进程
  if (typeof isAppRunning === 'function') {
    let running = false;
    try {
      running = await isAppRunning();
    } catch (_) {}

    if (running) {
      if (!forceStop) {
        return {
          success: false,
          code: 'APP_RUNNING',
          message: 'Antigravity 正在运行中，请退出客户端后再执行恢复。'
        };
      }
      if (typeof stopProcesses === 'function') {
        try {
          await stopProcesses();
        } catch (_) {}
        const deadline = Date.now() + stopTimeoutMs;
        while (Date.now() < deadline) {
          try {
            if (!await isAppRunning()) break;
          } catch (_) { break; }
          await new Promise(r => setTimeout(r, 100));
        }
      }
    }
  }

  // 执行安全备份
  const asarPath = status.asarPath;
  const resourcesDir = status.resourcesDir;
  let createdBackupPath = null;
  const standardBackup = path.join(resourcesDir, 'app.asar.bak');

  try {
    // 若标准备份不存在，或已被污染，则从当前纯净官方原版创建备份
    if (!fs.existsSync(standardBackup) || isLocalizedAsar(standardBackup)) {
      await fsp.copyFile(asarPath, standardBackup);
      createdBackupPath = standardBackup;
    }
  } catch (err) {
    // 备份若失败，不强行写目标
    return {
      success: false,
      code: 'BACKUP_FAILED',
      message: `创建安全原版备份失败: ${err.message}`
    };
  }

  // 原子安装补丁
  const token = `${Date.now()}-${crypto.randomBytes(6).toString('hex')}`;
  const stagePath = path.join(resourcesDir, `.app.asar.restore-${token}.stage`);
  try {
    // 1. 复制到同目录暂存文件
    await fsp.copyFile(patch.path, stagePath);
    // 2. 哈希比对确认复制完整性
    const patchHash = await hashFile(patch.path);
    const stageHash = await hashFile(stagePath);
    if (patchHash !== stageHash) {
      throw new Error('汉化包暂存写入校验失败，SHA256 不一致');
    }
    // 3. 原子重命名覆盖目标
    await fsp.rename(stagePath, asarPath);

    return {
      success: true,
      code: 'RESTORED',
      appVersion: status.appVersion,
      patchVersion: patch.version,
      patchPath: patch.path,
      backupPath: createdBackupPath || standardBackup,
      message: `汉化补丁 (v${patch.version || status.appVersion || '匹配'}) 已成功安全恢复！`
    };
  } catch (err) {
    // 清理暂存文件
    try {
      if (fs.existsSync(stagePath)) await fsp.unlink(stagePath);
    } catch (_) {}
    return {
      success: false,
      code: 'INSTALL_FAILED',
      message: `覆盖汉化补丁失败: ${err.message}`
    };
  }
}

module.exports = {
  isLocalizedAsar,
  hashFile,
  normalizeVersion,
  findAvailablePatch,
  checkClientStatus,
  executeAutoRestore
};
