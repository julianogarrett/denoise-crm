// Peças de interface reaproveitadas pelas telas.
import { icon } from './icons.js';
import { member, origin } from './store.js';

export const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
export const money = v => 'R$ ' + Number(v || 0).toLocaleString('pt-BR', { maximumFractionDigits: 0 });
export const initials = name => String(name || '?').trim().split(/\s+/).slice(0, 2).map(p => p[0]).join('').toUpperCase();

const pad = n => String(n).padStart(2, '0');
export function dateTime(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export function dateOnly(iso) {
  if (!iso) return '—';
  const d = new Date(iso);
  return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
}
export function ago(iso) {
  if (!iso) return '';
  const s = (Date.now() - Date.parse(iso)) / 1000;
  if (s < 60) return 'agora';
  if (s < 3600) return `há ${Math.floor(s / 60)} min`;
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`;
  const d = Math.floor(s / 86400);
  return d === 1 ? 'ontem' : `há ${d} dias`;
}
// valor para <input type="datetime-local">
export function toLocalInput(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}
export const fromLocalInput = v => (v ? new Date(v).toISOString() : null);

export function dueLabel(task) {
  if (task.done) return { cls: 'ok', text: 'Concluída' };
  if (!task.dueAt) return { cls: '', text: 'Sem prazo' };
  const t = Date.parse(task.dueAt);
  const today = new Date(); today.setHours(23, 59, 59, 999);
  if (t < Date.now()) return { cls: 'late', text: 'Atrasada · ' + dateTime(task.dueAt) };
  if (t <= today.getTime()) return { cls: 'today', text: 'Hoje · ' + dateTime(task.dueAt).slice(6) };
  return { cls: '', text: dateTime(task.dueAt) };
}

export function avatar(memberId, size = 'sm') {
  const m = member(memberId);
  if (!m) return `<span class="avatar ${size} empty" title="Sem responsável">${icon('user', 12)}</span>`;
  return `<span class="avatar ${size}" style="--c:${esc(m.color)}" title="${esc(m.name)}">${esc(initials(m.name))}</span>`;
}

export function originChip(originId) {
  const o = origin(originId);
  if (!o) return '';
  return `<span class="chip" style="--c:${esc(o.color)}">${esc(o.name)}</span>`;
}

export const TEMPS = { frio: 'Frio', morno: 'Morno', quente: 'Quente' };
export function tempBadge(lead) {
  return `<span class="temp ${esc(lead.temperature)}">${icon('flame', 13)}${TEMPS[lead.temperature] || 'Morno'} · score ${Number(lead.score) || 0}</span>`;
}

export function options(list, selected, { empty } = {}) {
  return (empty !== undefined ? `<option value="">${esc(empty)}</option>` : '') +
    list.map(x => `<option value="${esc(x.id)}" ${x.id === selected ? 'selected' : ''}>${esc(x.name)}</option>`).join('');
}

// ---------- avisos ----------
export function toast(text, kind = 'ok') {
  let box = document.getElementById('toasts');
  if (!box) { box = document.createElement('div'); box.id = 'toasts'; document.body.append(box); }
  const el = document.createElement('div');
  el.className = 'toast ' + kind;
  el.innerHTML = `${icon(kind === 'erro' ? 'alert' : 'check', 16)}<span>${esc(text)}</span>`;
  box.append(el);
  setTimeout(() => el.classList.add('out'), 2800);
  setTimeout(() => el.remove(), 3200);
}

// ---------- janelas ----------
export function modal({ title, body, footer = '', wide = false, onMount }) {
  const wrap = document.createElement('div');
  wrap.className = 'modal-wrap';
  wrap.innerHTML = `<div class="modal ${wide ? 'wide' : ''}" role="dialog" aria-modal="true" aria-label="${esc(title)}">
    <div class="modal-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Fechar">${icon('x', 18)}</button></div>
    <div class="modal-body">${body}</div>
    ${footer ? `<div class="modal-foot">${footer}</div>` : ''}
  </div>`;
  const close = () => { wrap.remove(); document.removeEventListener('keydown', onKey); };
  const onKey = e => { if (e.key === 'Escape') close(); };
  wrap.addEventListener('mousedown', e => { if (e.target === wrap || e.target.closest('[data-close]')) close(); });
  document.addEventListener('keydown', onKey);
  document.body.append(wrap);
  wrap.querySelector('input, textarea, select')?.focus();
  onMount?.(wrap.querySelector('.modal'), close);
  return close;
}

export function confirmBox(text, { ok = 'Confirmar', danger = true } = {}) {
  return new Promise(resolve => {
    let answered = false;
    const close = modal({
      title: 'Tem certeza?',
      body: `<p class="muted">${esc(text)}</p>`,
      footer: `<button class="btn ghost" data-close>Cancelar</button><button class="btn ${danger ? 'danger' : 'primary'}" data-ok>${esc(ok)}</button>`,
      onMount: (el, c) => el.querySelector('[data-ok]').addEventListener('click', () => { answered = true; c(); resolve(true); }),
    });
    const obs = new MutationObserver(() => { if (!document.contains(document.querySelector('.modal-wrap')) && !answered) { obs.disconnect(); resolve(false); } });
    obs.observe(document.body, { childList: true });
    return close;
  });
}

export const empty = (title, text, action = '') => `<div class="empty"><strong>${esc(title)}</strong><p>${esc(text)}</p>${action}</div>`;
