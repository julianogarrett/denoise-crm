# deNoise CRM

CRM interno da deNoise: funil de vendas em colunas, ficha completa do lead, tarefas, painel com números e automações internas. Roda no próprio computador (Mac ou Windows) e abre no navegador. Não tem integração com nada externo: nenhum WhatsApp, webhook ou serviço na internet.

## Como instalar

1. Instale o **Node.js** (versão LTS) em <https://nodejs.org>. Só precisa fazer isso uma vez.
2. Baixe esta pasta do GitHub (botão verde **Code → Download ZIP**, ou `git clone`).
3. Abra o CRM:
   - **Mac:** dois cliques em `Abrir CRM.command`
   - **Windows:** dois cliques em `Abrir CRM.bat`

Abre uma janela preta (o servidor) e o navegador em <http://localhost:4321>. **Deixe a janela preta aberta** enquanto usa o CRM. Para fechar, feche a janela.

Não precisa rodar `npm install`: o CRM não usa nenhuma biblioteca externa.

> Se o Mac disser que o arquivo não pode ser aberto, clique com o botão direito em `Abrir CRM.command` → **Abrir** → **Abrir**. Só na primeira vez.

## O que tem

| Tela | O que faz |
|---|---|
| **Painel** | Leads no funil, pipeline em aberto, receita ganha no mês, taxa de conversão, funil por etapa, leads parados que precisam de atenção, leads por origem e tarefas do dia. |
| **Funil de vendas** | Colunas por etapa com soma em R$. Arraste os cards entre as etapas. Busca por nome, empresa, telefone ou tag, e filtro por responsável. |
| **Ficha do lead** | Abre ao clicar num card. Responsável, contato, negócio, temperatura e score, tags, observações. Abas: Interações (ligações, reuniões, mensagens, anotações), Histórico, Tarefas e Arquivos. |
| **Tarefas** | Todas as tarefas da equipe: abertas, atrasadas, de hoje, da semana e concluídas. Também dá para criar tarefas sem lead. |
| **Automações** | Fluxos que rodam sozinhos, organizados por etapa do funil. Tem modelos prontos, editor em blocos, simulação com um lead real e histórico de execuções. |
| **Configurações** | Nome e cor do CRM, equipe, etapas do funil (nome, cor, ordem, ganho/perdido), origens dos leads, backup e restauração. |

O tema claro/escuro fica no ícone do rodapé do menu (sistema → claro → escuro).

### Automações

**Gatilhos:** lead entrou no CRM, lead entrou numa etapa, tag adicionada, lead parado há X dias.

**Blocos:** registrar anotação, avisar a equipe (aparece no sino), condição, aguardar (minutos, horas ou dias), mover etapa, distribuir responsável (rodízio ou fixo), adicionar/remover tag, criar tarefa, definir temperatura, definir valor.

Os textos aceitam variáveis: `{nome}`, `{primeiro_nome}`, `{empresa}`, `{responsavel}`, `{etapa}`, `{valor}`, `{origem}`, `{cidade}`, `{interesse}`.

As esperas só terminam com o CRM aberto. Se ele estiver fechado na hora, o fluxo continua assim que for aberto de novo.

## Onde ficam os dados

Tudo fica na pasta `dados/`, dentro da pasta do CRM:

- `dados/crm.json`: leads, tarefas, automações, configurações
- `dados/arquivos/`: arquivos anexados aos leads
- `dados/backups/`: uma cópia automática por dia (guarda os últimos 14 dias)

A pasta `dados/` **não vai para o GitHub**: cada computador tem os seus dados. Para levar os dados para outro computador, copie a pasta `dados/` inteira.

No primeiro uso o CRM vem com leads de exemplo. Apague em **Configurações → Dados e backup → Apagar exemplos** (ou no aviso do Painel).

## Usar os mesmos dados em dois computadores

O CRM não tem login. Para duas pessoas usarem os **mesmos** dados ao mesmo tempo, as duas precisam estar na mesma rede (Wi-Fi do escritório):

1. No computador que guarda os dados, abra `Abrir CRM na rede` (`.command` no Mac, `.bat` no Windows).
2. A janela preta mostra um endereço como `http://192.168.0.15:4321`.
3. No outro computador, abra esse endereço no navegador.

Quem estiver na mesma rede consegue abrir o CRM nesse modo. Use só em rede confiável.

## Atualizar

Se baixou com `git clone`: rode `git pull` dentro da pasta. Se baixou o ZIP: baixe de novo e copie a pasta `dados/` antiga para a nova.

## Para quem for mexer no código

Veja o `CLAUDE.md`.
