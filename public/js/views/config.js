// Configurações: identidade, equipe, etapas do funil, origens e backup.
import { S, ui, api, rerender } from '../store.js';
import { actions } from '../actions.js';
import { icon } from '../icons.js';
import { esc, initials, toast, confirmBox } from '../ui.js';

const COLORS = ['#111827', '#1d4ed8', '#0f766e', '#15803d', '#b45309', '#c2410c', '#b91c1c', '#be185d', '#6d28d9'];
const KIND = [['open', 'Aberta'], ['won', 'Ganho'], ['lost', 'Perdido']];
let edit = null; // cópia local da lista que está sendo editada (equipe, etapas ou origens)

const TABS = [['geral', 'Geral'], ['equipe', 'Equipe'], ['etapas', 'Etapas do funil'], ['origens', 'Origens'], ['dados', 'Dados e backup']];

function startEdit() {
  const t = ui.config.tab;
  edit = t === 'equipe' ? structuredClone(S.members) : t === 'etapas' ? structuredClone(S.stages) : t === 'origens' ? structuredClone(S.origins) : null;
}

export function view() {
  if (edit === null) startEdit();
  return `<div class="settings">
    <div class="muted">${esc(S.settings.workspaceName)}</div>
    <div class="page-head"><h1>Configurações</h1></div>
    <div class="tabs" style="padding:0;background:none">${TABS.map(([k, n]) => `<button class="tab ${ui.config.tab === k ? 'on' : ''}" data-act="cfgAba" data-tab="${k}">${n}</button>`).join('')}</div>
    ${{ geral, equipe, etapas, origens, dados }[ui.config.tab]()}
  </div>`;
}

function geral() {
  const st = S.settings;
  return `<section>
      <div><h3>Identidade</h3><p class="muted">Como o CRM aparece no menu.</p></div>
      <div style="display:flex;gap:16px;align-items:center"><span class="logo" style="width:64px;height:64px;border-radius:14px;font-size:24px;background:${esc(st.brandColor)}">${esc(initials(st.workspaceName).slice(0, 1))}</span>
        <p class="muted">A letra usa a primeira inicial do nome, na cor da marca.</p></div>
      <div class="field" style="max-width:420px"><label for="cfg-nome">Nome do workspace</label><input class="input" id="cfg-nome" value="${esc(st.workspaceName)}" data-change="cfgNome"></div>
      <div class="field"><label>Cor da marca</label><div class="swatches">
        ${COLORS.map(c => `<button class="swatch ${c.toLowerCase() === String(st.brandColor).toLowerCase() ? 'on' : ''}" style="background:${c}" data-act="cfgCor" data-c="${c}" aria-label="Cor ${c}"></button>`).join('')}
        <input class="input" style="width:110px;font-family:var(--mono)" value="${esc(st.brandColor)}" data-change="cfgCorHex" id="cfg-hex" aria-label="Cor em hexadecimal"></div></div>
    </section>
    <section>
      <div><h3>Automações</h3><p class="muted">Usado no cálculo de "Tempo economizado".</p></div>
      <div class="field" style="max-width:260px"><label for="cfg-min">Minutos por ação manual</label><input class="input" type="number" min="0.5" step="0.5" id="cfg-min" value="${esc(st.minutesPerAction)}" data-change="cfgMin"></div>
    </section>`;
}

const saveBar = what => `<div style="display:flex;gap:8px;flex-wrap:wrap"><button class="btn" data-act="cfgAdd">${icon('plus', 15)} Adicionar ${what}</button><div style="flex:1"></div>
  <button class="btn ghost" data-act="cfgDesfazer">Desfazer</button><button class="btn primary" data-act="cfgSalvarLista">${icon('save', 15)} Salvar</button></div>`;

function equipe() {
  return `<section>
    <div><h3>Equipe</h3><p class="muted">Quem pode ser responsável por leads e tarefas. O CRM não tem login: todo mundo que abre vê tudo.</p></div>
    <div class="edit-list">${edit.map((m, i) => `<div class="edit-row member">
      <input type="color" class="color-in" value="${esc(m.color)}" data-input="cfgItem" data-i="${i}" data-k="color" aria-label="Cor">
      <input class="input" value="${esc(m.name)}" placeholder="Nome" data-input="cfgItem" data-i="${i}" data-k="name">
      <input class="input" value="${esc(m.role || '')}" placeholder="Função (opcional)" data-input="cfgItem" data-i="${i}" data-k="role">
      <button class="icon-btn" data-act="cfgDel" data-i="${i}" aria-label="Remover">${icon('trash', 15)}</button></div>`).join('')}</div>
    ${saveBar('membro')}
  </section>`;
}

function etapas() {
  return `<section>
    <div><h3>Etapas do funil</h3><p class="muted">A ordem aqui é a ordem das colunas. "Ganho" e "Perdido" encerram o negócio. Se apagar uma etapa com leads, eles voltam para a primeira etapa aberta.</p></div>
    <div class="edit-list">${edit.map((s, i) => `<div class="edit-row">
      <div class="order-btns"><button data-act="cfgOrdem" data-i="${i}" data-d="-1" aria-label="Subir">${icon('arrowUp', 13)}</button><button data-act="cfgOrdem" data-i="${i}" data-d="1" aria-label="Descer">${icon('arrowDown', 13)}</button></div>
      <input type="color" class="color-in" value="${esc(s.color)}" data-input="cfgItem" data-i="${i}" data-k="color" aria-label="Cor">
      <input class="input" value="${esc(s.name)}" data-input="cfgItem" data-i="${i}" data-k="name">
      <select class="select" data-change="cfgItemSel" data-i="${i}" data-k="kind" aria-label="Tipo">${KIND.map(([k, n]) => `<option value="${k}" ${s.kind === k ? 'selected' : ''}>${n}</option>`).join('')}</select>
      <button class="icon-btn" data-act="cfgDel" data-i="${i}" aria-label="Remover">${icon('trash', 15)}</button></div>`).join('')}</div>
    ${saveBar('etapa')}
  </section>`;
}

function origens() {
  return `<section>
    <div><h3>Origens dos leads</h3><p class="muted">De onde os leads vêm. Aparecem como selos coloridos nos cards e no Painel.</p></div>
    <div class="edit-list">${edit.map((o, i) => `<div class="edit-row simple">
      <input type="color" class="color-in" value="${esc(o.color)}" data-input="cfgItem" data-i="${i}" data-k="color" aria-label="Cor">
      <input class="input" value="${esc(o.name)}" data-input="cfgItem" data-i="${i}" data-k="name">
      <button class="icon-btn" data-act="cfgDel" data-i="${i}" aria-label="Remover">${icon('trash', 15)}</button></div>`).join('')}</div>
    ${saveBar('origem')}
  </section>`;
}

function dados() {
  const samples = S.leads.filter(l => l.sample).length;
  return `<section>
      <div><h3>Backup</h3><p class="muted">Tudo fica na pasta <code>dados</code> dentro da pasta do CRM. Ele já guarda sozinho uma cópia por dia dos últimos 14 dias em <code>dados/backups</code>.</p></div>
      <div style="display:flex;gap:8px;flex-wrap:wrap">
        <a class="btn" href="/api/backup">${icon('download', 15)} Baixar backup agora</a>
        <label class="btn">${icon('upload', 15)} Restaurar de um backup<input type="file" accept=".json,application/json" hidden data-change="cfgRestaurar" id="cfg-restore"></label>
      </div>
      <p class="muted small">Os arquivos anexados aos leads ficam em <code>dados/arquivos</code> e não entram no backup em JSON. Para guardar tudo, copie a pasta <code>dados</code> inteira.</p>
    </section>
    <section>
      <div><h3>Dados de exemplo</h3><p class="muted">${samples ? `Há ${samples} leads de exemplo, criados no primeiro uso.` : 'Nenhum dado de exemplo.'}</p></div>
      ${samples ? `<div><button class="btn danger" data-act="apagarExemplos">${icon('trash', 15)} Apagar exemplos</button></div>` : ''}
    </section>
    <section>
      <div><h3>Usar em outro computador da rede</h3><p class="muted">${S.network ? `Este CRM está aberto para a rede. Outros computadores podem abrir: <b>${esc(S.network.join(' ou '))}</b>` : 'Hoje o CRM só abre neste computador. Para outra pessoa da mesma rede (Wi-Fi do escritório) usar os mesmos dados, abra o CRM pelo atalho "Abrir CRM na rede".'}</p></div>
    </section>`;
}

export const reset = () => { edit = null; };

actions({
  click: {
    cfgAba: el => { ui.config.tab = el.dataset.tab; reset(); rerender(); },
    cfgCor: el => api('PATCH', '/api/settings', { brandColor: el.dataset.c }),
    cfgAdd: () => {
      const t = ui.config.tab;
      const color = COLORS[(edit.length + 1) % COLORS.length];
      edit.push(t === 'etapas' ? { name: 'Nova etapa', color, kind: 'open' } : t === 'equipe' ? { name: '', color, role: '' } : { name: 'Nova origem', color });
      rerender();
      document.querySelectorAll('.edit-row .input')[edit.length * (t === 'equipe' ? 2 : 1) - (t === 'equipe' ? 2 : 1)]?.focus();
    },
    cfgDel: el => { edit.splice(Number(el.dataset.i), 1); rerender(); },
    cfgOrdem: el => {
      const i = Number(el.dataset.i), j = i + Number(el.dataset.d);
      if (j < 0 || j >= edit.length) return;
      [edit[i], edit[j]] = [edit[j], edit[i]];
      rerender();
    },
    cfgDesfazer: () => { reset(); rerender(); },
    cfgSalvarLista: async () => {
      const t = ui.config.tab;
      if (t === 'equipe' && edit.some(m => !m.name.trim())) return toast('Dê um nome para cada membro', 'erro');
      const removed = t === 'etapas' ? S.stages.filter(s => !edit.some(e => e.id === s.id) && S.leads.some(l => l.stageId === s.id)) : [];
      if (removed.length && !(await confirmBox(`A etapa "${removed.map(s => s.name).join('", "')}" tem leads. Eles vão para a primeira etapa aberta. Continuar?`, { ok: 'Salvar mesmo assim' }))) return;
      const path = { equipe: ['/api/members', 'members'], etapas: ['/api/stages', 'stages'], origens: ['/api/origins', 'origins'] }[t];
      await api('PUT', path[0], { [path[1]]: edit });
      reset();
      toast('Salvo');
      rerender();
    },
    apagarExemplos: async () => {
      if (!(await confirmBox('Apagar todos os leads, tarefas e membros de exemplo? Seus dados e as automações continuam.', { ok: 'Apagar exemplos' }))) return;
      await api('POST', '/api/samples/clear');
      toast('Exemplos apagados');
    },
  },
  input: { cfgItem: el => { edit[Number(el.dataset.i)][el.dataset.k] = el.value; } },
  change: {
    cfgItemSel: el => { edit[Number(el.dataset.i)][el.dataset.k] = el.value; },
    cfgNome: el => el.value.trim() && api('PATCH', '/api/settings', { workspaceName: el.value.trim() }),
    cfgCorHex: el => (/^#[0-9a-f]{6}$/i.test(el.value.trim()) ? api('PATCH', '/api/settings', { brandColor: el.value.trim() }) : toast('Use o formato #RRGGBB', 'erro')),
    cfgMin: el => api('PATCH', '/api/settings', { minutesPerAction: Math.max(0.5, Number(el.value) || 2.5) }),
    cfgRestaurar: async el => {
      const file = el.files[0];
      if (!file) return;
      let data;
      try { data = JSON.parse(await file.text()); } catch { return toast('Esse arquivo não é um backup válido', 'erro'); }
      if (!(await confirmBox('Restaurar substitui TODOS os dados atuais pelos do backup. Continuar?', { ok: 'Restaurar' }))) return;
      await api('POST', '/api/restore', data);
      reset();
      toast('Backup restaurado');
    },
  },
});
