// Workflow: análise ponta a ponta do repositório Harness².
// Uso: Workflow({ scriptPath: '<este arquivo>', args: { repoRoot, testReport } })
//   repoRoot:   caminho absoluto da raiz do clone (ex: /home/myke/Desktop/projetos/harnes-google/harness2)
//   testReport: saída da suíte de testes (texto) para grounding empírico (opcional, pode ser '')
//
// Fases: Map -> DeepDive -> Verify -> Critic -> Synthesize.
// Retorna: { report, stats }.

export const meta = {
  name: 'harness2-e2e-analysis',
  description: 'Análise ponta a ponta do repo Harness2: arquitetura, correção, testes, docs, segurança',
  phases: [
    { title: 'Map', detail: 'mapeamento paralelo dos subsistemas' },
    { title: 'DeepDive', detail: 'análise profunda por dimensão' },
    { title: 'Verify', detail: 'verificação adversarial dos achados' },
    { title: 'Critic', detail: 'crítico de completude e rodada extra' },
    { title: 'Synthesize', detail: 'relatório final ponta a ponta' },
  ],
};

const ROOT = args.repoRoot;
const TEST_REPORT = args.testReport || '(suíte de testes não executada)';

const MAP_SCHEMA = {
  type: 'object',
  properties: {
    area: { type: 'string' },
    responsibility: { type: 'string' },
    keyFiles: { type: 'array', items: { type: 'string' } },
    keySymbols: { type: 'array', items: { type: 'string' } },
    dependsOn: { type: 'array', items: { type: 'string' } },
    notes: { type: 'string' },
  },
  required: ['area', 'responsibility', 'keyFiles', 'keySymbols', 'dependsOn', 'notes'],
};

const DIVE_SCHEMA = {
  type: 'object',
  properties: {
    dimension: { type: 'string' },
    summary: { type: 'string' },
    strengths: { type: 'array', items: { type: 'string' } },
    findings: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          title: { type: 'string' },
          severity: { type: 'string' },
          kind: { type: 'string' },
          file: { type: 'string' },
          line: { type: 'integer' },
          detail: { type: 'string' },
        },
        required: ['title', 'severity', 'kind', 'detail'],
      },
    },
    openQuestions: { type: 'array', items: { type: 'string' } },
  },
  required: ['dimension', 'summary', 'strengths', 'findings', 'openQuestions'],
};

const VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    refuted: { type: 'boolean' },
    reason: { type: 'string' },
  },
  required: ['refuted', 'reason'],
};

const CRITIC_SCHEMA = {
  type: 'object',
  properties: {
    gaps: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          area: { type: 'string' },
          question: { type: 'string' },
          where: { type: 'string' },
        },
        required: ['area', 'question', 'where'],
      },
    },
    followups: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          prompt: { type: 'string' },
          why: { type: 'string' },
        },
        required: ['prompt', 'why'],
      },
    },
  },
  required: ['gaps', 'followups'],
};

// ---------------------------------------------------------------- Map
phase('Map');
log('Mapeando os 6 subsistemas em paralelo');

const MAP_TASKS = [
  {
    label: 'map:core-loop',
    prompt:
      'Repo em ' + ROOT + '. MAPEAMENTO factual (sem julgamentos) do loop central de recursão.\n' +
      'Leia integralmente: harness2/core/recursion.py, harness2/core/proposer.py, harness2/core/selection.py, harness2/core/judge.py.\n' +
      'Retorne: responsibility (o que esse subsistema faz, 2-4 frases), keyFiles (cada arquivo + 1 linha do papel dele),\n' +
      'keySymbols (classes/funções principais com assinatura curta), dependsOn (outros módulos que ele importa),\n' +
      'notes (peculiaridades: invariantes, retries, caching, estados). Seja factual e preciso.',
  },
  {
    label: 'map:orchestration',
    prompt:
      'Repo em ' + ROOT + '. MAPEAMENTO factual (sem julgamentos) da orquestração e estado.\n' +
      'Leia integralmente: harness2/core/schedule.py, harness2/core/tree.py, harness2/core/ledger.py,\n' +
      'harness2/core/runmark.py, harness2/core/library.py, harness2/core/spec.py.\n' +
      'Retorne: responsibility (2-4 frases), keyFiles (arquivo + 1 linha do papel), keySymbols (classes/funções + assinatura curta),\n' +
      'dependsOn (módulos importados), notes (modelagem de estado, resume, paralelismo/sequencial, identificadores de reuso).',
  },
  {
    label: 'map:context',
    prompt:
      'Repo em ' + ROOT + '. MAPEAMENTO factual (sem julgamentos) de contexto, prompts e relatório.\n' +
      'Leia integralmente: harness2/core/context.py, harness2/core/prompts.py, harness2/core/report.py.\n' +
      'Retorne: responsibility (2-4 frases), keyFiles (arquivo + 1 linha do papel), keySymbols (principais + assinatura curta),\n' +
      'dependsOn (módulos importados), notes (como o contexto é construído, 8 componentes editáveis do harness, formato do relatório).',
  },
  {
    label: 'map:substrate',
    prompt:
      'Repo em ' + ROOT + '. MAPEAMENTO factual (sem julgamentos) dos executores (substratos).\n' +
      'Leia integralmente: harness2/substrate/base.py, harness2/substrate/opencode.py, harness2/substrate/codex.py.\n' +
      'Retorne: responsibility (2-4 frases), keyFiles (arquivo + 1 linha do papel), keySymbols (principais + assinatura curta),\n' +
      'dependsOn (módulos importados), notes (protocolo do executor, tratamento de erro/sessão, env, diferenças opencode x codex).',
  },
  {
    label: 'map:benchmarks',
    prompt:
      'Repo em ' + ROOT + '. MAPEAMENTO factual (sem julgamentos) dos benchmarks.\n' +
      'Leia integralmente: harness2/benchmarks/jobbench.py, harness2/benchmarks/lab.py, harness2/benchmarks/workbuddy.py,\n' +
      'harness2/benchmarks/tasks.py, harness2/benchmarks/jb_opencode_runner.py, harness2/benchmarks/wb_render.py.\n' +
      'Retorne: responsibility (2-4 frases), keyFiles (arquivo + 1 linha do papel), keySymbols (principais + assinatura curta),\n' +
      'dependsOn (módulos importados), notes (como cada benchmark executa/avalia, isolamento, renders, juízes).',
  },
  {
    label: 'map:cli-ops',
    prompt:
      'Repo em ' + ROOT + '. MAPEAMENTO factual (sem julgamentos) da superfície CLI, operação, testes e docs.\n' +
      'Leia: harness2/cli/run_sweep.py, judge.py, report.py, setup.py, check.py, demo.py, bridge.py, _common.py,\n' +
      'harness2/config.py, harness2/install.py, harness2/preflight.py, harness2/demo.py, scripts/*.sh, scripts/*.py.\n' +
      'Liste também (ls) tests/, docs/, dependencies/, third_party/ e diga em 1 linha o papel de cada item.\n' +
      'Retorne: responsibility (2-4 frases), keyFiles, keySymbols, dependsOn, notes (entry points do pyproject, fluxo setup->run->judge->report).',
  },
];

const maps = (
  await parallel(MAP_TASKS.map((t) => () => agent(t.prompt, { phase: 'Map', schema: MAP_SCHEMA, label: t.label })))
).filter(Boolean);

const digest = maps.map((m) => '- ' + m.area + ': ' + m.responsibility + ' | símbolos: ' + m.keySymbols.join('; ') + ' | depende de: ' + m.dependsOn.join(', ')).join('\n');
log(maps.length + '/6 subsistemas mapeados');

// ---------------------------------------------------------------- DeepDive
phase('DeepDive');
log('Análise profunda em 8 dimensões');

const DIVE_COMMON =
  '\n\nContexto dos demais subsistemas (para checar contratos entre módulos):\n' + digest +
  '\n\nResultado da suíte de testes (grounding empírico):\n' + TEST_REPORT +
  '\n\nRegras do achado: severity em {alta, media, baixa}; kind em {bug, security, design, doc, observation}. ' +
  'No máximo 8 findings ordenados por importância, no máximo 5 strengths, no máximo 5 openQuestions. ' +
  'file sempre relativo à raiz do repo (ex: harness2/core/schedule.py). Seja específico e cite comportamento real do código, não genéricos.';

const DIVE_TASKS = [
  {
    label: 'dive:core-loop',
    prompt:
      'Repo em ' + ROOT + '. DIMENSÃO: correção do loop Propose–Probe–Compose.\n' +
      'Leia: harness2/core/recursion.py, proposer.py, selection.py, judge.py + testes tests/test_lab_judge_patch.py, ' +
      'tests/test_baseline_judge.py, tests/test_task_input_identity.py, tests/test_proposer_failures.py, tests/test_proposer_session_errors.py.\n' +
      'Perguntas-guia: o contraste comportamental sem ground-truth é sólido? Há vazamento de informação entre probe e compose? ' +
      'O compose preserva edições válidas e descarta as ruins? Caching de rollout pode reaproveitar resultado indevido? ' +
      'Falhas do proposer/session errors são tratadas sem corromper estado? Avalie invariantes, condições de corrida lógicas e casos-limite.' + DIVE_COMMON,
  },
  {
    label: 'dive:scheduling',
    prompt:
      'Repo em ' + ROOT + '. DIMENSÃO: scheduling, retry, resume e reprodutibilidade de execução.\n' +
      'Leia: harness2/core/schedule.py (inteiro, é o maior), tree.py, ledger.py, runmark.py, library.py, spec.py, harness2/cli/run_sweep.py + testes ' +
      'tests/test_workflow.py, test_stage_retry.py, test_requested_mode_resume.py, test_runner_seed.py, ' +
      'tests/test_jobbench_killed_rollout.py, tests/test_jobbench_rollout_isolation.py.\n' +
      'Perguntas-guia: modos parallel/sequential estão corretos? Resume de runs parciais é seguro (stale state)? Seeds são preservadas? ' +
      'Retry após falha limpa estado suficiente? Ledger/runmark garantem idempotência? Há risco de tarefa executada 2x ou perdida?' + DIVE_COMMON,
  },
  {
    label: 'dive:benchmarks',
    prompt:
      'Repo em ' + ROOT + '. DIMENSÃO: fidelidade e robustez dos benchmarks.\n' +
      'Leia: harness2/benchmarks/jobbench.py, lab.py, workbuddy.py, tasks.py, jb_opencode_runner.py, wb_render.py + docs/BENCHMARKS.md + ' +
      'tests/test_lab_nested_deliverables.py, tests/test_jobbench_worker_failure.py.\n' +
      'Perguntas-guia: isolamento entre rollouts (installs, tmp, workspaces) é real? Juízes e métricas (incl. partial pass rate do LAB) estão corretos? ' +
      'Render de resultados é fiel? Falhas de worker/rollout morto são detectadas e registradas? Há flakiness previsível?' + DIVE_COMMON,
  },
  {
    label: 'dive:substrate',
    prompt:
      'Repo em ' + ROOT + '. DIMENSÃO: robustez dos executores (substratos) e ponte Codex.\n' +
      'Leia: harness2/substrate/base.py, opencode.py, codex.py, harness2/cli/bridge.py + testes tests/test_subprocess_env.py, tests/test_proposer_session_errors.py.\n' +
      'Perguntas-guia: o protocolo do executor (base) é bem definido e seguido pelos dois? Erros de sessão/timeout/crash são classificados corretamente? ' +
      'Env vars e segredos passam de forma segura para subprocessos? O bridge litellm/fastapi expõe superfície desnecessária? ' +
      'Compat com patches third_party (opencode-compat.diff) está coerente?' + DIVE_COMMON,
  },
  {
    label: 'dive:cli-ops',
    prompt:
      'Repo em ' + ROOT + '. DIMENSÃO: CLI, setup, instalação e operação.\n' +
      'Leia: harness2/cli/*.py, harness2/config.py, install.py, preflight.py, demo.py, scripts/setup_benchmark.py, check_setup.py, ' +
      'check_provenance.py, split_tasks.py, run_*.sh + docs/SETUP.md + tests/test_env_example.py + .env.example + pyproject.toml.\n' +
      'Perguntas-guia: o fluxo setup->check->run->judge->report funciona sem buracos? .env.example cobre tudo que o código lê? ' +
      'preflight/check detectam ambiente quebrado antes de gastar budget? install.py é idempotente? Há flags/modos documentados mas não implementados (ou vice-versa)?' + DIVE_COMMON,
  },
  {
    label: 'dive:tests',
    prompt:
      'Repo em ' + ROOT + '. DIMENSÃO: qualidade e cobertura da suíte de testes.\n' +
      'Leia TODOS os 15 arquivos em tests/test_*.py + tests/fixtures/ (liste o que há).\n' +
      'Perguntas-guia: que invariante cada teste pinça? A cobertura acompanha os módulos críticos (schedule, recursion, proposer)? ' +
      'O que NÃO é testado e deveria ser (lacunas por módulo)? Testes são determinísticos ou flaky? Fixtures são representativas?' + DIVE_COMMON,
  },
  {
    label: 'dive:security',
    prompt:
      'Repo em ' + ROOT + '. DIMENSÃO: segurança.\n' +
      'Leia com olhar adversarial: config.py, substrate/*.py, cli/bridge.py, scripts/*.py, benchmarks runners, third_party/patches/*.diff, ' +
      'third_party/*/PROVENANCE.md, dependencies/PINNED.md, .gitignore, .env.example.\n' +
      'Perguntas-guia: segredos (API keys, HARNESS2_*_API_KEY) podem vazar para logs/trajetórias/runs/? Subprocessos herdam env excessivo? ' +
      'Isolamento de workspace impede escrita fora da área? Bridge expõe auth? Patches third_party alteram comportamento de segurança dos runners originais? ' +
      'runs/ ou artefatos com segredo correm risco de commit? Classifique cada achado como security com severidade honesta (sem alarmismo).' + DIVE_COMMON,
  },
  {
    label: 'dive:docs',
    prompt:
      'Repo em ' + ROOT + '. DIMENSÃO: documentação, claims e reprodutibilidade.\n' +
      'Leia: README.md (inteiro), docs/EXPERIMENTS.md, docs/BENCHMARKS.md, docs/SETUP.md, CONTRIBUTING.md, dependencies/README.md, ' +
      'dependencies/PINNED.md, dependencies/ASSETS.json, third_party/README.md.\n' +
      'Perguntas-guia: claims do README (ganhos de 11.5/4.5/11.8 pontos, 8 componentes, modos suportados) têm lastro no código? ' +
      'Guias de experimento/benchmark são reproduzíveis a partir do zero? Dependências pinadas batem com pyproject? ' +
      'Falta documentar algum modo/flag/limitação importante? Há contradição entre docs?' + DIVE_COMMON,
  },
];

const dives = (
  await parallel(DIVE_TASKS.map((t) => () => agent(t.prompt, { phase: 'DeepDive', schema: DIVE_SCHEMA, label: t.label })))
).filter(Boolean);
log(dives.length + '/8 dimensões analisadas');

// ---------------------------------------------------------------- Verify
phase('Verify');
log('Verificação adversarial dos achados bug/security');

const seen = new Set();
const candidates = [];
dives.forEach((d, di) => {
  (d.findings || []).forEach((f) => {
    if (f.kind !== 'bug' && f.kind !== 'security') return;
    const key = (f.file || '') + '::' + f.title;
    if (seen.has(key)) return;
    seen.add(key);
    candidates.push({ item: f, dim: d.dimension, idx: candidates.length });
  });
});
const bugList = candidates.slice(0, 40);
log(bugList.length + ' achados bug/security para verificar (3 votos cada)');

const verified = (
  await pipeline(bugList, async (c) => {
    const f = c.item;
    const votes = await parallel(
      [0, 1, 2].map((i) => () =>
        agent(
          'Você é um revisor CÉTICO. Tente REFUTAR o achado abaixo lendo o código real em ' + ROOT + '.\n' +
            'Achado [' + f.kind + '/' + f.severity + '] (' + c.dim + '): ' + f.title + '\n' +
            'Arquivo: ' + (f.file || 'n/a') + ' linha ~' + (f.line || '?') + '\n' +
            'Detalhe: ' + f.detail + '\n' +
            'Instruções: leia o arquivo citado e o contexto necessário. Só marque refuted=false se o código CONFIRMA o problema. ' +
            'Na dúvida, marque refuted=true e explique o motivo (ex: código já trata, premissa errada, caminho inalcançável). ' +
            'Seja rigoroso: achado plausível-mas-errado deve ser refutado.',
          { phase: 'Verify', schema: VERDICT_SCHEMA, label: 'verify:b' + c.idx + ':v' + i }
        )
      )
    );
    const live = votes.filter(Boolean);
    const survivors = live.filter((v) => !v.refuted).length;
    if (survivors >= 2) return { title: f.title, severity: f.severity, kind: f.kind, file: f.file, detail: f.detail, dimension: c.dim, votes: survivors + '/' + live.length };
    return null;
  })
).filter(Boolean);
log(verified.length + '/' + bugList.length + ' achados sobreviveram');

// ---------------------------------------------------------------- Critic
phase('Critic');
log('Crítico de completude');

const diveDigest = dives.map((d) => '## ' + d.dimension + '\nResumo: ' + d.summary + '\nAchados: ' + (d.findings || []).map((f) => '[' + f.kind + '/' + f.severity + '] ' + f.title).join('; ') + '\nAbertas: ' + (d.openQuestions || []).join('; ')).join('\n\n');

const critic = await agent(
  'Repo em ' + ROOT + '. Você é o CRÍTICO DE COMPLETUDE de uma análise ponta a ponta do Harness².\n' +
    'Cobertura já feita (resumos por dimensão):\n' + diveDigest +
  '\n\nAchados bug/security já verificados adversarialmente: ' + verified.map((v) => '[' + v.severity + '] ' + v.title + ' (' + v.file + ')').join('; ') +
  '\n\nTarefa: identifique o que ficou DE FORA ou RASO — modalidades não examinadas (ex: performance/custo, concorrência real, compat de versão Python, ' +
  'terceiros/lab_runner e wb_runner internos, scripts/render, demo, install em máquina limpa, manifest/MANIFEST.in, LICENSES), claims não verificadas, ' +
  'arquivos grandes pouco cobertos. Retorne gaps (area, question, where) e no MÁXIMO 4 followups, cada um com prompt PRONTO para um agente investigador ' +
  '(inclua paths absolutos com ' + ROOT + ') e why (por que vale o custo).',
  { phase: 'Critic', schema: CRITIC_SCHEMA, label: 'critic' }
);

const followups = (critic.followups || []).slice(0, 4);
const extra = (
  await parallel(
    followups.map((fu, i) => () =>
      agent('Repo em ' + ROOT + '. Investigação complementar (' + fu.why + '):\n' + fu.prompt + '\n\nRetorne texto direto e factual: o que encontrou (com file:linha), severidade se for problema, e o que continua em aberto.', {
        phase: 'Critic',
        label: 'followup:' + i,
      })
    )
  )
).filter(Boolean);
log('Rodada extra: ' + extra.length + ' investigações');

// ---------------------------------------------------------------- Synthesize
phase('Synthesize');

const observations = [];
dives.forEach((d) => {
  (d.findings || []).forEach((f) => {
    if (f.kind !== 'bug' && f.kind !== 'security') observations.push('[' + d.dimension + '/' + f.kind + '/' + f.severity + '] ' + f.title + ' — ' + f.detail + ' (' + (f.file || '?') + ')');
  });
});

const report = await agent(
  'Repo em ' + ROOT + '. Escreva o RELATÓRIO FINAL da análise ponta a ponta do Harness², em português (pt-BR), Markdown.\n' +
    'Contexto: framework de recursive agent harnessing (Propose–Probe–Compose no nível da tarefa + improvement harness persistente), ~13k linhas em harness2/, 15 testes, 3 benchmarks (JobBench, LAB, WorkBuddy-Bench), executores OpenCode/Codex.\n' +
    'Dimensões analisadas:\n' + diveDigest +
  '\n\nACHADOS VERIFICADOS adversarialmente (confiáveis — destaque com votos):\n' + verified.map((v) => '- [' + v.severity + '/' + v.kind + '] ' + v.title + ' (' + v.votes + ' votos) em ' + v.file + ': ' + v.detail).join('\n') +
  '\n\nOBSERVAÇÕES não-verificadas (apresente como hipóteses, não fatos):\n' + observations.join('\n') +
  '\n\nInvestigações complementares:\n' + extra.join('\n---\n') +
  '\n\nResultado da suíte de testes:\n' + TEST_REPORT +
  '\n\nEstrutura do relatório: 1) Visão geral (o que é, arquitetura em 1 diagrama textual); 2) Loop central Propose–Probe–Compose (como funciona + avaliação); ' +
  '3) Execução/scheduling/resume; 4) Benchmarks e isolamento; 5) Substratos e bridge; 6) CLI/operação/setup; 7) Testes (cobertura e lacunas); ' +
  '8) Segurança; 9) Docs e reprodutibilidade; 10) Achados verificados (tabela severidade|achado|arquivo|votos); 11) Riscos e limitações; 12) Próximos passos priorizados. ' +
  'Cite sempre arquivo:linha aproximada. Seja denso e técnico, sem enrolação. Em pt-BR.',
  { phase: 'Synthesize', label: 'synthesis' }
);

return {
  report: report,
  stats: {
    subsystems: maps.length,
    dimensions: dives.length,
    findingsTotal: dives.reduce((n, d) => n + (d.findings || []).length, 0),
    bugsChecked: bugList.length,
    bugsConfirmed: verified.length,
    followups: extra.length,
  },
};
