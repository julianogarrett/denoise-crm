// Registro de ações: o HTML usa data-act="nome" (clique), data-change, data-input e data-enter,
// e cada tela registra aqui o que acontece. Um único ouvinte no documento despacha tudo.
export const handlers = { click: {}, change: {}, input: {}, enter: {} };

export function actions(map) {
  for (const [kind, fns] of Object.entries(map)) Object.assign(handlers[kind], fns);
}

function run(kind, attr, e) {
  const el = e.target.closest(`[${attr}]`);
  if (!el) return;
  const fn = handlers[kind][el.getAttribute(attr)];
  if (fn) fn(el, e);
}

export function listen() {
  document.addEventListener('click', e => run('click', 'data-act', e));
  document.addEventListener('change', e => run('change', 'data-change', e));
  document.addEventListener('input', e => run('input', 'data-input', e));
  document.addEventListener('keydown', e => {
    if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
      const el = e.target.closest('[data-enter]');
      if (el) { e.preventDefault(); run('enter', 'data-enter', e); }
    }
  });
}
