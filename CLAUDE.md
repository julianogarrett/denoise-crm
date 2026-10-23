# deNoise CRM: instruções para o Claude

CRM interno, de uso local, em português. A pessoa que pediu provavelmente não é programadora: fale em português simples, sem jargão, e faça você mesmo os passos técnicos.

## Instalar e abrir no computador da pessoa

Quando pedirem para "baixar", "instalar" ou "rodar" este repositório:

1. **Node.js 18 ou mais novo.** Confira com `node -v`.
   - Se não tiver no **Windows**: `winget install OpenJS.NodeJS.LTS` (depois feche e abra o terminal de novo para o `node` aparecer). Sem winget, peça para a pessoa instalar o LTS de <https://nodejs.org>.
   - Se não tiver no **Mac**: `brew install node` se tiver Homebrew; senão, peça para instalar o LTS de <https://nodejs.org>.
2. **Clone** num lugar fácil de achar, por exemplo a pasta Documentos: `git clone https://github.com/julianogarrett/denoise-crm.git`.
   O repositório é público: não precisa de login no GitHub. Se não tiver `git`, baixe o ZIP em <https://github.com/julianogarrett/denoise-crm/archive/refs/heads/main.zip> e extraia.
3. **Não precisa de `npm install`.** O projeto não tem dependências.
4. **Abra o CRM:** `node server.js --abrir` dentro da pasta. Abre <http://localhost:4321> no navegador. Rode em segundo plano, porque o servidor fica rodando.
5. **Confirme que abriu:** `curl -s http://localhost:4321/api/state` deve responder JSON com `"stages"`.
6. **Atalho na Área de Trabalho**, para a pessoa abrir sozinha depois:
   - Windows: crie um atalho para `Abrir CRM.bat` na Área de Trabalho (PowerShell com `WScript.Shell` → `CreateShortcut`, `WorkingDirectory` = pasta do repo).
   - Mac: `ln -s "<pasta>/Abrir CRM.command" ~/Desktop/"Abrir CRM.command"`.
7. Explique em duas frases: para abrir, dois cliques no atalho e deixar a janela preta aberta; os dados ficam na pasta `dados/` e não vão para o GitHub.

Porta ocupada: use `PORT=4322 node server.js` (Mac) ou `set PORT=4322 && node server.js` (Windows).

## Atualizar

`git pull` na pasta do repo, depois feche e abra o CRM de novo. A pasta `dados/` não é tocada.

## Regras

- **Nunca** apague, mova ou faça commit da pasta `dados/` (está no `.gitignore`). É lá que ficam os leads da empresa.
- Sem dependências externas: só módulos nativos do Node no servidor e JavaScript puro no navegador. Não adicione npm packages nem build step sem combinar com o Juliano.
- Sem integrações externas (WhatsApp, webhooks, APIs). Foi um pedido explícito.
- Interface e mensagens em português do Brasil.

## Como o código está organizado

```
server.js            servidor HTTP + todas as rotas da API (/api/...)
lib/db.js            banco em arquivo JSON (dados/crm.json), gravação atômica, backup diário
lib/engine.js        operações de lead (criar, mover, tag, responsável) + motor das automações
lib/templates.js     modelos prontos de automação
lib/seed.js          dados do primeiro uso (marcados com sample: true)
public/index.html    casca da página
public/css/app.css   todo o visual; temas por variáveis CSS em :root e :root[data-theme="dark"]
public/js/app.js     menu, tema, notificações, rotas (#painel, #funil, #tarefas, #automacoes, #config)
public/js/store.js   estado (S = dados do servidor, ui = estado da tela) e chamadas à API
public/js/actions.js despacho de eventos: data-act (clique), data-change, data-input, data-enter
public/js/views/     uma tela por arquivo; cada uma exporta view() que devolve HTML
```

- Cada mudança chama a API, que responde com o estado inteiro; a tela redesenha a partir dele. A tela também busca mudanças a cada 5 s (`/api/state?rev=`).
- Automações rodam no servidor: `fire()` dispara pelos eventos de lead, `tick()` roda a cada 15 s (esperas, leads parados, tarefas atrasadas). Para criar um bloco novo: `execStep()` em `lib/engine.js` + `BLOCKS`/`DEFAULTS`/`configPanel()` em `public/js/views/automacoes.js`.
- Teste rápido da API: `PORT=4399 node server.js` e use `curl` em outra porta, para não mexer no CRM aberto. Para testar sem tocar nos dados reais, use `CRM_DADOS=/tmp/crm-teste node server.js`.
