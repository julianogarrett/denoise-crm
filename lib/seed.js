// Dados do primeiro uso: etapas, origens, automações e alguns leads de exemplo.
// Tudo que é exemplo tem sample: true e some no botão "Apagar exemplos".
import crypto from 'node:crypto';
import { TEMPLATES } from './templates.js';

const id = p => p + crypto.randomBytes(6).toString('hex');
const ago = (days, hours = 0) => new Date(Date.now() - (days * 24 + hours) * 3600e3).toISOString();
const ahead = (days, hours = 0) => new Date(Date.now() + (days * 24 + hours) * 3600e3).toISOString();

export function seedData() {
  const stages = [
    { id: 'st_novo', name: 'Novo lead', color: '#06b6d4', kind: 'open' },
    { id: 'st_qual', name: 'Qualificação', color: '#8b5cf6', kind: 'open' },
    { id: 'st_cont', name: 'Contato feito', color: '#eab308', kind: 'open' },
    { id: 'st_prop', name: 'Proposta enviada', color: '#f97316', kind: 'open' },
    { id: 'st_neg', name: 'Negociação', color: '#ec4899', kind: 'open' },
    { id: 'st_ganho', name: 'Ganho', color: '#22c55e', kind: 'won' },
    { id: 'st_perdido', name: 'Perdido', color: '#94a3b8', kind: 'lost' },
  ];
  const origins = [
    { id: 'or_indicacao', name: 'Indicação', color: '#f97316' },
    { id: 'or_instagram', name: 'Instagram', color: '#db2777' },
    { id: 'or_site', name: 'Site', color: '#64748b' },
    { id: 'or_whatsapp', name: 'WhatsApp', color: '#16a34a' },
    { id: 'or_anuncio', name: 'Anúncio', color: '#2563eb' },
    { id: 'or_evento', name: 'Evento', color: '#7c3aed' },
  ];
  const members = [
    { id: 'm_juliano', name: 'Juliano', color: '#ea580c' },
    { id: 'm_marina', name: 'Marina Alves', color: '#16a34a', sample: true },
    { id: 'm_rafael', name: 'Rafael Costa', color: '#7c3aed', sample: true },
  ];

  const raw = [
    ['Lívia Prado', 'Studio Lívia', 'st_novo', 'm_juliano', 'or_instagram', 2400, 'morno', 0],
    ['Caio Menezes', 'Menezes Odonto', 'st_qual', 'm_marina', 'or_indicacao', 6800, 'quente', 1],
    ['Patrícia Lemos', 'Lemos Arquitetura', 'st_qual', 'm_rafael', 'or_site', 3500, 'morno', 3],
    ['Otávio Brandão', 'Brandão Imóveis', 'st_qual', 'm_juliano', 'or_anuncio', 12000, 'quente', 2],
    ['Renata Sales', 'Café Sales', 'st_cont', 'm_marina', 'or_whatsapp', 1800, 'frio', 6],
    ['Henrique Duarte', 'HD Academia', 'st_cont', 'm_juliano', 'or_anuncio', 7600, 'morno', 2],
    ['Sofia Ramos', 'Ramos Advocacia', 'st_prop', 'm_rafael', 'or_indicacao', 9800, 'quente', 1],
    ['Gustavo Nery', 'Nery Transportes', 'st_prop', 'm_marina', 'or_evento', 15200, 'morno', 4],
    ['Beatriz Fontes', 'Fontes Estética', 'st_neg', 'm_juliano', 'or_instagram', 5400, 'quente', 1],
    ['Marcelo Tavares', 'MT Engenharia', 'st_ganho', 'm_rafael', 'or_site', 25000, 'quente', 8],
    ['Aline Rocha', 'Doce Aline', 'st_ganho', 'm_juliano', 'or_indicacao', 3200, 'quente', 12],
    ['Diego Faria', 'Faria Auto', 'st_perdido', 'm_marina', 'or_anuncio', 4100, 'frio', 15],
  ];
  const cities = ['Belo Horizonte - MG', 'São Paulo - SP', 'Curitiba - PR', 'Rio de Janeiro - RJ', 'Goiânia - GO'];
  const interests = ['Gestão de redes sociais', 'Edição de vídeos', 'Produção de conteúdo', 'Identidade visual'];

  const leads = [], tasks = [], interactions = [], history = [];
  raw.forEach(([name, company, stageId, ownerId, originId, value, temperature, days], i) => {
    const lid = id('l_');
    const first = name.split(' ')[0].toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    leads.push({
      id: lid, code: i + 1, name, company, stageId, ownerId, originId, value, temperature,
      score: { frio: 25, morno: 55, quente: 82 }[temperature] + (i % 4) * 3,
      phone: `+55 31 9${8800 + i * 37}-${1000 + i * 113}`.slice(0, 19), email: `${first}@exemplo.com`,
      city: cities[i % cities.length], document: '', birthday: '', interest: interests[i % interests.length],
      tags: i === 3 || i === 7 ? ['alto valor'] : [], notes: '',
      createdAt: ago(days + 2), updatedAt: ago(days), stageChangedAt: ago(days), sample: true,
    });
    history.push({ id: id('h_'), leadId: lid, text: 'Lead criado', kind: 'create', at: ago(days + 2) });
    interactions.push({ id: id('i_'), leadId: lid, kind: 'mensagem', text: `Primeira conversa com ${name.split(' ')[0]}: quer saber mais sobre ${interests[i % interests.length].toLowerCase()}.`, authorId: ownerId, at: ago(days + 1), sample: true });
    if (!['st_ganho', 'st_perdido'].includes(stageId)) {
      tasks.push({ id: id('t_'), leadId: lid, title: i % 3 === 0 ? `Ligar para ${name.split(' ')[0]}` : `Enviar material para ${name.split(' ')[0]}`, dueAt: i % 4 === 0 ? ago(1) : ahead(i % 3, 2), ownerId, done: false, createdAt: ago(days), sample: true });
    }
  });

  const automations = TEMPLATES.map((t, i) => ({
    id: id('a_'), name: t.name, description: t.description, active: i !== 4,
    trigger: { ...t.trigger }, steps: t.steps.map(s => ({ id: id('s_'), ...structuredClone(s) })),
    createdAt: ago(20), templateKey: t.key,
  }));

  return {
    settings: { workspaceName: 'deNoise', brandColor: '#111827', minutesPerAction: 2.5 },
    members, stages, origins, leads, tasks, interactions, history, automations,
    counters: { lead: leads.length },
  };
}
