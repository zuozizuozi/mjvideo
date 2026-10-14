@echo off
chcp 65001 >nul
title mjvideo 工作台
cd /d "%~dp0"
node bin\mjv.mjs studio
pause
