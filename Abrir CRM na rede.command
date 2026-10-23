#!/bin/bash
# Mac: abre o CRM e deixa outros computadores da mesma rede acessarem.
cd "$(dirname "$0")"
if ! command -v node >/dev/null 2>&1; then
  echo "  O Node.js não está instalado. Baixe a versão LTS em https://nodejs.org"
  open "https://nodejs.org/pt-br/download"
  read -n 1 -s -r -p "  Aperte qualquer tecla para fechar."
  exit 1
fi
node server.js --rede --abrir
