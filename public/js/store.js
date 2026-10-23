// Estado do app: dados vindos do servidor (S) + estado da tela (ui).
export let S = null;
export const ui = {
  route: 'painel',
  leadId: null,
  leadTab: 'interacoes',
  funil: { q: '', owner: '', showClosed: false },
  tarefas: { filter: 'abertas', owner: '' },
  auto: { tab: 'funil', editing: null, draft: null, sideTab: 'configurar', testLeadId: '', testLog: null, menuAt: null },
  config: { tab: 'geral' },
  notifOpen: false,
};

let listeners = [];
export const onChange = fn => listeners.push(fn);
const emit = (opts = {}) => listeners.forEach(fn => fn(opts));
export const rerender = () => emit();

export function setState(next, opts) {
  S = next;
  emit(opts);
}

export async function api(method, url, body) {
  const res = await fetch(url, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data;
  try { data = await res.json(); } catch { data = { ok: false, error: 'Resposta inválida do servidor' }; }
  if (!res.ok || data.ok === false) {
    const { toast } = await import('./ui.js');
    toast(data.error || 'Não deu certo. Tente de novo.', 'erro');
    throw new Error(data.error);
  }
  if (data.state) setState(data.state);
  return data;
}

export async function loadState() {
  const res = await fetch('/api/state' + (S ? '?rev=' + S.rev : ''));
  const data = await res.json();
  if (!data.unchanged) setState(data, { poll: !!S });
}

// Busca mudanças a cada 5s (outra aba, outro computador ou automação que rodou sozinha).
export function startPolling() {
  let offline = false;
  setInterval(async () => {
    try {
      await loadState();
      if (offline) { offline = false; document.body.classList.remove('offline'); }
    } catch {
      offline = true;
      document.body.classList.add('offline');
    }
  }, 5000);
}

// Atalhos de leitura
export const stage = id => S.stages.find(s => s.id === id);
export const member = id => S.members.find(m => m.id === id);
export const origin = id => S.origins.find(o => o.id === id);
export const lead = id => S.leads.find(l => l.id === id);
