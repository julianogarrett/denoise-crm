// Funil de vendas em colunas, com arrastar e soltar entre etapas.
import { S, ui, api, rerender } from '../store.js';
import { actions } from '../actions.js';
import { icon } from '../icons.js';
import { esc, money, avatar, originChip, options } from '../ui.js';

const norm = s => String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

function visibleLeads() {
  const q = norm(ui.funil.q);
  return S.leads.filter(l => {
    if (ui.funil.owner && (ui.funil.owner === '_none' ? l.ownerId : l.ownerId !== ui.funil.owner)) return false;
    if (!q) return true;
    return [l.name, l.company, l.phone, l.email, l.city, ...(l.tags || [])].some(v => norm(v).includes(q));
  });
}

function card(l) {
  const last = [...S.interactions].reverse().find(i => i.leadId === l.id);
  const late = S.tasks.filter(t => t.leadId === l.id && !t.done && t.dueAt && Date.parse(t.dueAt) < Date.now()).length;
  return `<button class="lead-card" draggable="true" data-act="abrirLead" data-id="${l.id}">
    <div class="r1"><div><div class="name">${esc(l.name)}</div>${l.company ? `<div class="company">${esc(l.company)}</div>` : ''}</div>${avatar(l.ownerId)}</div>
    ${last ? `<div class="last">${icon('message', 13)}<span>${esc(last.text)}</span>${late ? `<span class="late-dot" title="${late} tarefa(s) atrasada(s)">${late}</span>` : ''}</div>` : late ? `<div class="last"><span class="late-dot">${late}</span><span class="muted">tarefa atrasada</span></div>` : ''}
    <div class="r3"><div class="flags">${originChip(l.originId)}${(l.tags || []).slice(0, 2).map(t => `<span class="tag">${esc(t)}</span>`).join('')}</div><span class="value">${money(l.value)}</span></div>
  </button>`;
}

export function view() {
  const leads = visibleLeads();
  const cols = S.stages.filter(s => ui.funil.showClosed || s.kind !== 'lost');
  const open = leads.filter(l => S.stages.find(s => s.id === l.stageId)?.kind === 'open');
  const hidden = S.stages.filter(s => s.kind === 'lost').length;
  return `
    <div class="page-head">
      <h1>Funil de vendas</h1><div class="grow"></div>
      <button class="btn primary" data-act="novoLead">${icon('plus', 16)} Novo lead</button>
      <div class="sub">
        <span><b style="color:var(--fg)">${open.length} leads abertos</b> · ${money(open.reduce((s, l) => s + Number(l.value || 0), 0))}</span>
        <div class="grow"></div>
        <div class="search" style="width:280px"><span>${icon('search', 15)}</span><input class="input" placeholder="Nome, empresa, telefone ou tag" value="${esc(ui.funil.q)}" data-input="funilBusca" id="funil-busca"></div>
        <select class="select" style="width:220px" data-change="funilDono" id="funil-dono" aria-label="Filtrar por responsável">
          <option value="">Todos os responsáveis</option>${options(S.members, ui.funil.owner)}<option value="_none" ${ui.funil.owner === '_none' ? 'selected' : ''}>Sem responsável</option>
        </select>
        ${hidden ? `<button class="btn" data-act="funilPerdidos">${ui.funil.showClosed ? 'Esconder perdidos' : 'Mostrar perdidos'}</button>` : ''}
      </div>
    </div>
    <div class="board">
      ${cols.map(s => {
        const items = leads.filter(l => l.stageId === s.id).sort((a, b) => (b.updatedAt || '').localeCompare(a.updatedAt || ''));
        return `<div class="col" data-stage="${s.id}">
          <div class="col-head" style="--c:${esc(s.color)}"><div class="row"><span>${esc(s.name)}</span><span>${items.length}</span></div><div class="sum">${money(items.reduce((t, l) => t + Number(l.value || 0), 0))}</div></div>
          <div class="col-body">${items.map(card).join('')}</div>
          ${s.kind === 'open' ? `<button class="add-in-col" data-act="novoLead" data-stage="${s.id}">${icon('plus', 14)} Adicionar</button>` : ''}
        </div>`;
      }).join('')}
    </div>`;
}

// arrastar e soltar
let dragId = null;
export function mounted() {
  const board = document.querySelector('.board');
  if (!board) return;
  board.addEventListener('dragstart', e => {
    const c = e.target.closest('.lead-card');
    if (!c) return;
    dragId = c.dataset.id;
    c.classList.add('dragging');
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', dragId);
  });
  board.addEventListener('dragend', e => { e.target.closest('.lead-card')?.classList.remove('dragging'); board.querySelectorAll('.drop').forEach(x => x.classList.remove('drop')); });
  board.addEventListener('dragover', e => {
    const col = e.target.closest('.col');
    if (!col || !dragId) return;
    e.preventDefault();
    board.querySelectorAll('.drop').forEach(x => x !== col && x.classList.remove('drop'));
    col.classList.add('drop');
  });
  board.addEventListener('drop', async e => {
    const col = e.target.closest('.col');
    if (!col || !dragId) return;
    e.preventDefault();
    const id = dragId; dragId = null;
    const l = S.leads.find(x => x.id === id);
    if (l && l.stageId !== col.dataset.stage) {
      l.stageId = col.dataset.stage; // mostra na hora; o servidor confirma em seguida
      rerender();
      await api('PATCH', `/api/leads/${id}`, { stageId: col.dataset.stage });
    }
  });
}

let searchTimer;
actions({
  input: {
    funilBusca: el => {
      ui.funil.q = el.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(() => {
        const pos = el.selectionStart;
        rerender();
        const again = document.getElementById('funil-busca');
        again?.focus(); again?.setSelectionRange(pos, pos);
      }, 180);
    },
  },
  change: { funilDono: el => { ui.funil.owner = el.value; rerender(); } },
  click: { funilPerdidos: () => { ui.funil.showClosed = !ui.funil.showClosed; rerender(); } },
});
