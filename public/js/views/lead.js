// Ficha do lead (gaveta lateral) e janela de novo lead.
import { S, ui, api, rerender, lead as getLead, stage, member } from '../store.js';
import { actions } from '../actions.js';
import { icon } from '../icons.js';
import { esc, money, avatar, tempBadge, options, dateTime, ago, dueLabel, toLocalInput, fromLocalInput, modal, confirmBox, toast, empty, TEMPS } from '../ui.js';

const KINDS = {
  nota: ['Anotação', 'pencil'],
  ligacao: ['Ligação', 'phoneCall'],
  mensagem: ['Mensagem', 'message'],
  reuniao: ['Reunião', 'video'],
  email: ['E-mail', 'mail'],
};
const HIST_IC = { create: 'plus', move: 'move', tag: 'tag', owner: 'user', task: 'tarefas', file: 'clip', temp: 'thermo', value: 'money', info: 'history' };
let noteKind = 'nota';
let draftNote = '';

function field(label, ic, key, l, type = 'text', placeholder = '') {
  return `<div class="kv"><span>${icon(ic, 15)}${label}</span><input class="input" type="${type}" value="${esc(l[key] ?? '')}" placeholder="${esc(placeholder || '—')}" data-change="leadCampo" data-key="${key}" id="lf-${key}"></div>`;
}

export function view() {
  const l = getLead(ui.leadId);
  const st = stage(l.stageId);
  const openStages = S.stages.filter(s => s.kind !== 'lost');
  const idx = openStages.findIndex(s => s.id === l.stageId);
  const notes = S.interactions.filter(i => i.leadId === l.id);
  const hist = S.history.filter(h => h.leadId === l.id);
  const tasks = S.tasks.filter(t => t.leadId === l.id);
  const files = S.files.filter(f => f.leadId === l.id);
  const openTasks = tasks.filter(t => !t.done).length;
  const tab = ui.leadTab;
  const lostStage = S.stages.find(s => s.kind === 'lost');

  return `<div class="drawer-wrap" data-act="fecharLeadFora">
  <div class="drawer" role="dialog" aria-modal="true" aria-label="Ficha de ${esc(l.name)}">
    <div class="d-head">
      <div class="d-title">
        <span class="avatar lg">${esc(l.name.split(' ').slice(0, 2).map(p => p[0]).join('').toUpperCase())}</span>
        <div class="grow">
          <h2>${esc(l.name)}</h2>
          <div class="meta"><span>#L${l.code}</span>${l.company ? `<span>· ${esc(l.company)}</span>` : ''}<span>· criado ${ago(l.createdAt)}</span>${st?.kind === 'lost' ? '<span class="pill late">Perdido</span>' : ''}${st?.kind === 'won' ? '<span class="pill ok">Ganho</span>' : ''}</div>
        </div>
        ${tempBadge(l)}
        <span class="val">${money(l.value)}</span>
        <button class="icon-btn" data-act="leadMenu" aria-label="Mais ações">${icon('more', 18)}</button>
        <button class="icon-btn" data-act="fecharLead" aria-label="Fechar">${icon('x', 20)}</button>
      </div>
      <div class="stepper">
        ${openStages.map((s, i) => `<button class="step ${s.id === l.stageId ? 'current' : i < idx ? 'done' : ''}" style="--c:${esc(s.color)}" data-act="leadEtapa" data-stage="${s.id}" title="Mover para ${esc(s.name)}"><i></i>${esc(s.name)}</button>`).join('')}
      </div>
    </div>
    <div class="d-body">
      <div class="d-left">
        <div class="d-section"><span class="lbl caps">Responsável</span>
          <select class="select" data-change="leadDono" id="lf-owner"><option value="">Sem responsável</option>${options(S.members, l.ownerId)}</select></div>
        <div class="d-section"><span class="lbl caps">Contato</span>
          ${field('Nome', 'user', 'name', l)}
          ${field('Empresa', 'building', 'company', l)}
          ${field('Telefone', 'phone', 'phone', l, 'tel')}
          ${field('E-mail', 'mail', 'email', l, 'email')}
          ${field('Cidade', 'pin', 'city', l)}
          ${field('CPF/CNPJ', 'idcard', 'document', l)}
          ${field('Aniversário', 'calendar', 'birthday', l, 'text', 'dd/mm')}
        </div>
        <div class="d-section"><span class="lbl caps">Negócio</span>
          ${field('Interesse', 'target', 'interest', l)}
          <div class="kv"><span>${icon('money', 15)}Valor (R$)</span><input class="input num" type="number" min="0" step="100" value="${Number(l.value) || 0}" data-change="leadCampo" data-key="value" id="lf-value"></div>
          <div class="kv"><span>${icon('zap', 15)}Origem</span><select class="select" data-change="leadCampo" data-key="originId" id="lf-origin"><option value="">Sem origem</option>${options(S.origins, l.originId)}</select></div>
          <div class="kv"><span>${icon('thermo', 15)}Temperatura</span><select class="select" data-change="leadCampo" data-key="temperature" id="lf-temp">${Object.entries(TEMPS).map(([k, v]) => `<option value="${k}" ${l.temperature === k ? 'selected' : ''}>${v}</option>`).join('')}</select></div>
          <div class="kv"><span>${icon('trend', 15)}Score (0-100)</span><input class="input num" type="number" min="0" max="100" value="${Number(l.score) || 0}" data-change="leadCampo" data-key="score" id="lf-score"></div>
          <div class="kv"><span>${icon('clock', 15)}Criado em</span><span style="color:var(--fg)">${dateTime(l.createdAt)}</span></div>
        </div>
        <div class="d-section"><span class="lbl caps">Tags</span>
          <div class="tags-row">${(l.tags || []).map(t => `<span class="tag">${esc(t)}<button data-act="leadTirarTag" data-tag="${esc(t)}" aria-label="Remover tag ${esc(t)}">${icon('x', 12)}</button></span>`).join('')}
          <input class="input" placeholder="+ nova tag" data-enter="leadTag" id="lf-newtag"></div></div>
        <div class="d-section"><span class="lbl caps">Observações</span>
          <textarea class="input" placeholder="Informações fixas sobre o cliente" data-change="leadCampo" data-key="notes" id="lf-notes">${esc(l.notes || '')}</textarea></div>
        <div style="display:flex;gap:8px;flex-wrap:wrap">
          ${st?.kind === 'open' && lostStage ? `<button class="btn sm" data-act="leadEtapa" data-stage="${lostStage.id}">Marcar como perdido</button>` : ''}
          ${st?.kind !== 'open' ? `<button class="btn sm" data-act="leadEtapa" data-stage="${openStages[0]?.id}">Reabrir no funil</button>` : ''}
        </div>
      </div>
      <div class="d-right">
        <div class="tabs">
          ${[['interacoes', 'Interações', 'message', notes.length], ['historico', 'Histórico', 'history', hist.length], ['tarefas', 'Tarefas', 'tarefas', openTasks], ['arquivos', 'Arquivos', 'clip', files.length]]
            .map(([k, n, ic, c]) => `<button class="tab ${tab === k ? 'on' : ''}" data-act="leadAba" data-tab="${k}">${icon(ic, 15)}${n}${c ? `<span class="count">${c}</span>` : ''}</button>`).join('')}
        </div>
        ${tab === 'interacoes' ? interacoes(l, notes) : ''}
        ${tab === 'historico' ? historico(hist) : ''}
        ${tab === 'tarefas' ? tarefas(l, tasks) : ''}
        ${tab === 'arquivos' ? arquivos(files) : ''}
      </div>
    </div>
  </div></div>`;
}

function interacoes(l, notes) {
  return `<div class="tab-body">
    ${notes.length ? [...notes].reverse().map(n => {
      const [kname, kic] = KINDS[n.kind] || KINDS.nota;
      const who = n.auto ? 'Automação' : member(n.authorId)?.name || '';
      return `<div class="note ${n.auto ? 'auto' : ''}"><div class="meta">${icon(n.auto ? 'zap' : kic, 13)}<b>${kname}</b>${who ? `<span>· ${esc(who)}</span>` : ''}<span class="grow">· ${dateTime(n.at)}</span>
        <button class="icon-btn del" data-act="notaApagar" data-id="${n.id}" aria-label="Apagar">${icon('trash', 14)}</button></div><div class="text">${esc(n.text)}</div></div>`;
    }).join('') : empty('Nenhuma interação ainda', 'Registre ligações, reuniões, mensagens e anotações sobre este lead.')}
  </div>
  <div class="composer">
    <div class="seg">${Object.entries(KINDS).map(([k, [n, ic]]) => `<button class="${noteKind === k ? 'on' : ''}" data-act="notaTipo" data-kind="${k}" style="display:inline-flex;gap:6px;align-items:center">${icon(ic, 13)}${n}</button>`).join('')}</div>
    <textarea class="input" placeholder="O que aconteceu? (Enter registra, Shift+Enter quebra linha)" data-enter="notaSalvar" data-input="notaRascunho" id="nota-texto">${esc(draftNote)}</textarea>
    <div class="row"><select class="select" style="width:200px" id="nota-autor" aria-label="Quem registrou">${options(S.members, l.ownerId)}</select><div class="grow"></div>
      <button class="btn primary" data-act="notaSalvar">${icon('check', 15)} Registrar</button></div>
  </div>`;
}

function historico(hist) {
  return `<div class="tab-body"><div class="timeline">
    ${[...hist].reverse().map(h => `<div class="tl-item">${icon(HIST_IC[h.kind] || 'history', 15)}<span>${esc(h.text)}</span><span class="muted small">${dateTime(h.at)}</span></div>`).join('') || empty('Sem histórico', 'As movimentações do lead aparecem aqui.')}
  </div></div>`;
}

function taskRow(t) {
  const d = dueLabel(t);
  return `<div class="task-row ${t.done ? 'done' : ''}"><button class="check ${t.done ? 'on' : ''}" data-act="tarefaFeita" data-id="${t.id}" aria-label="${t.done ? 'Reabrir' : 'Concluir'}">${icon('check', 12)}</button>
    <div class="grow"><div class="title">${esc(t.title)}</div>${t.auto ? `<div class="sub">${icon('zap', 11)} criada por automação</div>` : ''}</div>
    <span class="due ${d.cls}">${icon('clock', 12)}${esc(d.text)}</span>${avatar(t.ownerId)}
    <button class="icon-btn" data-act="tarefaApagar" data-id="${t.id}" aria-label="Apagar tarefa">${icon('trash', 14)}</button></div>`;
}

const quickDue = () => {
  const d = new Date(Date.now() + 86400e3); d.setHours(9, 0, 0, 0);
  return toLocalInput(d.toISOString());
};

function tarefas(l, tasks) {
  const pend = tasks.filter(t => !t.done).sort((a, b) => (a.dueAt || '9').localeCompare(b.dueAt || '9'));
  const done = tasks.filter(t => t.done);
  return `<div class="tab-body">
    <div class="task-add"><input class="input" placeholder="Nova tarefa, ex.: Ligar para confirmar a reunião" data-enter="tarefaNova" id="tarefa-titulo">
      <input class="input" type="datetime-local" value="${quickDue()}" id="tarefa-prazo" aria-label="Prazo">
      <button class="btn primary" data-act="tarefaNova">${icon('plus', 15)} Adicionar</button></div>
    ${pend.map(taskRow).join('') || (done.length ? '' : empty('Nenhuma tarefa', 'Crie a próxima ação para não esquecer deste lead.'))}
    ${done.length ? `<div class="lbl caps" style="margin-top:8px">Concluídas</div>${done.map(taskRow).join('')}` : ''}
  </div>`;
}

const size = b => (b > 1048576 ? (b / 1048576).toFixed(1) + ' MB' : Math.max(1, Math.round(b / 1024)) + ' KB');
function arquivos(files) {
  return `<div class="tab-body">
    <label class="drop-zone" id="drop-zone">${icon('upload', 22)}<strong>Arraste arquivos ou clique para anexar</strong><span class="small">PDF, imagens, planilhas · até 25 MB cada · ficam guardados na pasta "dados" do CRM</span>
      <input type="file" multiple hidden id="file-input"></label>
    ${files.map(f => `<div class="file-row">${icon('file', 18)}<a class="grow" href="/api/files/${f.id}" target="_blank" rel="noopener">${esc(f.name)}</a><span class="muted small">${size(f.size)} · ${dateTime(f.at)}</span>
      <a class="icon-btn" href="/api/files/${f.id}" download="${esc(f.name)}" aria-label="Baixar">${icon('download', 15)}</a>
      <button class="icon-btn" data-act="arquivoApagar" data-id="${f.id}" aria-label="Apagar">${icon('trash', 14)}</button></div>`).join('') || '<p class="muted" style="text-align:center">Nenhum arquivo anexado</p>'}
  </div>`;
}

async function upload(list) {
  for (const f of list) {
    if (f.size > 25 * 1024 * 1024) { toast(`${f.name} passa de 25 MB`, 'erro'); continue; }
    const data = await new Promise((ok, fail) => {
      const r = new FileReader();
      r.onload = () => ok(String(r.result).split(',')[1] || '');
      r.onerror = fail;
      r.readAsDataURL(f);
    });
    await api('POST', `/api/leads/${ui.leadId}/files`, { name: f.name, mime: f.type, data });
    toast('Arquivo anexado: ' + f.name);
  }
}

export function mounted() {
  const zone = document.getElementById('drop-zone');
  if (zone) {
    const input = document.getElementById('file-input');
    input.addEventListener('change', () => upload([...input.files]));
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('over'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('over'); upload([...e.dataTransfer.files]); });
  }
}

// ---------- novo lead ----------
export function newLeadModal(stageId) {
  const firstOpen = S.stages.find(s => s.kind === 'open');
  modal({
    title: 'Novo lead',
    wide: true,
    body: `<div class="form-grid">
      <div class="field"><label for="nl-name">Nome *</label><input class="input" id="nl-name" placeholder="Nome da pessoa"></div>
      <div class="field"><label for="nl-company">Empresa</label><input class="input" id="nl-company"></div>
      <div class="field"><label for="nl-phone">Telefone</label><input class="input" id="nl-phone" type="tel"></div>
      <div class="field"><label for="nl-email">E-mail</label><input class="input" id="nl-email" type="email"></div>
      <div class="field"><label for="nl-value">Valor estimado (R$)</label><input class="input" id="nl-value" type="number" min="0" step="100" placeholder="0"></div>
      <div class="field"><label for="nl-interest">Interesse</label><input class="input" id="nl-interest" placeholder="O que a pessoa procura"></div>
      <div class="field"><label for="nl-origin">Origem</label><select class="select" id="nl-origin"><option value="">Sem origem</option>${options(S.origins, '')}</select></div>
      <div class="field"><label for="nl-stage">Etapa</label><select class="select" id="nl-stage">${options(S.stages.filter(s => s.kind === 'open'), stageId || firstOpen?.id)}</select></div>
      <div class="field"><label for="nl-owner">Responsável</label><select class="select" id="nl-owner"><option value="">Deixar as automações decidirem</option>${options(S.members, '')}</select></div>
      <div class="field"><label for="nl-city">Cidade</label><input class="input" id="nl-city"></div>
    </div>`,
    footer: '<button class="btn ghost" data-close>Cancelar</button><button class="btn primary" id="nl-save">Criar lead</button>',
    onMount: (el, close) => {
      const save = async () => {
        const v = id => el.querySelector('#nl-' + id).value.trim();
        if (!v('name')) { el.querySelector('#nl-name').focus(); toast('Informe o nome do lead', 'erro'); return; }
        const res = await api('POST', '/api/leads', {
          name: v('name'), company: v('company'), phone: v('phone'), email: v('email'), value: Number(v('value')) || 0,
          interest: v('interest'), originId: v('origin') || null, stageId: v('stage'), ownerId: v('owner') || null, city: v('city'),
        });
        close();
        toast('Lead criado');
        ui.leadId = res.id; ui.leadTab = 'interacoes';
        rerender();
      };
      el.querySelector('#nl-save').addEventListener('click', save);
      el.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.tagName === 'INPUT') save(); });
    },
  });
}

const patch = body => api('PATCH', `/api/leads/${ui.leadId}`, body);

actions({
  click: {
    abrirLead: el => { ui.leadId = el.dataset.id; ui.leadTab = 'interacoes'; draftNote = ''; rerender(); },
    novoLead: el => newLeadModal(el.dataset.stage),
    fecharLead: () => { ui.leadId = null; rerender(); },
    fecharLeadFora: (el, e) => { if (e.target === el) { ui.leadId = null; rerender(); } },
    leadAba: el => { ui.leadTab = el.dataset.tab; rerender(); },
    leadEtapa: el => patch({ stageId: el.dataset.stage }),
    leadTirarTag: el => api('DELETE', `/api/leads/${ui.leadId}/tags/${encodeURIComponent(el.dataset.tag)}`),
    leadMenu: () => {
      const l = getLead(ui.leadId);
      modal({
        title: l.name,
        body: `<p class="muted">Ações para este lead.</p>`,
        footer: `<button class="btn danger" id="lm-del">${icon('trash', 15)} Excluir lead</button><button class="btn" data-close>Fechar</button>`,
        onMount: (el, close) => el.querySelector('#lm-del').addEventListener('click', async () => {
          close();
          if (!(await confirmBox(`Excluir ${l.name}? Some junto o histórico, as tarefas e os arquivos dele.`, { ok: 'Excluir' }))) return;
          const id = l.id;
          ui.leadId = null;
          await api('DELETE', `/api/leads/${id}`);
          toast('Lead excluído');
        }),
      });
    },
    notaTipo: el => { noteKind = el.dataset.kind; draftNote = document.getElementById('nota-texto')?.value || ''; rerender(); document.getElementById('nota-texto')?.focus(); },
    notaSalvar: () => saveNote(),
    notaApagar: async el => { if (await confirmBox('Apagar esta interação?', { ok: 'Apagar' })) api('DELETE', `/api/interactions/${el.dataset.id}`); },
    tarefaNova: () => newTask(),
    tarefaFeita: el => { const t = S.tasks.find(x => x.id === el.dataset.id); api('PATCH', `/api/tasks/${t.id}`, { done: !t.done }); },
    tarefaApagar: async el => { if (await confirmBox('Apagar esta tarefa?', { ok: 'Apagar' })) api('DELETE', `/api/tasks/${el.dataset.id}`); },
    arquivoApagar: async el => { if (await confirmBox('Apagar este arquivo?', { ok: 'Apagar' })) api('DELETE', `/api/files/${el.dataset.id}`); },
  },
  change: {
    leadCampo: el => {
      const l = getLead(ui.leadId);
      const key = el.dataset.key;
      if (key === 'name' && !el.value.trim()) { el.value = l.name; return toast('O nome não pode ficar vazio', 'erro'); }
      patch({ [key]: el.value });
    },
    leadDono: el => patch({ ownerId: el.value || null }),
  },
  input: { notaRascunho: el => { draftNote = el.value; } },
  enter: {
    leadTag: el => { const tag = el.value.trim(); if (tag) api('POST', `/api/leads/${ui.leadId}/tags`, { tag }); },
    notaSalvar: () => saveNote(),
    tarefaNova: () => newTask(),
  },
});

async function saveNote() {
  const el = document.getElementById('nota-texto');
  const text = el.value.trim();
  if (!text) return el.focus();
  el.blur();
  await api('POST', '/api/interactions', { leadId: ui.leadId, kind: noteKind, text, authorId: document.getElementById('nota-autor').value || null });
  draftNote = '';
  rerender();
}

async function newTask() {
  const t = document.getElementById('tarefa-titulo');
  if (!t.value.trim()) return t.focus();
  t.blur();
  await api('POST', '/api/tasks', { leadId: ui.leadId, title: t.value.trim(), dueAt: fromLocalInput(document.getElementById('tarefa-prazo').value) });
  toast('Tarefa criada');
}
