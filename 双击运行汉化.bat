@echo off
chcp 65001 >nul
title Antigravity 2.0 汉化管理面板
echo =======================================================
echo  Antigravity 2.0 汉化管理面板
echo =======================================================
echo.
echo 正在启动汉化管理服务...
echo 将在默认浏览器中打开控制台...
echo.

start "" "http://localhost:3388"

node "%~dp0localize.js"

if %errorlevel% neq 0 (
  echo.
  echo [错误] 运行汉化程序失败。
  echo 请确保系统已安装 Node.js (https://nodejs.org)
  echo.
  pause
)
