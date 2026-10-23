// Automações: lista por etapa do funil, modelos prontos e editor de fluxo em blocos.
import { S, ui, api, rerender, stage, member, origin } from '../store.js';
import { actions } from '../actions.js';
import { icon } from '../icons.js';
import { esc, money, options, dateTime, ago, toast, confirmBox, empty, TEMPS } from '../ui.js';

export const BLOCKS = {
  add_interaction: { group: 'Registro', name: 'Registrar anotação', ic: 'pencil', color: '#0ea5e9' },
  notify: { group: 'Registro', name: 'Avisar a equipe', ic: 'bell', color: '#f97316' },
  condition: { group: 'Lógica', name: 'Condição', ic: 'branch', color: '#8b5cf6' },
  wait: { group: 'Lógica', name: 'Aguardar', ic: 'clock', color: '#f59e0b' },
  move_stage: { group: 'CRM', name: 'Mover etapa', ic: 'move', color: '#6366f1' },
  assign_owner: { group: 'CRM', name: 'Distribuir responsável', ic: 'users', color: '#2563eb' },
  add_tag: { group: 'CRM', name: 'Adicionar tag', ic: 'tag', color: '#db2777' },
  remove_tag: { group: 'CRM', name: 'Remover tag', ic: 'tagOff', color: '#9d174d' },
  create_task: { group: 'CRM', name: 'Criar tarefa', ic: 'tarefas', color: '#16a34a' },
  set_temperature: { group: 'CRM', name: 'Definir temperatura', ic: 'thermo', color: '#ef4444' },
  set_value: { group: 'CRM', name: 'Definir valor', ic: 'money', color: '#059669' },
};
const DEFAULTS = {
  add_interaction: () => ({ kind: 'nota', text: '' }),
  notify: () => ({ text: '' }),
  condition: () => ({ field: 'origem', op: 'igual', value: S.origins[0]?.id || '' }),
  wait: () => ({ amount: 1, unit: 'dias' }),
  move_stage: () => ({ stageId: S.stages[1]?.id || S.stages[0]?.id }),
  assign_owner: () => ({ mode: 'rodizio', memberIds: [], memberId: S.members[0]?.id }),
  add_tag: () => ({ tag: '' }),
  remove_tag: () => ({ tag: '' }),
  create_task: () => ({ title: '', amount: 1, unit: 'dias', owner: 'responsavel' }),
  set_temperature: () => ({ temperature: 'quente' }),
  set_value: () => ({ value: 0 }),
};
const TRIGGERS = {
  lead_created: 'Lead entrou no CRM',
  stage_entered: 'Lead entrou numa etapa',
  tag_added: 'Tag adicionada ao lead',
  lead_idle: 'Lead parado (sem movimentação)',
};
const FIELDS = { origem: 'Origem', etapa: 'Etapa', responsavel: 'Responsável', temperatura: 'Temperatura', valor: 'Valor (R$)', score: 'Score', tag: 'Tags', cidade: 'Cidade', interesse: 'Interesse' };
const OPS_BY = {
  list: [['igual', 'é'], ['diferente', 'não é']],
  number: [['maior', 'maior que'], ['menor', 'menor que'], ['igual', 'igual a'], ['diferente', 'diferente de']],
  tag: [['contem', 'tem a tag'], ['nao_contem', 'não tem a tag']],
  text: [['contem', 'contém'], ['nao_contem', 'não contém'], ['igual', 'é exatamente'], ['diferente', 'não é']],
};
const opsFor = f => (['origem', 'etapa', 'responsavel', 'temperatura'].includes(f) ? OPS_BY.list : ['valor', 'score'].includes(f) ? OPS_BY.number : f === 'tag' ? OPS_BY.tag : OPS_BY.text);
const UNITS = ['minutos', 'horas', 'dias'];
const VARS = ['nome', 'primeiro_nome', 'empresa', 'responsavel', 'etapa', 'valor', 'origem', 'cidade', 'interesse'];

// ---------- descrições ----------
export function triggerText(t) {
  if (t.type === 'stage_entered') return `Lead entrou na etapa: ${stage(t.stageId)?.name || 'qualquer etapa'}`;
  if (t.type === 'tag_added') return t.tag ? `Tag "${t.tag}" adicionada` : 'Qualquer tag adicionada';
  if (t.type === 'lead_idle') return `Lead parado há ${t.days || 5} dia(s)${t.stageId ? ' em ' + (stage(t.stageId)?.name || '') : ''}`;
  return 'Lead entrou no CRM';
}
function condValue(s) {
  if (s.field === 'origem') return origin(s.value)?.name || '—';
  if (s.field === 'etapa') return stage(s.value)?.name || '—';
  if (s.field === 'responsavel') return member(s.value)?.name || '—';
  if (s.field === 'temperatura') return TEMPS[s.value] || s.value;
  if (s.field === 'valor') return money(s.value);
  return `"${s.value}"`;
}
function stepText(s) {
  switch (s.type) {
    case 'add_interaction': return s.text ? `"${s.text}"` : 'Escreva o texto';
    case 'notify': return s.text ? `"${s.text}"` : 'Escreva o aviso';
    case 'condition': return `Continua se ${FIELDS[s.field]?.toLowerCase()} ${opsFor(s.field).find(o => o[0] === s.op)?.[1] || ''} ${condValue(s)}`;
    case 'wait': return `${s.amount} ${s.unit}`;
    case 'move_stage': return `Para ${stage(s.stageId)?.name || 'escolha a etapa'}`;
    case 'assign_owner': return s.mode === 'rodizio' ? `Rodízio entre ${s.memberIds?.length ? s.memberIds.map(id => member(id)?.name).filter(Boolean).join(', ') : 'toda a equipe'}` : `Para ${member(s.memberId)?.name || 'escolha o membro'}`;
    case 'add_tag': case 'remove_tag': return s.tag ? `"${s.tag}"` : 'Escreva a tag';
    case 'create_task': return s.title ? `"${s.title}" · prazo ${s.amount} ${s.unit}` : 'Escreva a tarefa';
    case 'set_temperature': return TEMPS[s.temperature];
    case 'set_value': return money(s.value);
  }
  return '';
}
function invalid(s) {
  if (['add_interaction', 'notify'].includes(s.type)) return !String(s.text || '').trim();
  if (['add_tag', 'remove_tag'].includes(s.type)) return !String(s.tag || '').trim();
  if (s.type === 'create_task') return !String(s.title || '').trim();
  if (s.type === 'move_stage') return !stage(s.stageId);
  if (s.type === 'assign_owner') return s.mode !== 'rodizio' && !member(s.memberId);
  return false;
}
const blkIc = (type, lg = false) => { const b = BLOCKS[type]; return `<span class="blk-ic ${lg ? 'lg' : ''}" style="--c:${b?.color || '#64748b'}">${icon(b?.ic || 'zap', lg ? 16 : 13)}</span>`; };
const chain = a => `<div class="chain"><span class="blk-ic trig">${icon('play', 12)}</span>${a.steps.map(s => `${icon('chevronRight', 12)}${blkIc(s.type)}`).join('')}</div>`;

// ---------- rotas ----------
export function openFromHash(id) {
  if (!id) { ui.auto.editing = null; ui.auto.draft = null; return; }
  if (ui.auto.editing === id && ui.auto.draft) return;
  if (!S) { ui.auto.editing = id; return; }
  const a = S.automations.find(x => x.id === id);
  if (id !== 'nova' && !a) { ui.auto.editing = null; location.hash = '#automacoes'; return; }
  ui.auto.editing = id;
  ui.auto.draft = a ? structuredClone(a) : ui.auto.pendingDraft || { name: 'Nova automação', description: '', active: false, trigger: { type: 'lead_created' }, steps: [] };
  ui.auto.pendingDraft = null;
  ui.auto.sel = -1; ui.auto.menuAt = null; ui.auto.sideTab = 'configurar'; ui.auto.testLog = null; ui.auto.dirty = false;
}

export function view() {
  if (ui.auto.editing && !ui.auto.draft) openFromHash(ui.auto.editing);
  return ui.auto.draft ? editor() : list();
}

// ---------- lista ----------
function list() {
  const st = S.stats;
  const hours = st.savedMinutes >= 60 ? `~${Math.round(st.savedMinutes / 60)}h` : `${st.savedMinutes} min`;
  const kpi = (l, v, s = '') => `<div class="card kpi"><div class="k-label">${l}</div><div class="k-value">${v}</div><div class="k-sub">${s}</div></div>`;
  const tab = ui.auto.tab;
  return `
    <div class="page-head"><h1>Automações</h1><div class="grow"></div><button class="btn primary" data-act="autoNova">${icon('plus', 16)} Criar do zero</button></div>
    <div class="kpis">
      ${kpi('Automações ativas', `${st.active} de ${st.total}`)}
      ${kpi('Execuções no mês', st.monthRuns.toLocaleString('pt-BR'))}
      ${kpi('Taxa de sucesso', st.successRate === null ? '—' : st.successRate + '%')}
      ${kpi('Tempo economizado', hours, `estimando ${String(S.settings.minutesPerAction).replace('.', ',')} min por ação manual`)}
    </div>
    <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap;margin-bottom:14px">
      <div class="seg">${[['funil', 'Por etapa do funil'], ['todas', 'Todas as automações'], ['modelos', 'Modelos prontos']].map(([k, n]) => `<button class="${tab === k ? 'on' : ''}" data-act="autoAba" data-tab="${k}">${n}</button>`).join('')}</div>
      <span class="muted">${tab === 'funil' ? 'O que acontece sozinho em cada etapa. Clique para editar ou em "Adicionar" para criar.' : tab === 'modelos' ? 'Fluxos prontos para usar e ajustar.' : ''}</span>
    </div>
    ${tab === 'funil' ? byStage() : tab === 'todas' ? allList() : templates()}`;
}

function autoCard(a) {
  const runs = S.stats.per[a.id]?.runs || 0;
  return `<div class="auto-card ${a.active ? '' : 'off'}" data-act="autoAbrir" data-id="${a.id}">
    <div class="r1"><span class="name">${esc(a.name)}</span><button class="switch ${a.active ? 'on' : ''}" data-act="autoLiga" data-id="${a.id}" aria-label="${a.active ? 'Desativar' : 'Ativar'}"></button></div>
    ${chain(a)}
    <span class="muted small">${runs.toLocaleString('pt-BR')} execuç${runs === 1 ? 'ão' : 'ões'}</span>
  </div>`;
}

function byStage() {
  const cols = [
    { key: 'created', name: 'Ao entrar no CRM', color: '#71717a', items: S.automations.filter(a => a.trigger.type === 'lead_created'), add: 'lead_created' },
    ...S.stages.map(s => ({ key: s.id, name: s.name, color: s.color, items: S.automations.filter(a => a.trigger.type === 'stage_entered' && a.trigger.stageId === s.id), add: 'stage:' + s.id })),
    { key: 'other', name: 'Outros gatilhos', color: '#a1a1aa', items: S.automations.filter(a => ['tag_added', 'lead_idle'].includes(a.trigger.type) || (a.trigger.type === 'stage_entered' && !stage(a.trigger.stageId))), add: 'lead_idle' },
  ];
  return `<div class="flow-cols">${cols.map(c => `<div class="col">
    <div class="col-head" style="--c:${esc(c.color)}"><div class="row"><span>${esc(c.name)}</span><span>${c.items.length}</span></div></div>
    <div class="col-body">${c.items.map(autoCard).join('')}</div>
    <button class="add-in-col" data-act="autoNova" data-trigger="${esc(c.add)}">${icon('plus', 14)} Adicionar</button></div>`).join('')}</div>`;
}

function allList() {
  if (!S.automations.length) return `<div class="card">${empty('Nenhuma automação', 'Comece por um modelo pronto ou crie do zero.')}</div>`;
  return `<div class="auto-list">${S.automations.map(a => {
    const per = S.stats.per[a.id];
    return `<div class="card auto-card ${a.active ? '' : 'off'}" data-act="autoAbrir" data-id="${a.id}"><div class="auto-row">
      <div style="min-width:0"><div class="name">${esc(a.name)}</div><div class="muted small">${esc(triggerText(a.trigger))}</div></div>
      ${chain(a)}<span class="muted small">${per ? `${per.runs} execuções · última ${ago(per.last)}` : 'Nunca rodou'}</span>
      <button class="switch ${a.active ? 'on' : ''}" data-act="autoLiga" data-id="${a.id}" aria-label="${a.active ? 'Desativar' : 'Ativar'}"></button></div></div>`;
  }).join('')}</div>`;
}

function templates() {
  return `<div class="tpl-grid">${S.templates.map(t => `<div class="card" style="display:flex;flex-direction:column;gap:10px">
    <h3 style="margin:0">${esc(t.name)}</h3><p class="muted">${esc(t.description)}</p>
    <div class="muted small">${icon('play', 11)} ${esc(triggerText(t.trigger))}</div>
    ${chain(t)}
    <div><button class="btn sm" data-act="autoModelo" data-key="${t.key}">${icon('layers', 14)} Usar modelo</button></div></div>`).join('')}</div>`;
}

// ---------- editor ----------
function editor() {
  const d = ui.auto.draft;
  const sel = ui.auto.sel;
  const plus = i => `<div class="wire"></div><div class="add-node"><button class="plus" data-act="edMenu" data-at="${i}" aria-label="Adicionar bloco">${icon('plus', 14)}</button>${ui.auto.menuAt === i ? blockMenu(i) : ''}</div>`;
  return `<div class="editor">
    <div class="ed-top">
      <button class="btn ghost sm" data-act="edVoltar">${icon('arrowLeft', 15)} Automações</button>
      <input class="input name-input" value="${esc(d.name)}" data-input="edNome" id="ed-nome" aria-label="Nome da automação">
      <div class="grow"></div>
      ${ui.auto.dirty ? '<span class="muted small">Alterações não salvas</span>' : ''}
      <button class="switch ${d.active ? 'on' : ''}" data-act="edLiga" aria-label="Ativar ou desativar"></button><span>${d.active ? 'Ativada' : 'Desativada'}</span>
      ${ui.auto.editing !== 'nova' ? `<button class="icon-btn" data-act="edExcluir" aria-label="Excluir automação">${icon('trash', 16)}</button>` : ''}
      <button class="btn primary sm" data-act="edSalvar">${icon('save', 15)} Salvar</button>
    </div>
    <div class="canvas" data-act="edFundo">
      <button class="node ${sel === -1 ? 'sel' : ''}" data-act="edSel" data-i="-1">
        <span class="blk-ic lg trig">${icon('play', 15)}</span>
        <div class="grow"><div class="kind">Gatilho</div><div class="desc">${esc(triggerText(d.trigger))}</div></div></button>
      ${plus(-1)}
      ${d.steps.map((s, i) => `<div class="wire"></div>
        <button class="node ${sel === i ? 'sel' : ''} ${invalid(s) ? 'invalid' : ''}" data-act="edSel" data-i="${i}">
          ${blkIc(s.type, true)}<div class="grow"><div class="kind">${esc(BLOCKS[s.type]?.name || s.type)}</div><div class="desc">${esc(stepText(s))}</div></div></button>
        ${plus(i)}`).join('')}
      <div class="wire"></div><span class="end-node">Fim do fluxo</span>
    </div>
    <div class="ed-side">
      <div class="tabs">${[['configurar', 'Configurar'], ['testar', 'Testar'], ['execucoes', 'Execuções']].map(([k, n]) => `<button class="tab ${ui.auto.sideTab === k ? 'on' : ''}" data-act="edAba" data-tab="${k}">${n}</button>`).join('')}</div>
      <div class="tab-body">${ui.auto.sideTab === 'configurar' ? configPanel() : ui.auto.sideTab === 'testar' ? testPanel() : runsPanel()}</div>
    </div>
  </div>`;
}

function blockMenu(at) {
  const groups = {};
  for (const [type, b] of Object.entries(BLOCKS)) (groups[b.group] ||= []).push([type, b]);
  return `<div class="menu">${Object.entries(groups).map(([g, items], i) => `${i ? '<hr>' : ''}<div class="grp">${g}</div>${items.map(([type, b]) => `<button data-act="edAdd" data-type="${type}" data-at="${at}">${blkIc(type)}${b.name}</button>`).join('')}`).join('')}</div>`;
}

const inp = (key, val, attrs = '') => `<input class="input" value="${esc(val ?? '')}" data-input="edCampo" data-change="edCampoFim" data-key="${key}" id="ed-${key}" ${attrs}>`;
const sel = (key, html) => `<select class="select" data-change="edCampoSel" data-key="${key}" id="ed-${key}">${html}</select>`;
const opt = (pairs, cur) => pairs.map(([v, n]) => `<option value="${esc(v)}" ${String(v) === String(cur) ? 'selected' : ''}>${esc(n)}</option>`).join('');
const varBtns = key => `<div class="vars">${VARS.map(v => `<button data-act="edVar" data-key="${key}" data-v="${v}">{${v}}</button>`).join('')}</div>`;

function configPanel() {
  const d = ui.auto.draft;
  const runs = S.runs.filter(r => r.automationId === ui.auto.editing);
  const done = runs.filter(r => ['done', 'stopped'].includes(r.status)).length;
  const failed = runs.filter(r => r.status === 'failed').length;
  const last = runs[runs.length - 1];
  const head = `<div class="mini-kpis">
    <div class="card"><div class="k-label muted small">Execuções</div><div class="k-value">${runs.length}</div></div>
    <div class="card"><div class="k-label muted small">Sucesso</div><div class="k-value">${done + failed ? Math.round((done / (done + failed)) * 100) + '%' : '—'}</div></div>
    <div class="card"><div class="k-label muted small">Blocos</div><div class="k-value">${d.steps.length}</div></div>
    <div class="card"><div class="k-label muted small">Última execução</div><div class="k-value" style="font-size:14px;padding-top:6px">${last ? ago(last.startedAt) : '—'}</div></div></div>`;

  if (ui.auto.sel === -1) {
    const t = d.trigger;
    return `${head}
      <div class="field"><label>Quando rodar</label>${sel('trigger.type', opt(Object.entries(TRIGGERS), t.type))}</div>
      ${t.type === 'stage_entered' ? `<div class="field"><label>Etapa</label>${sel('trigger.stageId', opt(S.stages.map(s => [s.id, s.name]), t.stageId))}</div>` : ''}
      ${t.type === 'tag_added' ? `<div class="field"><label>Tag (vazio = qualquer tag)</label>${inp('trigger.tag', t.tag)}</div>` : ''}
      ${t.type === 'lead_idle' ? `<div class="field"><label>Dias sem movimentação</label>${inp('trigger.days', t.days ?? 5, 'type="number" min="1"')}</div>
        <div class="field"><label>Só nesta etapa</label>${sel('trigger.stageId', '<option value="">Qualquer etapa aberta</option>' + opt(S.stages.filter(s => s.kind === 'open').map(s => [s.id, s.name]), t.stageId))}</div>` : ''}
      <div class="field"><label for="ed-desc">Descrição</label><textarea class="input" id="ed-desc" data-input="edDesc" placeholder="Para que serve esta automação">${esc(d.description || '')}</textarea></div>
      <div class="hint">${icon('sparkle', 16)}<span>Clique num bloco para configurar. Use o <b>+</b> entre os blocos para inserir anotações, condições, esperas e ações. Depois, simule o fluxo com um lead real na aba <b>Testar</b>.</span></div>`;
  }

  const s = d.steps[ui.auto.sel];
  if (!s) return '';
  let form = '';
  switch (s.type) {
    case 'add_interaction':
      form = `<div class="field"><label>Tipo</label>${sel('kind', opt([['nota', 'Anotação'], ['ligacao', 'Ligação'], ['mensagem', 'Mensagem'], ['reuniao', 'Reunião'], ['email', 'E-mail']], s.kind))}</div>
        <div class="field"><label>Texto</label><textarea class="input" data-input="edCampo" data-change="edCampoFim" data-key="text" id="ed-text">${esc(s.text || '')}</textarea>${varBtns('text')}</div>`;
      break;
    case 'notify':
      form = `<div class="field"><label>Aviso (aparece no sino de notificações)</label><textarea class="input" data-input="edCampo" data-change="edCampoFim" data-key="text" id="ed-text">${esc(s.text || '')}</textarea>${varBtns('text')}</div>`;
      break;
    case 'condition': {
      const f = s.field;
      let valueInput;
      if (f === 'origem') valueInput = sel('value', opt(S.origins.map(o => [o.id, o.name]), s.value));
      else if (f === 'etapa') valueInput = sel('value', opt(S.stages.map(x => [x.id, x.name]), s.value));
      else if (f === 'responsavel') valueInput = sel('value', opt(S.members.map(m => [m.id, m.name]), s.value));
      else if (f === 'temperatura') valueInput = sel('value', opt(Object.entries(TEMPS), s.value));
      else valueInput = inp('value', s.value, ['valor', 'score'].includes(f) ? 'type="number"' : '');
      form = `<div class="field"><label>Campo do lead</label>${sel('field', opt(Object.entries(FIELDS), f))}</div>
        <div class="field"><label>Regra</label>${sel('op', opt(opsFor(f), s.op))}</div>
        <div class="field"><label>Valor</label>${valueInput}</div>
        <div class="hint">${icon('branch', 16)}<span>Se a condição não for atendida, o fluxo para aqui e os blocos de baixo não rodam.</span></div>`;
      break;
    }
    case 'wait':
      form = `<div class="form-grid"><div class="field"><label>Quanto tempo</label>${inp('amount', s.amount, 'type="number" min="0"')}</div><div class="field"><label>Unidade</label>${sel('unit', opt(UNITS.map(u => [u, u]), s.unit))}</div></div>
        <div class="hint">${icon('clock', 16)}<span>O CRM precisa estar aberto (a janela do servidor) para a espera terminar. Se estiver fechado, o fluxo continua assim que você abrir.</span></div>`;
      break;
    case 'move_stage':
      form = `<div class="field"><label>Mover para</label>${sel('stageId', opt(S.stages.map(x => [x.id, x.name]), s.stageId))}</div>`;
      break;
    case 'assign_owner':
      form = `<div class="field"><label>Como distribuir</label>${sel('mode', opt([['rodizio', 'Rodízio (um para cada)'], ['fixo', 'Sempre para a mesma pessoa']], s.mode))}</div>
        ${s.mode === 'rodizio'
          ? `<div class="field"><label>Quem entra no rodízio (nenhum marcado = toda a equipe)</label>${S.members.map(m => `<label style="display:flex;gap:8px;align-items:center;font-weight:400;color:var(--fg)"><input type="checkbox" data-change="edMembro" data-id="${m.id}" ${(s.memberIds || []).includes(m.id) ? 'checked' : ''}> ${esc(m.name)}</label>`).join('')}</div>`
          : `<div class="field"><label>Membro</label>${sel('memberId', opt(S.members.map(m => [m.id, m.name]), s.memberId))}</div>`}`;
      break;
    case 'add_tag': case 'remove_tag':
      form = `<div class="field"><label>Tag</label>${inp('tag', s.tag, 'placeholder="ex.: vip"')}</div>`;
      break;
    case 'create_task':
      form = `<div class="field"><label>Tarefa</label>${inp('title', s.title, 'placeholder="ex.: Ligar para {primeiro_nome}"')}${varBtns('title')}</div>
        <div class="form-grid"><div class="field"><label>Prazo daqui a</label>${inp('amount', s.amount, 'type="number" min="0"')}</div><div class="field"><label>Unidade</label>${sel('unit', opt(UNITS.map(u => [u, u]), s.unit))}</div></div>
        <div class="field"><label>Para quem</label>${sel('owner', opt([['responsavel', 'Responsável pelo lead'], ...S.members.map(m => [m.id, m.name])], s.owner))}</div>`;
      break;
    case 'set_temperature':
      form = `<div class="field"><label>Temperatura</label>${sel('temperature', opt(Object.entries(TEMPS), s.temperature))}</div>`;
      break;
    case 'set_value':
      form = `<div class="field"><label>Valor (R$)</label>${inp('value', s.value, 'type="number" min="0"')}</div>`;
      break;
  }
  return `<div style="display:flex;gap:10px;align-items:center">${blkIc(s.type, true)}<h3 style="margin:0;flex:1">${esc(BLOCKS[s.type].name)}</h3>
      <button class="icon-btn" data-act="edMover" data-dir="-1" aria-label="Subir">${icon('arrowUp', 15)}</button>
      <button class="icon-btn" data-act="edMover" data-dir="1" aria-label="Descer">${icon('arrowDown', 15)}</button>
      <button class="icon-btn" data-act="edRemover" aria-label="Remover bloco">${icon('trash', 15)}</button></div>
    ${form}
    <button class="btn sm ghost" data-act="edSel" data-i="-1">${icon('arrowLeft', 14)} Voltar ao gatilho</button>`;
}

function testPanel() {
  const leads = [...S.leads].sort((a, b) => a.name.localeCompare(b.name));
  return `<p class="muted">Escolha um lead para ver o que esta automação faria com ele. É só uma simulação: nada é alterado.</p>
    <div class="field"><label for="ed-test-lead">Lead</label><select class="select" id="ed-test-lead" data-change="edTesteLead">${options(leads, ui.auto.testLeadId, { empty: 'Escolha um lead' })}</select></div>
    <button class="btn primary" data-act="edTestar" ${ui.auto.testLeadId ? '' : 'disabled'}>${icon('flask', 15)} Simular agora</button>
    ${ui.auto.testLog ? `<div class="card" style="padding:14px"><div class="log">
      <div class="log-row">${icon('play', 13)}<span>${esc(triggerText(ui.auto.draft.trigger))}</span></div>
      ${ui.auto.testLog.map(r => `<div class="log-row ${r.ok ? '' : 'fail'}">${icon(r.ok ? 'check' : 'alert', 13)}<span>${esc(r.msg)}</span></div>`).join('') || '<span class="muted">Sem blocos para rodar.</span>'}
    </div></div>` : ''}`;
}

const RUN_STATUS = { done: ['Concluída', 'ok'], stopped: ['Parou na condição', ''], failed: ['Falhou', 'late'], waiting: ['Aguardando', 'warn'], running: ['Rodando', 'warn'], cancelled: ['Cancelada', ''] };
function runsPanel() {
  const runs = S.runs.filter(r => r.automationId === ui.auto.editing).reverse().slice(0, 80);
  if (!runs.length) return empty('Ainda não rodou', 'Quando um lead disparar esta automação, cada execução aparece aqui.');
  return runs.map(r => {
    const [label, cls] = RUN_STATUS[r.status] || [r.status, ''];
    const l = S.leads.find(x => x.id === r.leadId);
    return `<div class="run"><div class="head"><span class="pill ${cls}">${label}</span><span class="grow">${l ? esc(l.name) : 'lead excluído'}</span><span class="muted small">${dateTime(r.startedAt)}</span></div>
      ${r.status === 'waiting' ? `<div class="muted small">Continua em ${dateTime(r.resumeAt)} · <button class="link" data-act="edCancelarRun" data-id="${r.id}">cancelar</button></div>` : ''}
      <details><summary>Ver passos (${r.log.length})</summary><div class="log" style="margin-top:6px">${r.log.map(x => `<div class="log-row ${x.ok ? '' : 'fail'}">${icon(x.ok ? 'check' : 'alert', 12)}<span>${esc(x.msg)}</span></div>`).join('')}</div></details></div>`;
  }).join('');
}

// ---------- ações ----------
const draft = () => ui.auto.draft;
const current = () => (ui.auto.sel === -1 ? null : draft().steps[ui.auto.sel]);
function setKey(key, value) {
  if (key.startsWith('trigger.')) {
    const k = key.slice(8);
    draft().trigger[k] = k === 'days' ? Number(value) || 1 : value;
    if (k === 'type') draft().trigger = { type: value, ...(value === 'stage_entered' ? { stageId: S.stages[0]?.id } : value === 'lead_idle' ? { days: 5 } : {}) };
  } else {
    const s = current();
    if (!s) return;
    s[key] = ['amount', 'value'].includes(key) && s.type !== 'condition' ? Number(value) || 0 : value;
    if (s.type === 'condition' && key === 'field') {
      s.op = opsFor(value)[0][0];
      s.value = value === 'origem' ? S.origins[0]?.id : value === 'etapa' ? S.stages[0]?.id : value === 'responsavel' ? S.members[0]?.id : value === 'temperatura' ? 'quente' : '';
    }
  }
  ui.auto.dirty = true;
}
function leaveEditor() { ui.auto.draft = null; ui.auto.editing = null; location.hash = '#automacoes'; }

actions({
  click: {
    autoAba: el => { ui.auto.tab = el.dataset.tab; rerender(); },
    autoAbrir: (el, e) => { if (e.target.closest('.switch')) return; location.hash = '#automacoes/' + el.dataset.id; },
    autoLiga: async (el, e) => {
      e.stopPropagation();
      const a = S.automations.find(x => x.id === el.dataset.id);
      await api('PATCH', `/api/automations/${a.id}`, { active: !a.active });
      toast(a.active ? 'Automação desativada' : 'Automação ativada');
    },
    autoNova: el => {
      const t = el.dataset.trigger || 'lead_created';
      const trigger = t.startsWith('stage:') ? { type: 'stage_entered', stageId: t.slice(6) } : t === 'lead_idle' ? { type: 'lead_idle', days: 5 } : { type: t };
      ui.auto.pendingDraft = { name: 'Nova automação', description: '', active: false, trigger, steps: [] };
      ui.auto.editing = null;
      location.hash = '#automacoes/nova';
    },
    autoModelo: async el => {
      const res = await api('POST', '/api/automations', { templateKey: el.dataset.key });
      toast('Modelo adicionado. Revise e ative quando quiser.');
      location.hash = '#automacoes/' + res.id;
    },
    edVoltar: async () => {
      if (ui.auto.dirty && !(await confirmBox('Sair sem salvar as alterações?', { ok: 'Sair sem salvar' }))) return;
      leaveEditor();
    },
    edFundo: (el, e) => { if (e.target === el && ui.auto.menuAt !== null) { ui.auto.menuAt = null; rerender(); } },
    edSel: el => { ui.auto.sel = Number(el.dataset.i); ui.auto.menuAt = null; ui.auto.sideTab = 'configurar'; rerender(); },
    edMenu: el => { const at = Number(el.dataset.at); ui.auto.menuAt = ui.auto.menuAt === at ? null : at; rerender(); },
    edAdd: el => {
      const at = Number(el.dataset.at);
      const step = { id: 's_' + Math.random().toString(36).slice(2, 10), type: el.dataset.type, ...DEFAULTS[el.dataset.type]() };
      draft().steps.splice(at + 1, 0, step);
      ui.auto.sel = at + 1; ui.auto.menuAt = null; ui.auto.dirty = true; ui.auto.sideTab = 'configurar';
      rerender();
      setTimeout(() => document.querySelector('.ed-side textarea, .ed-side input.input')?.focus(), 0);
    },
    edMover: el => {
      const i = ui.auto.sel, j = i + Number(el.dataset.dir), st = draft().steps;
      if (j < 0 || j >= st.length) return;
      [st[i], st[j]] = [st[j], st[i]];
      ui.auto.sel = j; ui.auto.dirty = true; rerender();
    },
    edRemover: () => { draft().steps.splice(ui.auto.sel, 1); ui.auto.sel = -1; ui.auto.dirty = true; rerender(); },
    edLiga: () => { draft().active = !draft().active; ui.auto.dirty = true; rerender(); },
    edAba: el => { ui.auto.sideTab = el.dataset.tab; rerender(); },
    edVar: el => {
      const field = document.getElementById('ed-' + el.dataset.key);
      const s = current();
      const pos = field.selectionStart ?? field.value.length;
      field.value = field.value.slice(0, pos) + `{${el.dataset.v}}` + field.value.slice(field.selectionEnd ?? pos);
      s[el.dataset.key] = field.value;
      ui.auto.dirty = true;
      rerender();
    },
    edSalvar: async () => {
      const d = draft();
      const bad = d.steps.findIndex(invalid);
      if (bad >= 0) { ui.auto.sel = bad; rerender(); return toast('Complete o bloco marcado em vermelho antes de salvar', 'erro'); }
      if (ui.auto.editing === 'nova') {
        const res = await api('POST', '/api/automations', d);
        ui.auto.editing = res.id;
        ui.auto.draft = structuredClone(S.automations.find(a => a.id === res.id));
        history.replaceState(null, '', '#automacoes/' + res.id);
      } else {
        await api('PUT', `/api/automations/${ui.auto.editing}`, d);
        ui.auto.draft = structuredClone(S.automations.find(a => a.id === ui.auto.editing));
      }
      ui.auto.dirty = false;
      toast('Automação salva');
      rerender();
    },
    edExcluir: async () => {
      if (!(await confirmBox(`Excluir a automação "${draft().name}"? O histórico de execuções dela também some.`, { ok: 'Excluir' }))) return;
      const id = ui.auto.editing;
      leaveEditor();
      await api('DELETE', `/api/automations/${id}`);
      toast('Automação excluída');
    },
    edTestar: async () => {
      const res = await api('POST', `/api/automations/${ui.auto.editing}/simulate`, { leadId: ui.auto.testLeadId, draft: draft() });
      ui.auto.testLog = res.log;
      rerender();
    },
    edCancelarRun: el => api('POST', `/api/runs/${el.dataset.id}/cancel`),
  },
  input: {
    edNome: el => { draft().name = el.value; ui.auto.dirty = true; },
    edDesc: el => { draft().description = el.value; ui.auto.dirty = true; },
    edCampo: el => setKey(el.dataset.key, el.value),
  },
  change: {
    edCampoFim: () => rerender(),
    edCampoSel: el => { setKey(el.dataset.key, el.value); rerender(); },
    edMembro: el => {
      const s = current();
      s.memberIds = (s.memberIds || []).filter(id => id !== el.dataset.id);
      if (el.checked) s.memberIds.push(el.dataset.id);
      ui.auto.dirty = true; rerender();
    },
    edTesteLead: el => { ui.auto.testLeadId = el.value; ui.auto.testLog = null; rerender(); },
  },
});

addEventListener('beforeunload', e => { if (ui.auto.dirty) e.preventDefault(); });
