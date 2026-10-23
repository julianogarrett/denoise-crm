@echo off
REM Windows: de dois cliques neste arquivo para abrir o CRM.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo   O Node.js nao esta instalado. Baixe a versao LTS em https://nodejs.org
  echo   instale e depois abra este atalho de novo.
  start "" "https://nodejs.org/pt-br/download"
  pause
  exit /b 1
)
title deNoise CRM
node server.js --abrir
pause
