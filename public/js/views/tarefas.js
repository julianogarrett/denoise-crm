// Tarefas: todas as tarefas da equipe, com e sem lead.
import { S, ui, api, rerender } from '../store.js';
import { actions } from '../actions.js';
import { icon } from '../icons.js';
import { esc, avatar, dueLabel, options, empty, fromLocalInput, toLocalInput } from '../ui.js';

const FILTERS = [['abertas', 'Abertas'], ['atrasadas', 'Atrasadas'], ['hoje', 'Hoje'], ['semana', 'Próximos 7 dias'], ['concluidas', 'Concluídas']];

function filtered() {
  const endToday = new Date(); endToday.setHours(23, 59, 59, 999);
  const t = Date.now();
  return S.tasks.filter(x => {
    if (ui.tarefas.owner && x.ownerId !== ui.tarefas.owner) return false;
    const due = x.dueAt ? Date.parse(x.dueAt) : null;
    switch (ui.tarefas.filter) {
      case 'abertas': return !x.done;
      case 'atrasadas': return !x.done && due && due < t;
      case 'hoje': return !x.done && due && due <= endToday.getTime();
      case 'semana': return !x.done && due && due <= t + 7 * 86400e3;
      case 'concluidas': return x.done;
    }
    return true;
  }).sort((a, b) => ui.tarefas.filter === 'concluidas' ? (b.doneAt || '').localeCompare(a.doneAt || '') : (a.dueAt || '9').localeCompare(b.dueAt || '9'));
}

export function view() {
  const list = filtered();
  const late = S.tasks.filter(t => !t.done && t.dueAt && Date.parse(t.dueAt) < Date.now()).length;
  const tomorrow = new Date(Date.now() + 86400e3); tomorrow.setHours(9, 0, 0, 0);
  return `
    <div class="page-head"><h1>Tarefas</h1><div class="grow"></div>
      <div class="sub">
        <div class="seg">${FILTERS.map(([k, n]) => `<button class="${ui.tarefas.filter === k ? 'on' : ''}" data-act="tarefasFiltro" data-f="${k}">${n}${k === 'atrasadas' && late ? ` (${late})` : ''}</button>`).join('')}</div>
        <div class="grow"></div>
        <select class="select" style="width:220px" data-change="tarefasDono" id="tarefas-dono" aria-label="Filtrar por responsável"><option value="">Todos os responsáveis</option>${options(S.members, ui.tarefas.owner)}</select>
      </div>
    </div>
    <div class="card" style="margin-bottom:16px;padding:14px">
      <div class="task-add" style="grid-template-columns:1fr 200px 200px auto">
        <input class="input" placeholder="Nova tarefa da equipe (sem lead), ex.: Fechar relatório do mês" data-enter="tarefaSolta" id="ts-titulo">
        <input class="input" type="datetime-local" id="ts-prazo" value="${toLocalInput(tomorrow.toISOString())}" aria-label="Prazo">
        <select class="select" id="ts-dono" aria-label="Responsável">${options(S.members, S.members[0]?.id)}</select>
        <button class="btn primary" data-act="tarefaSolta">${icon('plus', 15)} Adicionar</button>
      </div>
    </div>
    <div class="list-task">
      ${list.map(t => {
        const d = dueLabel(t);
        const l = S.leads.find(x => x.id === t.leadId);
        return `<div class="task-row ${t.done ? 'done' : ''}"><button class="check ${t.done ? 'on' : ''}" data-act="tarefaFeita" data-id="${t.id}" aria-label="${t.done ? 'Reabrir' : 'Concluir'}">${icon('check', 12)}</button>
          <div class="grow"><div class="title">${esc(t.title)}</div><div class="sub">${l ? `<button class="link" data-act="abrirLead" data-id="${l.id}">${icon('user', 11)} ${esc(l.name)}</button>` : '<span>Tarefa da equipe</span>'}${t.auto ? `<span>· ${icon('zap', 11)} automação</span>` : ''}</div></div>
          <span class="due ${d.cls}">${icon('clock', 12)}${esc(d.text)}</span>${avatar(t.ownerId)}
          <button class="icon-btn" data-act="tarefaApagar" data-id="${t.id}" aria-label="Apagar tarefa">${icon('trash', 14)}</button></div>`;
      }).join('') || `<div class="card">${empty('Nada aqui', ui.tarefas.filter === 'concluidas' ? 'Nenhuma tarefa concluída ainda.' : 'Nenhuma tarefa neste filtro.')}</div>`}
    </div>`;
}

async function addLoose() {
  const t = document.getElementById('ts-titulo');
  if (!t.value.trim()) return t.focus();
  t.blur();
  await api('POST', '/api/tasks', { title: t.value.trim(), dueAt: fromLocalInput(document.getElementById('ts-prazo').value), ownerId: document.getElementById('ts-dono').value || null });
}

actions({
  click: {
    tarefasFiltro: el => { ui.tarefas.filter = el.dataset.f; rerender(); },
    tarefaSolta: addLoose,
  },
  change: { tarefasDono: el => { ui.tarefas.owner = el.value; rerender(); } },
  enter: { tarefaSolta: addLoose },
});
