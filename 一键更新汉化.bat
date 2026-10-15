@echo off
chcp 65001 >nul
title Antigravity 2.0 一键更新与自动恢复汉化
echo =======================================================
echo     Antigravity 2.0 汉化更新与自动恢复程序
echo =======================================================
echo.
echo 说明：本程序将自动检测 Antigravity 安装状态、官方更新覆盖情况，
echo 并安全恢复汉化包（具备版本兼容性检查、原版备份与防白屏机制）。
echo.

where node >nul 2>&1
if %errorlevel% equ 0 (
  goto USE_NODE_FLOW
) else (
  goto USE_LEGACY_FLOW
)

:USE_NODE_FLOW
echo [模式] 检测到系统已安装 Node.js 环境，启动智能安全恢复流程...
echo.
node "%~dp0localize.js" --auto-restore
set "RESTORE_CODE=%errorlevel%"
echo.
if %RESTORE_CODE% equ 0 (
  echo =======================================================
  echo  [成功] 汉化补丁已就绪！正在重新启动 Antigravity...
  echo =======================================================
  timeout /t 2 >nul
  if exist "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe" (
    start "" "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
  )
  exit /b 0
) else if %RESTORE_CODE% equ 2 (
  echo =======================================================
  echo  [版本警告] 检测到官方更新与本地补丁版本不匹配
  echo =======================================================
  echo 为避免覆盖后软件白屏，本次已自动安全拦截。
  echo 请双击运行【双击运行汉化.bat】打开控制中心，下载对应最新版本的汉化包。
  echo.
  pause
  exit /b 2
) else (
  echo =======================================================
  echo  [失败] 恢复过程发生异常，请检查权限或路径配置。
  echo =======================================================
  echo 您也可以双击运行【双击运行汉化.bat】通过管理面板进行诊断与安装。
  echo.
  pause
  exit /b 1
)

:USE_LEGACY_FLOW
echo [提示] 未在系统中检测到 Node.js，进入离线纯批处理保底模式。
echo 注意：汉化需要关闭当前运行的 Antigravity 客户端以解除文件占用。
echo 如果您有未保存的工作，请先保存。
echo.
pause
echo.
echo [1/3] 正在关闭 Antigravity 进程...
taskkill /F /IM Antigravity.exe >nul 2>&1
taskkill /F /IM language_server.exe >nul 2>&1
timeout /t 2 >nul

set "TARGET_DIR=%LOCALAPPDATA%\Programs\antigravity\resources"
if not exist "%TARGET_DIR%\app.asar" (
  set "TARGET_DIR=%LOCALAPPDATA%\Programs\antigravity\Resources"
)

if not exist "%TARGET_DIR%\app.asar" (
  echo [错误] 未在默认路径找到 Antigravity 客户端：
  echo %LOCALAPPDATA%\Programs\antigravity
  echo 请安装 Node.js 后运行【双击运行汉化.bat】指定自定义路径。
  echo.
  pause
  exit /b 1
)

if not exist "%TARGET_DIR%\app.asar.bak" (
  echo [2/3] 正在创建原版备份 app.asar.bak...
  copy /y "%TARGET_DIR%\app.asar" "%TARGET_DIR%\app.asar.bak" >nul
) else (
  echo [2/3] 备份已存在，跳过备份。
)

if not exist "%~dp0app.asar.ready" (
  echo [错误] 未在当前目录下找到就绪补丁 app.asar.ready。
  echo 请确保已完整解压汉化包后再试。
  echo.
  pause
  exit /b 1
)

echo [3/3] 正在覆盖安装汉化包...
copy /y "%~dp0app.asar.ready" "%TARGET_DIR%\app.asar" >nul

if %errorlevel% equ 0 (
  echo.
  echo =======================================================
  echo  [成功] 汉化补丁更新完成！
  echo =======================================================
  echo.
  echo 正在为您重新启动 Antigravity...
  start "" "%LOCALAPPDATA%\Programs\antigravity\Antigravity.exe"
) else (
  echo.
  echo [失败] 复制汉化包失败，请检查文件是否被占用或尝试以管理员身份运行。
  pause
)
