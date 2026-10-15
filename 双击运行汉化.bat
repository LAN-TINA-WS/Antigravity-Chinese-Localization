@echo off
chcp 65001 >nul
title Antigravity 2.0 汉化管理面板
echo =======================================================
echo  Antigravity 2.0 汉化管理面板 (支持更新自动检测与版本管理)
echo =======================================================
echo.

where node >nul 2>&1
if %errorlevel% neq 0 (
  echo [错误] 未检测到 Node.js 运行环境！
  echo 控制面板需要 Node.js 支持，请先前往官网下载安装：
  echo https://nodejs.org
  echo.
  echo 提示：如需免环境快速更新，可尝试运行【一键更新汉化.bat】。
  echo.
  pause
  exit /b 1
)

echo 正在启动汉化管理服务与客户端更新检查...
echo 将在默认浏览器中打开控制台：http://localhost:3388
echo.

start "" "http://localhost:3388"

node "%~dp0localize.js"

if %errorlevel% neq 0 (
  echo.
  echo [错误] 汉化管理服务异常退出。
  echo.
  pause
)
