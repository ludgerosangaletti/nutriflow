# NutriFlow — Marco 0.4: Resiliência operacional

## Escopo aprovado

Este marco fecha os mecanismos operacionais assíncronos e de ativação segura
previstos para a Fase 0. Ele não cria rotas públicas, editor, preview ou leitura
estruturada do paciente. O fluxo atual de PDF permanece como única experiência
clínica ativa.

## Entregas

- idempotência persistida por organização, operação, chave e impressão do pedido;
- repetição segura de resposta concluída sem executar a operação novamente;
- conflito estável quando uma chave é reutilizada com conteúdo diferente;
- recuperação controlada de tentativa expirada ou falha, preservando a impressão
  originalmente vinculada à chave;
- avaliação server-side de feature flags com precedência paciente, organização,
  global e default;
- expiração de override, variante explícita e telemetria sem conteúdo clínico;
- claim atômico de eventos por lease temporário;
- recuperação de workers interrompidos após expiração do lease;
- retry exponencial limitado e estado `dead_letter` para falhas permanentes;
- consumo idempotente independente por nome de consumidor;
- migração aditiva `0022_fantastic_martin_li.sql`;
- testes reais em SQLite para migração, idempotência, flags, leases, retry,
  dead-letter e reprocessamento.

## Garantias de idempotência

Uma chave fica vinculada permanentemente à primeira impressão de pedido dentro
do escopo `organization + operation`. Uma resposta concluída pode ser
reproduzida. Uma tentativa falha pode ser repetida somente com o mesmo conteúdo.
Uma chave em processamento não permite execução concorrente.

## Garantias da outbox

O processador não presume ordem global. Cada evento é adquirido por lease e tem
contador de tentativas. Falha do consumidor não desfaz o commit clínico. Cada
consumidor registra o `event_id` e o próprio estado, impedindo duplicação de
efeitos quando o evento for reenviado. Falhas permanentes ficam isoladas em
`dead_letter`, preservando diagnóstico seguro e possibilidade futura de
reprocessamento administrativo.

## Feature flags

Todas as flags continuam desligadas por padrão. A avaliação ocorre no servidor
e aplica o override mais específico válido. A flag não substitui autenticação ou
autorização. Neste marco nenhum override foi criado em produção e nenhuma função
do NutriFlow foi exposta a usuários.

## Migração aditiva

A migração adiciona:

- `nf_idempotency_keys` com índices de escopo, expiração e correlação;
- lease e início de processamento em `nf_outbox_events`;
- disponibilidade, lease e início de processamento em
  `nf_event_consumptions`;
- índice adicional de despacho para consumos.

Nenhuma tabela, coluna ou registro clínico existente é removido. O índice
anterior de consumo é preservado para manter a migração estritamente aditiva.

## Compatibilidade e isolamento

- autenticação Supabase e painel existente não foram alterados;
- `patient_documents`, upload e leitura de PDF não foram alterados;
- nenhuma rota `/api/v1/nutriflow` foi criada;
- nenhuma flag foi habilitada;
- nenhuma entrega externa real foi conectada aos consumidores;
- o domínio continua sem dependência de D1, HTTP, interface ou provider.

## Validação do marco

- uma resposta concluída é reproduzida sem segunda execução;
- a mesma chave com outro conteúdo retorna conflito;
- override de paciente prevalece sobre organização e defaults permanecem off;
- dois processadores não obtêm simultaneamente o mesmo lease válido;
- reprocessar evento já consumido não repete o efeito;
- falha transitória recebe backoff e nova tentativa;
- falha permanente chega a `dead_letter` sem detalhe sensível;
- migração preserva eventos previamente existentes;
- regressão integral da aplicação é executada antes do checkpoint.

## Avaliação formal dos critérios arquiteturais

| Critério | Avaliação |
| --- | --- |
| C01 — Quebra compatibilidade retroativa? | Não. Foram adicionados mecanismos internos sem alterar contratos ou fluxos existentes. |
| C02 — Exige remodelagem do banco ou domínio? | Não. A migração é extensão aditiva da infraestrutura já prevista. |
| C03 — Afeta auditoria ou versionamento? | Reforça rastreabilidade por correlação, chaves e consumo de eventos, sem reescrever histórico. |
| C04 — Altera planos publicados? | Não. Não existe mutação de conteúdo clínico ou publicação ativa. |
| C05 — Pode ser implementado por extensão? | Sim. Foram adicionadas portas e adapters sobre a outbox e as tabelas aprovadas. |
| C06 — Introduz acoplamento? | Não. Aplicação depende de portas; D1 permanece isolado na infraestrutura. |
| C07 — Compromete escala horizontal? | Não. Idempotência e flags são escopadas por organização e cliente; leases suportam múltiplos workers. |
| C08 — Aumenta latência crítica? | Não. Efeitos não críticos permanecem pós-commit e assíncronos. |

## PMA/ADR

Não foi necessária Proposta de Mudança Arquitetural. A implementação materializa
diretamente R06, R08, R09, R10, R11, R12 e R15 da Constituição Técnica.

## Limites e próximo portão de revisão

O Marco 0.4 não conecta cron, e-mail, WhatsApp, PDF ou projeções reais à outbox;
não cria handlers HTTP nem casos de uso clínicos completos; não habilita editor
ou visualização do paciente. O próximo marco somente poderá começar após a
aprovação formal desta entrega.
