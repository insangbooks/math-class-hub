@echo off
chcp 65001 >nul
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo Node.js가 필요합니다. Node.js 설치 후 다시 실행해주세요.
  pause
  exit /b 1
)
if not exist "dist\index.html" (
  echo 빌드가 없습니다. npm.cmd run build 명령을 먼저 실행해주세요.
  pause
  exit /b 1
)
echo 브라우저에서 http://127.0.0.1:4175/ 를 여세요.
echo 서버 종료는 Ctrl+C입니다. 이 창을 닫으면 로컬 서버가 종료됩니다.
node scripts/serve.mjs
pause
