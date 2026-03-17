/*
-- ===================================================
-- Código                 : /src/config/noteSubjects.ts
-- Versão (.v20)          : 1.3.2
-- Data/Hora              : 2025-11-05 15:58 America/Sao_Paulo
-- Autor                  : FL / Execução via você EVA
-- Objetivo do codigo     : Dicionário unificado de assuntos (notes) + classificador multi-rótulo
--                          com co-ocorrência determinística e vocabulário de Departamentos & Siglas.
-- Fluxo                  : UI (selects/tooltips) → classifySubjects(note) → { primary, matches }
-- Alterações (1.3.2)     :
--   • Especialidades Clínicas: gatilhos "especialidade(s)/subespecialidade(s)" e padrões "Cirurgia X".
--   • Override: força "Especialidades Clínicas" em listas clínicas quando não houver gatilhos mais fortes.
--   • Mantidas melhorias de v1.3.1: nº+unidade e hasDigit+hasUnit p/ Estimativa de Potencial.
--   • Fix: correção do comparador final (SUBJECT_PRECEDENCE).
-- Dependências           : Nenhuma (módulo isolado).
-- ===================================================
*/

export type NoteSubject = {
  name: string;
  keywords: (string | RegExp)[];
  description: string;
};

export type SubjectMatch = { subject: string; score: number };

// --------------------------------------------------
// Normalização utilitária
// --------------------------------------------------
const normalize = (s: string) =>
  (s ?? '')
    .toString()
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/\s+/g, ' ')
    .trim();

const strToRegex = (term: string) => {
  const t = normalize(term).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${t}\\b`, 'i');
};

const testAny = (text: string, patterns: (string | RegExp)[]) => {
  const norm = normalize(text);
  for (const p of patterns) {
    const rx = p instanceof RegExp ? p : strToRegex(p);
    if (rx.test(text) || rx.test(norm)) return true;
  }
  return false;
};

const countMatches = (text: string, kws: (string | RegExp)[]) => {
  const norm = normalize(text);
  let hits = 0;
  for (const kw of kws) {
    const rx = kw instanceof RegExp ? kw : strToRegex(kw);
    if (rx.test(text) || rx.test(norm)) hits++;
  }
  return hits;
};

// --------------------------------------------------
// DICIONÁRIO DE ASSUNTOS (Categorias)
// --------------------------------------------------
export const NOTE_SUBJECTS: NoteSubject[] = [
  {
    name: 'Financeiro',
    keywords: [
      /or[çc]amento/i, /budget/i, /cota[cç][aã]o/i, /nota fiscal/i, /tabela de prec(?:o|os)/i,
      /precific(?:a|acao)/i, /estimativa\b/i, /\bfatura\b/i, /\bduplicata\b/i,
      /\borc(?:\.|\/)?\b/i, /\bcot(?:\.|\/)?\b/i, /\bnf-?e\b/i, /\bnfs-?e\b/i, /\bnfe\b/i,
      /\bpgto\b/i, /\bpgt\b/i, /\bpagto\b/i, /\bpix\b/i, /\bted\b/i, /\bdoc\b/i,
      /\bdesconto\b/i, /\bboletos?\b/i,
    ],
    description: 'Orçamentos, cotações, NF/NF-e, pagamentos, preços e faturamento.',
  },
  {
    name: 'Suporte',
    keywords: [
      /chamado/i, /defeito/i, /reparo/i, /assist[êe]ncia/i, /garantia/i,
      /\bRMA\b/i, /\bDOA\b/i, /\bOS\s?\d+\b/i, /\bticket\b/i, /\bdevolu[cç][aã]o\b/i, /\btroca\b/i,
    ],
    description: 'Atendimento pós-venda (OS, RMA, DOA), defeitos, garantia, devolução/troca.',
  },
  {
    name: 'Contratos',
    keywords: [/contrato/i, /cl[áa]usula/i, /proposta/i, /renova[cç][aã]o/i, /\bvig[êe]ncia\b/i, /\baditivo\b/i, /\brescis[aã]o\b/i],
    description: 'Contratos comerciais, cláusulas, vigência, propostas e renovações.',
  },
  {
    name: 'Contratos de Manutenção',
    keywords: [/contratos? de manuten[cç][aã]o/i, /manuten[cç][aã]o (?:corretiva|preventiva)/i, /\bSLA\b/i, /\bacordo\b/i],
    description: 'Contratos/SLA de manutenção (corretiva/preventiva) e acordos correlatos.',
  },
  {
    name: 'Engenharia Clínica / Regulatórios',
    keywords: [
      /engenharia cl[ií]nica/i, /\bRDC\b/i, /\bANVISA\b/i, /procedimento operacional padr[aã]o/i, /\bPOP\b/i,
      /calibra[cç][aã]o/i, /certifica[cç][aã]o/i, /qualifica[cç][aã]o/i, /gest[aã]o de risco/i,
      /\b(IQ|OQ|PQ)\b/i, /\bNSP\b/i, /\bCCIH\b/i, /\bSCIH\b/i,
    ],
    description: 'Conformidade (RDC/ANVISA/POP), calibração/qualificação e governança clínica.',
  },
  {
    name: 'Estimativa de Potencial (Planejamento/Dimensionamento)',
    keywords: [
      /dimensionamento/i, /planejamento de capacidade/i, /capacidade (?:instalada|operacional)/i,
      /quantifica[cç][aã]o|quantificar|quantidade/i, /proje[cç][aã]o|forecast/i, /estimativa de demanda/i,
      /taxa de ocupa[cç][aã]o|ocupa[cç][aã]o|utiliza[cç][aã]o/i,
      /tempo m[eé]dio|dura[cç][aã]o m[eé]dia|turnaround|setup|troca de sala/i,
      // nº + unidade (tolerante)
      /\b(?:n(?:[ºo]\.?)?|numero|qtd|qte)\s*(?:de)?\s*\d+\s*(salas?|leitos?|procedimentos?|cirurgias?|turnos?|equipes?|horas?|minutos?)\b/i,
      /\b\d+\s*(salas?|leitos?|procedimentos?|cirurgias?|turnos?|equipes?|horas?|minutos?)\b/i,
      // variações de CC sem conflitar quando houver números
      /\bsalas?\s+de\s+cirurg(?:ia|ico)\b/i,
      /centro cir[úu]rgico|bloco cir[úu]rgico/i,
    ],
    description: 'Quantidades/capacidade (salas, leitos, procedimentos), métricas, tempos e ocupação.',
  },
  {
    name: 'Logística',
    keywords: [
      /coleta(?: reversa)?/i, /autorizac(?:a|ao) de coleta/i, /nf de devolu[cç][aã]o/i,
      /envio/i, /rastre(?:io|amento)/i, /\bAWB\b/i,
      /\bcorreios\b|\bjadlog\b|\bfedex\b|\bdhl\b|\btotal express\b/i,
    ],
    description: 'Coleta/envio, transporte, rastreio e transportadoras.',
  },
  {
    name: 'Comercial',
    keywords: [/cliente/i, /prospec[cç][aã]o/i, /proposta/i, /follow[- ]?up/i],
    description: 'Relação comercial e prospecção.',
  },
  {
    name: 'Infraestrutura / Expansão',
    keywords: [
      /nova unidade|expans[aã]o|obra|reforma|mudan[çc]a de endere[cç]o/i,
      /centro cir[úu]rgico|cme|uti|rpa|srpa|cdi|same|sesmt|ps|pa|ambulatorio|almox|farm[aá]cia/i,
    ],
    description: 'Estrutura física, novas unidades, obras/reformas e departamentos.',
  },
  {
    name: 'Equipamentos / Ópticas',
    keywords: [
      /artrosc[oó]pio|cistosc[oó]pio|histerosc[oó]pio|laparosc[oó]pio|laringosc[oó]pio|nefrosc[oó]pio|sinusc[oó]pio|ureterosc[oó]pio|ureterorrenosc[oó]pio/i,
      /[óo]tica[s]?/i, /endosc[oó]pio/i, /cabo de luz|fibra [óo]ptica/i,
      /equipamentos hospitalares|equipamentos de v[ií]deo[- ]?cirurgia/i,
    ],
    description: 'Ópticas médicas e afins.',
  },
  {
    name: 'Instrumentais Cirúrgicos',
    keywords: [
      /instrumental|instrumentais/i, /pin[cç]a|tesoura|afastador/i,
      /agulha de veress/i, /bainha interna|bainha externa|obturador/i,
      /cabo (?:mono|bi)polar|cabo monopolar|cabo bipolar/i,
      /gancho|esp[aá]tula/i, /c[âa]nula(?: de (?:aspira[cç][aã]o|irrig[aá]c[aã]o))?/i,
      /craniotomo|trepano/i, /porta[- ]?agulha|redutor/i, /ressectosc[oó]pio|trocater|clipador(?:es)?/i,
      /pin[cç]a flex[ií]vel|pin[cç]a de apreens[aã]o/i, /\btroca[rt]e?r\b/i,
    ],
    description: 'Instrumentais e acessórios cirúrgicos.',
  },
  {
    name: 'Relacionamentos Institucionais / Convênios',
    keywords: [
      /\bSUS\b/i, /operadoras|conv[êe]nio|parceria|rede hospitalar|afil[ií]a[cç][aã]o/i,
      /\bRede D['’]Or\b|\bDASA\b|\bHapvida\b|\bNotreDame\b/i,
    ],
    description: 'Parcerias, convênios e redes/grupos.',
  },
  {
    name: 'Porte / Estrutura Econômica',
    keywords: [
      /faturamento|receita|receita bruta/i, /funcion[aá]rios?|colaboradores?/i, /investimento/i,
      /fund[aá]?[cç][aã]o|ano de in[ií]cio/i, /unidades/i,
    ],
    description: 'Tamanho econômico e maturidade (receita, pessoal, funding, fundação).',
  },
  {
    name: 'Especialidades Clínicas',
    keywords: [
      // gatilhos explícitos de listas/introduções
      /especialidades?/i, /subespecialidades?/i,
      // áreas médicas puras
      /urologia|ginecologia|otorrino|oftalmologia|ortopedia|neuro(?:cirurgia)?|cirurgia geral|cardiologia|gastroenterologia|pediatria|oncologia/i,
      // padrões "Cirurgia X" (sem técnica)
      /cirurgia (?:bari[aá]trica|cardiovascular|de urg[êe]ncia|digestiva|pedi[aá]trica|pl[aá]stica(?: e reparadora)?|geral|tor[aá]cica)/i,
      /gastrocirurgia(?: oncol[oó]gica)?/i,
      /proctologia(?: oncol[oó]gica)?/i,
      /neurocirurgia(?: infantil| oncol[oó]gica)?/i,
      /urologia(?: infantil| oncol[oó]gica)?/i,
      /vascular/i,
      // impedir confusão com técnico
      /endoscopia(?!\s*(de video|rigida|flex[ií]vel))/i,
      /laparoscopia(?!\s*(de video|rigida|flex[ií]vel))/i,
    ],
    description: 'Áreas médicas puras (inclui menções a especialidades/subespecialidades e padrões “Cirurgia X”).',
  },
  { name: 'Geral', keywords: [], description: 'Fallback quando nada casa.' },
];

// --------------------------------------------------
// Departamentos & Siglas → categoria-alvo
// --------------------------------------------------
type DeptSigla = { aliases: (string | RegExp)[]; target: string };

export const DEPT_SIGLAS: DeptSigla[] = [
  { aliases: [/\bCME\b/i, /central de material/i, /esterilizacao/i], target: 'Infraestrutura / Expansão' },
  { aliases: [/\bCC\b/i, /centro cir[úu]rgico|bloco cir[úu]rgico/i], target: 'Infraestrutura / Expansão' },
  { aliases: [/\bRPA\b/i, /\bSRPA\b/i, /sala de recuperacao/i], target: 'Infraestrutura / Expansão' },
  { aliases: [/\bUTI\b/i, /\bUCO\b/i, /terapia intensiva/i], target: 'Infraestrutura / Expansão' },
  { aliases: [/\bPS\b/i, /\bPA\b/i, /pronto (?:socorro|atendimento)/i], target: 'Infraestrutura / Expansão' },
  { aliases: [/\bAMB\b/i, /ambulatorio/i], target: 'Infraestrutura / Expansão' },
  { aliases: [/\bCDI\b/i, /diagnostico por imagem|radiologia/i], target: 'Infraestrutura / Expansão' },
  { aliases: [/\bSAME\b/i, /arquivo medico/i], target: 'Infraestrutura / Expansão' },
  { aliases: [/\bSESMT\b/i], target: 'Infraestrutura / Expansão' },
  { aliases: [/farmacia hospitalar|^farmacia\b/i], target: 'Infraestrutura / Expansão' },
  { aliases: [/\balmox(?:arifado)?\b/i, /suprimentos/i], target: 'Infraestrutura / Expansão' },
  { aliases: [/\bCCIH\b/i, /\bSCIH\b/i, /controle de infeccao/i], target: 'Engenharia Clínica / Regulatórios' },
  { aliases: [/\bNSP\b/i, /seguranca do paciente/i], target: 'Engenharia Clínica / Regulatórios' },
];

// --------------------------------------------------
// Precedência
// --------------------------------------------------
export const SUBJECT_PRECEDENCE: string[] = [
  'Financeiro',
  'Engenharia Clínica / Regulatórios',
  'Contratos de Manutenção',
  'Contratos',
  'Estimativa de Potencial (Planejamento/Dimensionamento)',
  'Logística',
  'Comercial',
  'Infraestrutura / Expansão',
  'Equipamentos / Ópticas',
  'Instrumentais Cirúrgicos',
  'Relacionamentos Institucionais / Convênios',
  'Porte / Estrutura Econômica',
  'Especialidades Clínicas',
  'Geral',
];

export const DEFAULT_SUBJECT = 'Geral';

// --------------------------------------------------
// Regras de co-ocorrência (overrides determinísticos)
// --------------------------------------------------
function applyOverrides(note: string, matches: SubjectMatch[]): SubjectMatch[] {
  const norm = normalize(note);

  const isFinancial = testAny(norm, [
    /\borc(?:\.|\/)?\b/i, /or[çc]amento/i, /budget/i, /cota[cç][aã]o/i,
    /\bnf-?e\b|\bnfs-?e\b|\bnfe\b|\bnota fiscal\b/i,
    /\bpgto\b|\bpgt\b|\bpagto\b|\bpix\b|\bted\b|\bdoc\b/i,
    /tabela de prec(?:o|os)|precific(?:a|acao)|fatura|duplicata|desconto/i,
  ]);

  const isRegulatory = testAny(norm, [
    /engenharia cl[ií]nica/i, /\bRDC\b/i, /\bANVISA\b/i, /\bPOP\b/i,
    /\b(IQ|OQ|PQ)\b/i, /calibra[cç][aã]o|certifica[cç][aã]o|qualifica[cç][aã]o|gest[aã]o de risco/i,
    /\bNSP\b|\bCCIH\b|\bSCIH\b/i,
  ]);

  const isMaintContract = testAny(norm, [/contratos? de manuten[cç][aã]o/i, /\bSLA\b/i]);

  // Quantificação (números + unidades) ou padrões explícitos
  const hasDigit = /\d/.test(norm);
  const hasUnit = testAny(norm, [
    /salas?\s*(?:de\s+cirurg(?:ia|ico))?/i,
    /leitos?/i,
    /procedimentos?/i,
    /cirurgias?/i,
    /turnos?/i,
    /equipes?/i,
    /horas?/i,
    /minutos?/i,
  ]);

  const isQuant =
    (hasDigit && hasUnit) ||
    testAny(norm, [
      /dimensionamento|planejamento de capacidade|capacidade (?:instalada|operacional)/i,
      /quantifica[cç][aã]o|quantificar|quantidade|proje[cç][aã]o|forecast|estimativa de demanda/i,
      /taxa de ocupa[cç][aã]o|ocupa[cç][aã]o|utiliza[cç][aã]o/i,
      /tempo m[eé]dio|dura[cç][aã]o m[eé]dia|turnaround|setup|troca de sala/i,
      /\b(?:n(?:[ºo]\.?)?|numero|qtd|qte)\s*(?:de)?\s*\d+\s*(salas?|leitos?|procedimentos?|cirurgias?|turnos?|equipes?|horas?|minutos?)\b/i,
      /\b\d+\s*(salas?|leitos?|procedimentos?|cirurgias?|turnos?|equipes?|horas?|minutos?)\b/i,
    ]);

  // Listas de especialidades/subespecialidades
  const isClinicalList = testAny(norm, [
    /especialidades?/i, /subespecialidades?/i,
    /cirurgia (?:bari[aá]trica|cardiovascular|de urg[êe]ncia|digestiva|pedi[aá]trica|pl[aá]stica(?: e reparadora)?|geral|tor[aá]cica)/i,
    /gastrocirurgia(?: oncol[oó]gica)?/i,
    /proctologia(?: oncol[oó]gica)?/i,
    /neurocirurgia(?: infantil| oncol[oó]gica)?/i,
    /urologia(?: infantil| oncol[oó]gica)?/i,
    /vascular/i,
    /urologia|ginecologia|otorrino|oftalmologia|ortopedia|neuro(?:cirurgia)?|cirurgia geral|cardiologia|gastroenterologia|pediatria|oncologia/i,
  ]);

  const force = (name: string) => {
    const score = Math.max(3, ...matches.map((m) => m.score));
    return [{ subject: name, score }];
  };

  if (isFinancial) return force('Financeiro');
  if (isRegulatory) return force('Engenharia Clínica / Regulatórios');
  if (isMaintContract) return force('Contratos de Manutenção');
  if (isQuant) return force('Estimativa de Potencial (Planejamento/Dimensionamento)');

  // Se for lista de especialidades (e nada mais forte), força Especialidades Clínicas
  if (isClinicalList) return force('Especialidades Clínicas');

  // Departamentos & Siglas → se nada forte, adiciona Infraestrutura
  const deptHit = DEPT_SIGLAS.some((d) => testAny(norm, d.aliases));
  if (deptHit && !matches.some((m) => m.subject === 'Infraestrutura / Expansão')) {
    matches.push({ subject: 'Infraestrutura / Expansão', score: 1 });
  }

  return matches;
}

// --------------------------------------------------
// Classificador MULTI-RÓTULO
// --------------------------------------------------
export function classifySubjects(note: string): {
  primary: string;
  matches: SubjectMatch[];
} {
  const scores = NOTE_SUBJECTS.map((s) => ({
    subject: s.name,
    score: countMatches(note, s.keywords),
  }));

  let matches = scores
    .filter((s) => s.score > 0 && s.subject !== 'Geral')
    .sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return SUBJECT_PRECEDENCE.indexOf(a.subject) - SUBJECT_PRECEDENCE.indexOf(b.subject);
    });

  // Overrides de co-ocorrência
  matches = applyOverrides(note, matches);

  // Ordena final
  matches.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    return SUBJECT_PRECEDENCE.indexOf(a.subject) - SUBJECT_PRECEDENCE.indexOf(b.subject);
  });

  const primary = matches.length > 0 ? matches[0].subject : DEFAULT_SUBJECT;

  if (matches.length === 0) {
    matches = [{ subject: 'Geral', score: 1 }];
  }

  return { primary, matches };
}
