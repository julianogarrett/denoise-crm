// Casca do app: menu lateral, topo, tema, notificações e troca de telas.
import { S, ui, onChange, loadState, startPolling, api, rerender, lead } from './store.js';
import { actions, listen } from './actions.js';
import { icon } from './icons.js';
import { esc, ago, initials } from './ui.js';
import * as painel from './views/painel.js';
import * as funil from './views/funil.js';
import * as leadView from './views/lead.js';
import * as tarefas from './views/tarefas.js';
import * as automacoes from './views/automacoes.js';
import * as config from './views/config.js';

const VIEWS = { painel, funil, tarefas, automacoes, config };
const NAV = [
  ['painel', 'Painel', 'painel'],
  ['funil', 'Funil de vendas', 'funil'],
  ['tarefas', 'Tarefas', 'tarefas'],
  ['automacoes', 'Automações', 'automacoes'],
  ['config', 'Configurações', 'config'],
];

// ---------- tema ----------
const store = {
  get: k => { try { return localStorage.getItem(k); } catch { return null; } },
  set: (k, v) => { try { localStorage.setItem(k, v); } catch {} },
};
const media = matchMedia('(prefers-color-scheme: dark)');
let themePref = store.get('crm-tema') || 'sistema';
function applyTheme() {
  const dark = themePref === 'escuro' || (themePref === 'sistema' && media.matches);
  document.documentElement.dataset.theme = dark ? 'dark' : 'light';
}
media.addEventListener('change', applyTheme);
applyTheme();
let sideOpen = store.get('crm-menu') === 'aberto';

// ---------- rotas ----------
function readHash() {
  const [route, id] = location.hash.replace(/^#\/?/, '').split('/');
  ui.route = VIEWS[route] ? route : 'painel';
  if (ui.route === 'automacoes') automacoes.openFromHash(id);
}
addEventListener('hashchange', () => { readHash(); if (ui.route !== 'config') config.reset(); render(); });

// ---------- desenho ----------
function shell() {
  const unread = S.notifications.filter(n => !n.read).length;
  const lateTasks = S.tasks.filter(t => !t.done && t.dueAt && Date.parse(t.dueAt) < Date.now()).length;
  const themeIcon = { sistema: 'monitor', claro: 'sun', escuro: 'moon' }[themePref];
  const themeName = { sistema: 'Tema do sistema', claro: 'Tema claro', escuro: 'Tema escuro' }[themePref];
  return `<div class="app">
    <aside class="side ${sideOpen ? 'open' : ''}">
      <div class="brand"><span class="logo" style="background:${esc(S.settings.brandColor)}">${esc(initials(S.settings.workspaceName).slice(0, 1))}</span><b>${esc(S.settings.workspaceName)}</b></div>
      ${NAV.map(([r, name, ic]) => `<a class="nav-item ${ui.route === r ? 'active' : ''}" href="#${r}" data-tip="${name}">${icon(ic, 20)}<span class="label">${name}</span>${r === 'tarefas' && lateTasks ? '<span class="dot"></span>' : ''}</a>`).join('')}
      <div class="spacer"></div>
      <button class="nav-item" data-act="tema" data-tip="${themeName}">${icon(themeIcon, 20)}<span class="label">${themeName}</span></button>
    </aside>
    <div class="main">
      <div class="top">
        <button class="icon-btn" data-act="menu" aria-label="Abrir ou fechar o menu">${icon('panel', 18)}</button>
        <div class="grow"></div>
        ${S.network ? `<span class="pill" title="Outros computadores da rede podem abrir: ${esc(S.network.join(', '))}">${icon('wifi', 13)} Na rede: ${esc(S.network[0] || '')}</span>` : ''}
        <button class="icon-btn" data-act="notif" aria-label="Notificações">${icon('bell', 18)}${unread ? `<span class="badge">${unread > 99 ? '99+' : unread}</span>` : ''}</button>
        ${ui.notifOpen ? notifPanel() : ''}
      </div>
      <div class="content" id="view">${VIEWS[ui.route].view()}</div>
    </div>
  </div>`;
}

function notifPanel() {
  const list = [...S.notifications].reverse().slice(0, 60);
  return `<div class="notif">
    <div class="notif-head"><span class="grow">Notificações</span>
      ${list.length ? `<button class="btn sm ghost" data-act="notifLimpar">Limpar</button>` : ''}
      <button class="icon-btn" data-act="notif" aria-label="Fechar">${icon('x', 16)}</button></div>
    <div class="notif-list">
      ${list.length ? list.map(n => `<div class="notif-item ${n.read ? '' : 'unread'}" data-act="notifAbrir" data-lead="${esc(n.leadId || '')}">
        ${icon('zap', 15)}<div><div>${esc(n.text)}</div><div class="muted small">${ago(n.at)}</div></div></div>`).join('')
        : '<div class="empty"><strong>Nada por aqui</strong><p>Avisos das automações e tarefas atrasadas aparecem aqui.</p></div>'}
    </div></div>`;
}

// Guarda a rolagem das áreas que rolam, para a tela não "pular" quando redesenha.
const SCROLLERS = ['.content', '.board', '.col-body', '.tab-body', '.d-left', '.canvas', '.flow-cols', '.notif-list'];
function saveScroll() {
  const out = {};
  for (const sel of SCROLLERS) out[sel] = [...document.querySelectorAll(sel)].map(el => [el.scrollTop, el.scrollLeft]);
  return out;
}
function restoreScroll(saved) {
  for (const sel of SCROLLERS) document.querySelectorAll(sel).forEach((el, i) => {
    const s = saved[sel]?.[i];
    if (s) { el.scrollTop = s[0]; el.scrollLeft = s[1]; }
  });
}

let pending = false;
// Se o botão do mouse está apertado, espera soltar: assim um campo que perde o foco
// (e redesenha a tela) não "engole" o clique no botão que a pessoa estava apertando.
let mouseDown = false, afterMouse = false;
document.addEventListener('mousedown', () => { mouseDown = true; }, true);
document.addEventListener('mouseup', () => setTimeout(() => { mouseDown = false; if (afterMouse) { afterMouse = false; render(); } }, 0), true);
const typing = () => {
  const a = document.activeElement;
  return a && (a.matches('textarea, input:not([type=checkbox]):not([type=color]):not([type=file]), select') || a.isContentEditable);
};
function render(opts = {}) {
  if (!S) return;
  if (opts.poll && typing()) { pending = true; return; }
  if (mouseDown) { afterMouse = true; return; }
  pending = false;
  const scroll = saveScroll();
  document.getElementById('root').innerHTML = shell();
  document.getElementById('drawer-root').innerHTML = ui.leadId && lead(ui.leadId) ? leadView.view() : '';
  if (ui.leadId && !lead(ui.leadId)) ui.leadId = null;
  restoreScroll(scroll);
  VIEWS[ui.route].mounted?.();
  if (ui.leadId) leadView.mounted();
}
document.addEventListener('focusout', () => setTimeout(() => { if (pending && !typing()) render(); }, 50));

actions({
  click: {
    menu: () => { sideOpen = !sideOpen; store.set('crm-menu', sideOpen ? 'aberto' : 'fechado'); render(); },
    tema: () => {
      themePref = { sistema: 'claro', claro: 'escuro', escuro: 'sistema' }[themePref];
      store.set('crm-tema', themePref);
      applyTheme();
      render();
    },
    notif: async () => {
      ui.notifOpen = !ui.notifOpen;
      render();
      if (!ui.notifOpen && S.notifications.some(n => !n.read)) await api('POST', '/api/notifications/read');
    },
    notifLimpar: () => api('DELETE', '/api/notifications'),
    notifAbrir: el => {
      if (el.dataset.lead && lead(el.dataset.lead)) { ui.leadId = el.dataset.lead; ui.leadTab = 'interacoes'; }
      ui.notifOpen = false;
      api('POST', '/api/notifications/read');
    },
  },
});

document.addEventListener('mousedown', e => {
  if (ui.notifOpen && !e.target.closest('.notif, [data-act="notif"]')) { ui.notifOpen = false; api('POST', '/api/notifications/read'); }
});
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !document.querySelector('.modal-wrap')) {
    if (ui.leadId) { ui.leadId = null; rerender(); }
    else if (ui.notifOpen) { ui.notifOpen = false; rerender(); }
  }
});

listen();
onChange(render);
readHash();
loadState().then(startPolling).catch(() => {
  document.getElementById('root').innerHTML = '<div class="empty" style="height:100%;justify-content:center"><strong>Não consegui falar com o servidor do CRM</strong><p>Abra o CRM pelo atalho "Abrir CRM" e deixe a janela dele aberta.</p></div>';
});
