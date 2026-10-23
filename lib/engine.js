// Operações de lead + motor das automações internas.
// Tudo que muda um lead passa por aqui para que as automações disparem do mesmo jeito,
// seja a mudança feita por uma pessoa ou por outra automação.
import { db, uid, now, save, logHistory, notify, byId } from './db.js';

const MAX_DEPTH = 5;
const MAX_RUNS = 3000;
const UNIT_MS = { minutos: 60e3, horas: 3600e3, dias: 86400e3 };

// ---------- textos ----------
const money = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
const stageName = id => byId('stages', id)?.name || '—';
const memberName = id => byId('members', id)?.name || 'sem responsável';
const originName = id => byId('origins', id)?.name || 'sem origem';
const TEMP = { frio: 'Frio', morno: 'Morno', quente: 'Quente' };

export function render(text, lead) {
  const vars = {
    nome: lead.name, primeiro_nome: (lead.name || '').split(' ')[0], empresa: lead.company || '',
    responsavel: memberName(lead.ownerId), etapa: stageName(lead.stageId), valor: money(lead.value),
    origem: originName(lead.originId), cidade: lead.city || '', interesse: lead.interest || '',
  };
  return String(text || '').replace(/\{(\w+)\}/g, (m, k) => (k in vars ? vars[k] : m));
}

// ---------- operações de lead ----------
export function touch(lead) {
  lead.updatedAt = lead.lastActivityAt = now();
}

export function createLead(data, ctx = {}) {
  db.counters.lead++;
  const stage = byId('stages', data.stageId) || db.stages[0];
  const lead = {
    id: uid('l_'), code: db.counters.lead, name: '', company: '', phone: '', email: '', city: '',
    document: '', birthday: '', interest: '', notes: '', value: 0, originId: null, ownerId: null,
    temperature: 'morno', score: 50, tags: [],
    ...data,
    stageId: stage?.id, createdAt: now(), updatedAt: now(), stageChangedAt: now(), lastActivityAt: now(),
  };
  lead.value = Number(lead.value) || 0;
  db.leads.push(lead);
  logHistory(lead.id, 'Lead criado em ' + stageName(lead.stageId), 'create');
  fire('lead_created', lead, {}, ctx);
  fire('stage_entered', lead, { stageId: lead.stageId }, ctx);
  return lead;
}

export function moveLead(lead, stageId, ctx = {}) {
  if (!byId('stages', stageId) || lead.stageId === stageId) return false;
  const from = lead.stageId;
  lead.stageId = stageId;
  lead.stageChangedAt = now();
  lead.updatedAt = now();
  const kind = byId('stages', stageId).kind;
  if (kind === 'won') lead.wonAt = now();
  if (kind === 'lost') lead.lostAt = now();
  logHistory(lead.id, `Movido de ${stageName(from)} para ${stageName(stageId)}${ctx.auto ? ` (automação "${ctx.auto}")` : ''}`, 'move');
  fire('stage_entered', lead, { stageId }, ctx);
  return true;
}

export function addTag(lead, tag, ctx = {}) {
  tag = String(tag || '').trim().toLowerCase();
  if (!tag || lead.tags.includes(tag)) return false;
  lead.tags.push(tag);
  logHistory(lead.id, `Tag "${tag}" adicionada${ctx.auto ? ` (automação "${ctx.auto}")` : ''}`, 'tag');
  fire('tag_added', lead, { tag }, ctx);
  return true;
}

export function removeTag(lead, tag, ctx = {}) {
  tag = String(tag || '').trim().toLowerCase();
  if (!lead.tags.includes(tag)) return false;
  lead.tags = lead.tags.filter(t => t !== tag);
  logHistory(lead.id, `Tag "${tag}" removida${ctx.auto ? ` (automação "${ctx.auto}")` : ''}`, 'tag');
  return true;
}

export function setOwner(lead, ownerId, ctx = {}) {
  if (lead.ownerId === ownerId) return false;
  lead.ownerId = ownerId;
  logHistory(lead.id, `Responsável: ${memberName(ownerId)}${ctx.auto ? ` (automação "${ctx.auto}")` : ''}`, 'owner');
  return true;
}

// ---------- disparo ----------
function matches(trigger, event, data) {
  if (trigger.type !== event) return false;
  if (event === 'stage_entered') return !trigger.stageId || trigger.stageId === data.stageId;
  if (event === 'tag_added') return !trigger.tag || trigger.tag.toLowerCase() === data.tag;
  return true;
}

export function fire(event, lead, data = {}, ctx = {}) {
  const depth = ctx.depth || 0;
  if (depth >= MAX_DEPTH) return;
  const chain = ctx.chain || [];
  for (const auto of db.automations) {
    if (!auto.active || chain.includes(auto.id) || !matches(auto.trigger, event, data)) continue;
    startRun(auto, lead, { depth: depth + 1, chain: [...chain, auto.id] });
  }
}

function startRun(auto, lead, ctx) {
  const run = {
    id: uid('r_'), automationId: auto.id, leadId: lead.id, status: 'running', stepIndex: 0,
    log: [], actions: 0, startedAt: now(), finishedAt: null, resumeAt: null, ctx,
  };
  db.runs.push(run);
  if (db.runs.length > MAX_RUNS) db.runs = db.runs.slice(-MAX_RUNS);
  continueRun(run);
  return run;
}

function continueRun(run) {
  const auto = byId('automations', run.automationId);
  const lead = byId('leads', run.leadId);
  if (!auto || !lead) return finish(run, 'failed', 'Automação ou lead não existe mais');
  run.status = 'running';
  while (run.stepIndex < auto.steps.length) {
    const step = auto.steps[run.stepIndex];
    let r;
    try {
      r = execStep(step, lead, run, auto);
    } catch (e) {
      r = { ok: false, msg: 'Erro: ' + e.message };
    }
    run.log.push({ at: now(), type: step.type, ok: r.ok, msg: r.msg });
    if (!r.ok) return finish(run, 'failed');
    run.stepIndex++;
    if (r.stop) return finish(run, 'stopped');
    if (r.waitUntil) {
      run.status = 'waiting';
      run.resumeAt = r.waitUntil;
      save();
      return;
    }
    if (r.action) run.actions++;
  }
  finish(run, 'done');
}

function finish(run, status, msg) {
  if (msg) run.log.push({ at: now(), type: 'fim', ok: status !== 'failed', msg });
  run.status = status;
  run.finishedAt = now();
  run.resumeAt = null;
  save();
}

// ---------- blocos ----------
function checkCondition(step, lead) {
  const v = String(step.value ?? '').toLowerCase();
  let actual;
  switch (step.field) {
    case 'etapa': actual = lead.stageId; break;
    case 'origem': actual = lead.originId; break;
    case 'responsavel': actual = lead.ownerId; break;
    case 'temperatura': actual = lead.temperature; break;
    case 'valor': actual = Number(lead.value) || 0; break;
    case 'score': actual = Number(lead.score) || 0; break;
    case 'tag': actual = lead.tags; break;
    case 'cidade': actual = lead.city || ''; break;
    case 'interesse': actual = lead.interest || ''; break;
    default: actual = '';
  }
  if (Array.isArray(actual)) {
    const has = actual.includes(v);
    return step.op === 'nao_contem' || step.op === 'diferente' ? !has : has;
  }
  if (typeof actual === 'number') {
    const n = Number(String(step.value).replace(/\./g, '').replace(',', '.')) || 0;
    return { igual: actual === n, diferente: actual !== n, maior: actual > n, menor: actual < n }[step.op] ?? false;
  }
  const a = String(actual ?? '').toLowerCase();
  return {
    igual: a === v, diferente: a !== v, contem: a.includes(v), nao_contem: !a.includes(v),
  }[step.op] ?? false;
}

export function describeCondition(step) {
  const names = { etapa: stageName, origem: originName, responsavel: memberName, temperatura: t => TEMP[t] || t };
  const val = names[step.field] ? names[step.field](step.value) : step.value;
  const ops = { igual: 'é', diferente: 'não é', maior: 'maior que', menor: 'menor que', contem: 'contém', nao_contem: 'não contém' };
  return `${step.field} ${ops[step.op] || step.op} ${val}`;
}

function execStep(step, lead, run, auto, dry = false) {
  const ctx = { ...run.ctx, auto: auto.name };
  switch (step.type) {
    case 'wait': {
      const ms = (Number(step.amount) || 0) * (UNIT_MS[step.unit] || UNIT_MS.horas);
      if (dry) return { ok: true, msg: `Esperaria ${step.amount} ${step.unit}` };
      return { ok: true, msg: `Aguardando ${step.amount} ${step.unit}`, waitUntil: new Date(Date.now() + ms).toISOString() };
    }
    case 'condition': {
      const pass = checkCondition(step, lead);
      return { ok: true, msg: `Condição "${describeCondition(step)}": ${pass ? 'sim, continua' : 'não, fluxo parado'}`, stop: !pass };
    }
    case 'move_stage': {
      if (dry) return { ok: true, msg: `Moveria para ${stageName(step.stageId)}` };
      const moved = moveLead(lead, step.stageId, ctx);
      return { ok: true, action: moved, msg: moved ? `Movido para ${stageName(step.stageId)}` : `Já estava em ${stageName(step.stageId)}` };
    }
    case 'assign_owner': {
      let target = step.memberId;
      if (step.mode === 'rodizio') {
        const pool = (step.memberIds?.length ? step.memberIds : db.members.map(m => m.id)).filter(id => byId('members', id));
        if (!pool.length) return { ok: false, msg: 'Nenhum membro para o rodízio' };
        step.rrNext = ((step.rrNext ?? -1) + 1) % pool.length;
        target = pool[step.rrNext];
      }
      if (!byId('members', target)) return { ok: false, msg: 'Membro não encontrado' };
      if (dry) return { ok: true, msg: `Passaria para ${memberName(target)}` };
      setOwner(lead, target, ctx);
      return { ok: true, action: true, msg: `Responsável: ${memberName(target)}` };
    }
    case 'add_tag': {
      if (dry) return { ok: true, msg: `Adicionaria a tag "${step.tag}"` };
      return { ok: true, action: addTag(lead, step.tag, ctx), msg: `Tag "${step.tag}"` };
    }
    case 'remove_tag': {
      if (dry) return { ok: true, msg: `Removeria a tag "${step.tag}"` };
      return { ok: true, action: removeTag(lead, step.tag, ctx), msg: `Tag "${step.tag}" removida` };
    }
    case 'create_task': {
      const title = render(step.title, lead);
      const ms = (Number(step.amount) || 0) * (UNIT_MS[step.unit] || UNIT_MS.horas);
      const ownerId = step.owner === 'responsavel' || !step.owner ? lead.ownerId : step.owner;
      if (dry) return { ok: true, msg: `Criaria a tarefa "${title}" para ${memberName(ownerId)}` };
      db.tasks.push({ id: uid('t_'), leadId: lead.id, title, dueAt: new Date(Date.now() + ms).toISOString(), ownerId, done: false, createdAt: now(), auto: auto.id });
      logHistory(lead.id, `Tarefa criada: ${title} (automação "${auto.name}")`, 'task');
      return { ok: true, action: true, msg: `Tarefa "${title}"` };
    }
    case 'add_interaction': {
      const text = render(step.text, lead);
      if (dry) return { ok: true, msg: `Registraria: "${text}"` };
      db.interactions.push({ id: uid('i_'), leadId: lead.id, kind: step.kind || 'nota', text, authorId: null, at: now(), auto: auto.id });
      return { ok: true, action: true, msg: 'Anotação registrada' };
    }
    case 'set_temperature': {
      if (dry) return { ok: true, msg: `Mudaria a temperatura para ${TEMP[step.temperature]}` };
      lead.temperature = step.temperature;
      lead.score = { frio: 25, morno: 55, quente: 85 }[step.temperature] ?? lead.score;
      logHistory(lead.id, `Temperatura: ${TEMP[step.temperature]} (automação "${auto.name}")`, 'temp');
      return { ok: true, action: true, msg: `Temperatura ${TEMP[step.temperature]}` };
    }
    case 'set_value': {
      const v = Number(step.value) || 0;
      if (dry) return { ok: true, msg: `Mudaria o valor para ${money(v)}` };
      lead.value = v;
      logHistory(lead.id, `Valor: ${money(v)} (automação "${auto.name}")`, 'value');
      return { ok: true, action: true, msg: `Valor ${money(v)}` };
    }
    case 'notify': {
      const text = render(step.text, lead);
      if (dry) return { ok: true, msg: `Avisaria a equipe: "${text}"` };
      notify(text, lead.id);
      return { ok: true, action: true, msg: 'Equipe avisada' };
    }
    default:
      return { ok: false, msg: `Bloco desconhecido: ${step.type}` };
  }
}

// Simulação (aba "Testar"): avalia o fluxo contra um lead real sem mudar nada.
export function simulate(auto, lead) {
  const log = [];
  const fake = { ctx: {} };
  const copy = structuredClone(lead);
  for (const step of auto.steps) {
    const r = execStep(structuredClone(step), copy, fake, auto, true);
    log.push({ type: step.type, ok: r.ok, msg: r.msg });
    if (!r.ok || r.stop) break;
  }
  return log;
}

// ---------- relógio: esperas, leads parados e tarefas atrasadas ----------
export function tick() {
  const t = Date.now();
  for (const run of db.runs) {
    if (run.status === 'waiting' && run.resumeAt && Date.parse(run.resumeAt) <= t) continueRun(run);
  }
  for (const auto of db.automations) {
    if (!auto.active || auto.trigger.type !== 'lead_idle') continue;
    const days = Number(auto.trigger.days) || 5;
    for (const lead of db.leads) {
      const stage = byId('stages', lead.stageId);
      if (!stage || stage.kind !== 'open') continue;
      if (auto.trigger.stageId && auto.trigger.stageId !== lead.stageId) continue;
      const last = lead.lastActivityAt || lead.stageChangedAt || lead.updatedAt;
      if (t - Date.parse(last) < days * 86400e3) continue;
      lead.idleFired ||= {};
      if (lead.idleFired[auto.id] === last) continue;
      lead.idleFired[auto.id] = last;
      startRun(auto, lead, { depth: 1, chain: [auto.id] });
    }
  }
  for (const task of db.tasks) {
    if (task.done || task.overdueNotified || !task.dueAt || Date.parse(task.dueAt) > t) continue;
    task.overdueNotified = true;
    const lead = byId('leads', task.leadId);
    notify(`Tarefa atrasada: ${task.title}${lead ? ' · ' + lead.name : ''}`, task.leadId);
    save();
  }
}

// Números da tela de Automações
export function automationStats() {
  const month = new Date().toISOString().slice(0, 7);
  const runs = db.runs.filter(r => r.startedAt.startsWith(month));
  const finished = runs.filter(r => ['done', 'stopped', 'failed'].includes(r.status));
  const failed = finished.filter(r => r.status === 'failed').length;
  const actions = db.runs.reduce((s, r) => s + (r.actions || 0), 0);
  const per = {};
  for (const r of db.runs) {
    per[r.automationId] ||= { runs: 0, last: null };
    per[r.automationId].runs++;
    per[r.automationId].last = r.startedAt;
  }
  return {
    active: db.automations.filter(a => a.active).length,
    total: db.automations.length,
    monthRuns: runs.length,
    successRate: finished.length ? Math.round(((finished.length - failed) / finished.length) * 100) : null,
    savedMinutes: Math.round(actions * (db.settings.minutesPerAction || 2.5)),
    per,
  };
}
