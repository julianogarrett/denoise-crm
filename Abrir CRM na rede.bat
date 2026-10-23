@echo off
REM Windows: abre o CRM e deixa outros computadores da mesma rede acessarem.
cd /d "%~dp0"
where node >nul 2>nul
if errorlevel 1 (
  echo   O Node.js nao esta instalado. Baixe a versao LTS em https://nodejs.org
  start "" "https://nodejs.org/pt-br/download"
  pause
  exit /b 1
)
title deNoise CRM (rede)
node server.js --rede --abrir
pause
