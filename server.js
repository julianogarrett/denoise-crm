// deNoise CRM: servidor local, sem dependências externas.
// Uso: node server.js            -> só neste computador (http://localhost:4321)
//      node server.js --rede     -> também para outros computadores da mesma rede
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { exec } from 'node:child_process';
import { db, load, save, saveNow, replaceAll, uid, now, logHistory, byId, FILES_DIR } from './lib/db.js';
import { createLead, moveLead, addTag, removeTag, setOwner, touch, simulate, tick, automationStats } from './lib/engine.js';
import { TEMPLATES } from './lib/templates.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(ROOT, 'public');
const PORT = Number(process.env.PORT) || 4321;
const ON_NETWORK = process.argv.includes('--rede') || process.env.CRM_REDE === '1';
const HOST = ON_NETWORK ? '0.0.0.0' : '127.0.0.1';
const OPEN = process.argv.includes('--abrir');

process.chdir(ROOT);
load();

const MIME = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon', '.json': 'application/json',
};

class HttpError extends Error {
  constructor(status, msg) { super(msg); this.status = status; }
}
const need = (cond, msg, status = 400) => { if (!cond) throw new HttpError(status, msg); };
const find = (list, id) => { const x = byId(list, id); need(x, 'Não encontrado', 404); return x; };

// Campos que a tela pode editar em cada tipo
const LEAD_FIELDS = ['name', 'company', 'phone', 'email', 'city', 'document', 'birthday', 'interest', 'notes', 'value', 'originId', 'temperature', 'score'];
const pick = (obj, keys) => Object.fromEntries(keys.filter(k => k in obj).map(k => [k, obj[k]]));

function state() {
  return {
    ...db,
    runs: db.runs.slice(-400),
    templates: TEMPLATES,
    stats: automationStats(),
    network: ON_NETWORK ? addresses() : null,
  };
}

function addresses() {
  return Object.values(os.networkInterfaces()).flat()
    .filter(i => i && i.family === 'IPv4' && !i.internal).map(i => `http://${i.address}:${PORT}`);
}

// ---------- rotas ----------
const routes = [];
const route = (method, pattern, fn) => routes.push({ method, re: new RegExp('^' + pattern.replace(/:(\w+)/g, '(?<$1>[^/]+)') + '$'), fn });

route('GET', '/api/state', () => state());

// Leads
route('POST', '/api/leads', ({ body }) => {
  need(String(body.name || '').trim(), 'Informe o nome do lead');
  const lead = createLead({
    ...pick(body, LEAD_FIELDS), stageId: body.stageId,
    ownerId: body.ownerId || null, tags: (body.tags || []).map(t => String(t).toLowerCase()),
  });
  return { id: lead.id };
});
route('PATCH', '/api/leads/:id', ({ params, body }) => {
  const lead = find('leads', params.id);
  const changes = pick(body, LEAD_FIELDS);
  if ('value' in changes) changes.value = Number(changes.value) || 0;
  if ('score' in changes) changes.score = Math.max(0, Math.min(100, Number(changes.score) || 0));
  if ('temperature' in changes && changes.temperature !== lead.temperature) logHistory(lead.id, `Temperatura: ${changes.temperature}`, 'temp');
  if ('value' in changes && changes.value !== lead.value) logHistory(lead.id, `Valor alterado para R$ ${changes.value.toLocaleString('pt-BR')}`, 'value');
  Object.assign(lead, changes);
  if ('ownerId' in body) setOwner(lead, body.ownerId || null);
  if ('stageId' in body) moveLead(lead, body.stageId);
  touch(lead);
});
route('DELETE', '/api/leads/:id', ({ params }) => {
  const lead = find('leads', params.id);
  for (const f of db.files.filter(f => f.leadId === lead.id)) fs.rmSync(path.join(FILES_DIR, f.storedAs), { force: true });
  db.leads = db.leads.filter(l => l !== lead);
  for (const k of ['interactions', 'history', 'tasks', 'files', 'runs', 'notifications']) db[k] = db[k].filter(x => x.leadId !== lead.id);
});
route('POST', '/api/leads/:id/tags', ({ params, body }) => { const l = find('leads', params.id); addTag(l, body.tag); touch(l); });
route('DELETE', '/api/leads/:id/tags/:tag', ({ params }) => { const l = find('leads', params.id); removeTag(l, decodeURIComponent(params.tag)); touch(l); });

// Interações (anotações, ligações, reuniões)
route('POST', '/api/interactions', ({ body }) => {
  const lead = find('leads', body.leadId);
  need(String(body.text || '').trim(), 'Escreva a anotação');
  db.interactions.push({ id: uid('i_'), leadId: lead.id, kind: body.kind || 'nota', text: body.text.trim(), authorId: body.authorId || null, at: now() });
  touch(lead);
});
route('DELETE', '/api/interactions/:id', ({ params }) => { db.interactions = db.interactions.filter(i => i.id !== params.id); });

// Tarefas
route('POST', '/api/tasks', ({ body }) => {
  need(String(body.title || '').trim(), 'Escreva a tarefa');
  const lead = body.leadId ? find('leads', body.leadId) : null;
  db.tasks.push({ id: uid('t_'), leadId: lead?.id || null, title: body.title.trim(), dueAt: body.dueAt || null, ownerId: body.ownerId || lead?.ownerId || null, done: false, createdAt: now() });
  if (lead) { logHistory(lead.id, `Tarefa criada: ${body.title.trim()}`, 'task'); touch(lead); }
});
route('PATCH', '/api/tasks/:id', ({ params, body }) => {
  const task = find('tasks', params.id);
  Object.assign(task, pick(body, ['title', 'dueAt', 'ownerId']));
  if ('dueAt' in body) task.overdueNotified = false;
  if ('done' in body && body.done !== task.done) {
    task.done = !!body.done;
    task.doneAt = task.done ? now() : null;
    const lead = byId('leads', task.leadId);
    if (lead) { logHistory(lead.id, `Tarefa ${task.done ? 'concluída' : 'reaberta'}: ${task.title}`, 'task'); touch(lead); }
  }
});
route('DELETE', '/api/tasks/:id', ({ params }) => { db.tasks = db.tasks.filter(t => t.id !== params.id); });

// Arquivos (guardados em dados/arquivos)
route('POST', '/api/leads/:id/files', ({ params, body }) => {
  const lead = find('leads', params.id);
  need(body.name && body.data, 'Arquivo vazio');
  const buf = Buffer.from(body.data, 'base64');
  need(buf.length <= 25 * 1024 * 1024, 'O arquivo passa de 25 MB');
  const id = uid('f_');
  const storedAs = id + path.extname(body.name).toLowerCase().replace(/[^.\w]/g, '');
  fs.writeFileSync(path.join(FILES_DIR, storedAs), buf);
  db.files.push({ id, leadId: lead.id, name: body.name, mime: body.mime || 'application/octet-stream', size: buf.length, storedAs, at: now() });
  logHistory(lead.id, `Arquivo anexado: ${body.name}`, 'file');
  touch(lead);
});
route('DELETE', '/api/files/:id', ({ params }) => {
  const f = find('files', params.id);
  fs.rmSync(path.join(FILES_DIR, f.storedAs), { force: true });
  db.files = db.files.filter(x => x !== f);
});

// Automações
const cleanAutomation = b => ({
  name: String(b.name || 'Nova automação').slice(0, 120),
  description: String(b.description || ''),
  active: !!b.active,
  trigger: b.trigger || { type: 'lead_created' },
  steps: (b.steps || []).map(s => ({ ...s, id: s.id || uid('s_') })),
});
route('POST', '/api/automations', ({ body }) => {
  let data = cleanAutomation(body);
  if (body.templateKey) {
    const t = TEMPLATES.find(t => t.key === body.templateKey);
    need(t, 'Modelo não encontrado');
    const fix = id => (id && !byId('stages', id) ? db.stages[0]?.id : id);
    data = cleanAutomation({
      name: t.name, description: t.description, active: false,
      trigger: { ...t.trigger, stageId: fix(t.trigger.stageId) },
      steps: t.steps.map(s => ({ ...structuredClone(s), stageId: fix(s.stageId), value: s.field === 'etapa' ? fix(s.value) : s.value })),
    });
  }
  const a = { id: uid('a_'), ...data, createdAt: now() };
  db.automations.push(a);
  return { id: a.id };
});
route('PUT', '/api/automations/:id', ({ params, body }) => { Object.assign(find('automations', params.id), cleanAutomation(body)); });
route('PATCH', '/api/automations/:id', ({ params, body }) => { const a = find('automations', params.id); if ('active' in body) a.active = !!body.active; });
route('DELETE', '/api/automations/:id', ({ params }) => {
  db.automations = db.automations.filter(a => a.id !== params.id);
  db.runs = db.runs.filter(r => r.automationId !== params.id);
});
route('POST', '/api/automations/:id/simulate', ({ params, body }) => {
  const auto = body.draft ? { ...cleanAutomation(body.draft), id: params.id } : find('automations', params.id);
  return { log: simulate(auto, find('leads', body.leadId)), noSave: true };
});
route('POST', '/api/runs/:id/cancel', ({ params }) => {
  const run = find('runs', params.id);
  if (run.status === 'waiting') { run.status = 'cancelled'; run.finishedAt = now(); run.log.push({ at: now(), type: 'fim', ok: true, msg: 'Cancelada manualmente' }); }
});

// Notificações
route('POST', '/api/notifications/read', () => { for (const n of db.notifications) n.read = true; });
route('DELETE', '/api/notifications', () => { db.notifications = []; });

// Configurações
route('PATCH', '/api/settings', ({ body }) => { Object.assign(db.settings, pick(body, ['workspaceName', 'brandColor', 'minutesPerAction'])); });
route('PUT', '/api/members', ({ body }) => {
  need(Array.isArray(body.members) && body.members.length, 'Mantenha pelo menos um membro');
  db.members = body.members.map(m => ({ id: m.id || uid('m_'), name: String(m.name || 'Sem nome'), color: m.color || '#64748b', role: m.role || '' }));
  const ids = new Set(db.members.map(m => m.id));
  for (const l of db.leads) if (l.ownerId && !ids.has(l.ownerId)) l.ownerId = null;
  for (const t of db.tasks) if (t.ownerId && !ids.has(t.ownerId)) t.ownerId = null;
});
route('PUT', '/api/stages', ({ body }) => {
  need(Array.isArray(body.stages) && body.stages.some(s => s.kind === 'open'), 'Mantenha pelo menos uma etapa aberta');
  db.stages = body.stages.map(s => ({ id: s.id || uid('st_'), name: String(s.name || 'Etapa'), color: s.color || '#64748b', kind: ['open', 'won', 'lost'].includes(s.kind) ? s.kind : 'open' }));
  const ids = new Set(db.stages.map(s => s.id));
  const first = db.stages.find(s => s.kind === 'open').id;
  for (const l of db.leads) if (!ids.has(l.stageId)) { l.stageId = first; logHistory(l.id, 'Etapa removida; lead voltou para ' + byId('stages', first).name, 'move'); }
});
route('PUT', '/api/origins', ({ body }) => {
  db.origins = (body.origins || []).map(o => ({ id: o.id || uid('or_'), name: String(o.name || 'Origem'), color: o.color || '#64748b' }));
  const ids = new Set(db.origins.map(o => o.id));
  for (const l of db.leads) if (l.originId && !ids.has(l.originId)) l.originId = null;
});
route('POST', '/api/samples/clear', () => {
  const sampleLeads = new Set(db.leads.filter(l => l.sample).map(l => l.id));
  db.leads = db.leads.filter(l => !sampleLeads.has(l.id));
  for (const k of ['interactions', 'history', 'tasks', 'files', 'runs', 'notifications']) db[k] = db[k].filter(x => !sampleLeads.has(x.leadId) && !x.sample);
  const sampleMembers = new Set(db.members.filter(m => m.sample).map(m => m.id));
  if (db.members.length > sampleMembers.size) db.members = db.members.filter(m => !sampleMembers.has(m.id));
  else db.members.forEach(m => delete m.sample);
});
route('POST', '/api/restore', ({ body }) => {
  need(body && Array.isArray(body.leads) && Array.isArray(body.stages), 'Esse arquivo não é um backup do CRM');
  replaceAll(body);
});

// ---------- servidor ----------
function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on('data', c => {
      size += c.length;
      if (size > 40 * 1024 * 1024) { reject(new HttpError(413, 'Envio grande demais')); req.destroy(); }
      chunks.push(c);
    });
    req.on('end', () => {
      if (!chunks.length) return resolve({});
      try { resolve(JSON.parse(Buffer.concat(chunks).toString('utf8'))); } catch { reject(new HttpError(400, 'JSON inválido')); }
    });
  });
}

const send = (res, status, data, type = 'application/json; charset=utf-8') => {
  res.writeHead(status, { 'Content-Type': type, 'Cache-Control': 'no-store' });
  res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
};

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const p = decodeURIComponent(url.pathname);
  try {
    if (p === '/api/backup') {
      res.writeHead(200, { 'Content-Type': 'application/json', 'Content-Disposition': `attachment; filename="crm-backup-${new Date().toISOString().slice(0, 10)}.json"` });
      return res.end(JSON.stringify(db, null, 1));
    }
    if (p.startsWith('/api/files/') && req.method === 'GET') {
      const f = find('files', p.split('/')[3]);
      res.writeHead(200, { 'Content-Type': f.mime, 'Content-Disposition': `inline; filename*=UTF-8''${encodeURIComponent(f.name)}` });
      return fs.createReadStream(path.join(FILES_DIR, f.storedAs)).pipe(res);
    }
    if (p.startsWith('/api/')) {
      if (req.method === 'GET' && p === '/api/state' && url.searchParams.get('rev') === String(db.rev)) return send(res, 200, { unchanged: true, rev: db.rev });
      for (const r of routes) {
        const m = r.method === req.method && p.match(r.re);
        if (!m) continue;
        const body = req.method === 'GET' ? {} : await readBody(req);
        const out = (await r.fn({ params: m.groups || {}, body, query: url.searchParams })) || {};
        if (req.method !== 'GET' && !out.noSave) save();
        return send(res, 200, req.method === 'GET' ? out : { ok: true, ...out, state: state() });
      }
      throw new HttpError(404, 'Rota não existe');
    }
    // arquivos da interface
    let file = path.normalize(path.join(PUBLIC, p === '/' ? 'index.html' : p));
    if (!file.startsWith(PUBLIC) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(PUBLIC, 'index.html');
    send(res, 200, fs.readFileSync(file), MIME[path.extname(file)] || 'application/octet-stream');
  } catch (e) {
    if (!(e instanceof HttpError)) console.error(e);
    send(res, e.status || 500, { ok: false, error: e.message || 'Erro interno' });
  }
});

setInterval(() => { try { tick(); } catch (e) { console.error('Erro no relógio das automações:', e); } }, 15e3);
setTimeout(tick, 2e3);

server.on('error', e => {
  if (e.code === 'EADDRINUSE') {
    console.log(`\nO CRM já está aberto em http://localhost:${PORT} (ou outro programa usa essa porta).\n`);
    if (OPEN) openBrowser();
    process.exit(0);
  }
  throw e;
});

function openBrowser() {
  const url = `http://localhost:${PORT}`;
  const cmd = process.platform === 'win32' ? `start "" "${url}"` : process.platform === 'darwin' ? `open "${url}"` : `xdg-open "${url}"`;
  exec(cmd);
}

server.listen(PORT, HOST, () => {
  console.log('\n  deNoise CRM rodando');
  console.log(`  Neste computador:  http://localhost:${PORT}`);
  if (ON_NETWORK) for (const a of addresses()) console.log(`  Na rede:           ${a}`);
  console.log(`  Dados em:          ${path.join(ROOT, 'dados')}`);
  console.log('\n  Deixe esta janela aberta enquanto usa o CRM. Para fechar, feche a janela ou aperte Ctrl+C.\n');
  if (OPEN) openBrowser();
});

for (const sig of ['SIGINT', 'SIGTERM']) process.on(sig, () => { saveNow(); process.exit(0); });
