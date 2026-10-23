// Modelos prontos de automação (aba "Modelos prontos").
// Os ids de etapa apontam para as etapas padrão; se a etapa não existir mais, o modelo usa a primeira.
export const TEMPLATES = [
  {
    key: 'boas-vindas',
    name: 'Boas-vindas ao novo lead',
    description: 'Distribui o lead em rodízio, registra a entrada e cria a tarefa do primeiro contato.',
    trigger: { type: 'lead_created' },
    steps: [
      { type: 'assign_owner', mode: 'rodizio', memberIds: [] },
      { type: 'add_interaction', kind: 'nota', text: 'Lead entrou no CRM pela origem {origem}. Responsável: {responsavel}.' },
      { type: 'create_task', title: 'Primeiro contato com {nome}', amount: 1, unit: 'horas', owner: 'responsavel' },
      { type: 'notify', text: 'Novo lead: {nome} ({origem}) para {responsavel}' },
    ],
  },
  {
    key: 'qualificacao',
    name: 'Diagnóstico na qualificação',
    description: 'Quando o lead entra em Qualificação, marca como morno e agenda o diagnóstico.',
    trigger: { type: 'stage_entered', stageId: 'st_qual' },
    steps: [
      { type: 'set_temperature', temperature: 'morno' },
      { type: 'create_task', title: 'Fazer diagnóstico com {nome}', amount: 1, unit: 'dias', owner: 'responsavel' },
    ],
  },
  {
    key: 'lembrete-proposta',
    name: 'Lembrete de proposta',
    description: 'Dois dias depois da proposta, se o lead ainda estiver parado nela, cria um follow-up.',
    trigger: { type: 'stage_entered', stageId: 'st_prop' },
    steps: [
      { type: 'wait', amount: 2, unit: 'dias' },
      { type: 'condition', field: 'etapa', op: 'igual', value: 'st_prop' },
      { type: 'create_task', title: 'Follow-up da proposta de {nome}', amount: 0, unit: 'horas', owner: 'responsavel' },
      { type: 'notify', text: '{nome} está há 2 dias com a proposta sem resposta' },
    ],
  },
  {
    key: 'lead-parado',
    name: 'Lead parado',
    description: 'Lead sem movimentação há 5 dias ganha a tag "parado" e uma tarefa de retomada.',
    trigger: { type: 'lead_idle', days: 5 },
    steps: [
      { type: 'add_tag', tag: 'parado' },
      { type: 'set_temperature', temperature: 'frio' },
      { type: 'create_task', title: 'Retomar contato com {nome}', amount: 0, unit: 'horas', owner: 'responsavel' },
    ],
  },
  {
    key: 'alto-valor',
    name: 'Lead de alto valor',
    description: 'Leads acima de R$ 10.000 ganham a tag "alto valor" e avisam a equipe.',
    trigger: { type: 'lead_created' },
    steps: [
      { type: 'condition', field: 'valor', op: 'maior', value: '10000' },
      { type: 'add_tag', tag: 'alto valor' },
      { type: 'set_temperature', temperature: 'quente' },
      { type: 'notify', text: 'Lead de alto valor: {nome} ({valor})' },
    ],
  },
  {
    key: 'ganho',
    name: 'Negócio ganho',
    description: 'Registra o fechamento no histórico e avisa a equipe.',
    trigger: { type: 'stage_entered', stageId: 'st_ganho' },
    steps: [
      { type: 'remove_tag', tag: 'parado' },
      { type: 'add_interaction', kind: 'nota', text: 'Negócio fechado em {valor}.' },
      { type: 'notify', text: 'Negócio ganho: {nome} ({valor}) por {responsavel}' },
    ],
  },
];
