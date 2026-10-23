// Painel: números do funil, leads parados, origens e tarefas do dia.
import { S, stage } from '../store.js';
import { icon } from '../icons.js';
import { esc, money, avatar, dueLabel, empty } from '../ui.js';

const kindOf = l => stage(l.stageId)?.kind || 'open';

export function view() {
  const open = S.leads.filter(l => kindOf(l) === 'open');
  const won = S.leads.filter(l => kindOf(l) === 'won');
  const lost = S.leads.filter(l => kindOf(l) === 'lost');
  const month = new Date().toISOString().slice(0, 7);
  const wonMonth = won.filter(l => (l.wonAt || l.stageChangedAt || '').startsWith(month));
  const closed = won.length + lost.length;
  const late = S.tasks.filter(t => !t.done && t.dueAt && Date.parse(t.dueAt) < Date.now());
  const newWeek = S.leads.filter(l => Date.now() - Date.parse(l.createdAt) < 7 * 86400e3).length;

  const byStage = S.stages.map(s => ({ s, n: S.leads.filter(l => l.stageId === s.id).length }));
  const maxStage = Math.max(1, ...byStage.map(x => x.n));

  // Leads abertos há mais tempo sem movimentação
  const lastMove = l => Date.parse(l.lastActivityAt || l.stageChangedAt || l.updatedAt || l.createdAt);
  const idle = open.map(l => ({ l, days: Math.floor((Date.now() - lastMove(l)) / 86400e3) }))
    .filter(x => x.days >= 2).sort((a, b) => b.days - a.days).slice(0, 6);

  const byOrigin = [...S.origins.map(o => ({ o, n: S.leads.filter(l => l.originId === o.id).length })),
    { o: { name: 'Sem origem', color: '#94a3b8' }, n: S.leads.filter(l => !l.originId).length }].filter(x => x.n).sort((a, b) => b.n - a.n);
  const maxOrigin = Math.max(1, ...byOrigin.map(x => x.n));

  const today = new Date(); today.setHours(23, 59, 59, 999);
  const todo = S.tasks.filter(t => !t.done && t.dueAt && Date.parse(t.dueAt) <= today.getTime()).sort((a, b) => a.dueAt.localeCompare(b.dueAt)).slice(0, 8);

  const kpi = (label, value, sub) => `<div class="card kpi"><div class="k-label">${label}</div><div class="k-value">${value}</div><div class="k-sub">${sub}</div></div>`;

  return `
    ${S.leads.some(l => l.sample) ? `<div class="banner">${icon('sparkle', 16)}<span class="grow">Você está vendo dados de exemplo. Quando quiser começar de verdade, apague os exemplos.</span><button class="btn sm" data-act="apagarExemplos">Apagar exemplos</button></div>` : ''}
    <div class="page-head"><h1>Painel</h1><div class="grow"></div><button class="btn primary" data-act="novoLead">${icon('plus', 16)} Novo lead</button></div>
    <div class="kpis">
      ${kpi('Leads no funil', open.length, `${newWeek} novos nos últimos 7 dias`)}
      ${kpi('Pipeline em aberto', money(open.reduce((s, l) => s + Number(l.value || 0), 0)), 'Soma das oportunidades abertas')}
      ${kpi('Receita ganha no mês', money(wonMonth.reduce((s, l) => s + Number(l.value || 0), 0)), `${wonMonth.length} negócio${wonMonth.length === 1 ? '' : 's'} fechado${wonMonth.length === 1 ? '' : 's'}`)}
      ${kpi('Taxa de conversão', closed ? Math.round((won.length / closed) * 100) + '%' : '—', late.length ? `<span style="color:var(--danger)">${late.length} tarefa${late.length === 1 ? '' : 's'} atrasada${late.length === 1 ? '' : 's'}</span>` : 'Ganhos ÷ negócios encerrados')}
    </div>
    <div class="grid-2">
      <div class="card"><h3>Funil por etapa</h3><div class="bars">
        ${byStage.map(({ s, n }) => `<a class="bar-row" href="#funil" style="text-decoration:none"><span>${esc(s.name)}</span><div class="track"><i style="--c:${esc(s.color)};width:${(n / maxStage) * 100}%"></i></div><span class="n">${n}</span></a>`).join('')}
      </div></div>
      <div class="card"><h3>Precisam de atenção</h3><div>
        ${idle.map(({ l, days }) => `<button class="att-row" data-act="abrirLead" data-id="${l.id}">
          <span class="att-name"><b>${esc(l.name)}</b>${l.company ? `<span class="muted"> · ${esc(l.company)}</span>` : ''}</span><b class="num">${money(l.value)}</b>
          <span class="att-meta"><span class="chip" style="--c:${esc(stage(l.stageId)?.color || '#64748b')}">${esc(stage(l.stageId)?.name || '')}</span><span class="muted small">${days} dias sem movimentação</span></span></button>`).join('') || empty('Tudo andando', 'Nenhum lead aberto está parado há mais de 2 dias.')}
      </div></div>
      <div class="card"><h3>Leads por origem</h3><div class="bars">
        ${byOrigin.map(({ o, n }) => `<div class="bar-row"><span><span class="chip" style="--c:${esc(o.color)}">${esc(o.name)}</span></span><div class="track"><i style="--c:var(--fg);width:${(n / maxOrigin) * 100}%"></i></div><span class="n">${n}</span></div>`).join('') || '<p class="muted">Nenhum lead ainda.</p>'}
      </div></div>
      <div class="card"><h3>Tarefas de hoje e atrasadas</h3><div class="list-task">
        ${todo.map(t => {
          const d = dueLabel(t);
          const l = S.leads.find(x => x.id === t.leadId);
          return `<div class="task-row"><button class="check" data-act="tarefaFeita" data-id="${t.id}" aria-label="Concluir">${icon('check', 12)}</button>
            <div class="grow"><div class="title">${esc(t.title)}</div><div class="sub">${l ? `<button class="link" data-act="abrirLead" data-id="${l.id}">${esc(l.name)}</button>` : ''}</div></div>
            <span class="due ${d.cls}">${icon('clock', 12)}${esc(d.text)}</span>${avatar(t.ownerId)}</div>`;
        }).join('') || empty('Tudo em dia', 'Nenhuma tarefa para hoje.')}
      </div></div>
    </div>`;
}

