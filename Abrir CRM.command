#!/bin/bash
# Mac: dê dois cliques neste arquivo para abrir o CRM.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo ""
  echo "  O Node.js não está instalado. Baixe a versão LTS em https://nodejs.org"
  echo "  instale e depois abra este atalho de novo."
  open "https://nodejs.org/pt-br/download"
  read -n 1 -s -r -p "  Aperte qualquer tecla para fechar."
  exit 1
fi
node server.js --abrir
