# NutriFlow — Marco 0.1: Fundação arquitetural

## Escopo aprovado

Este marco implementa somente a fundação não visível do NutriFlow. Nenhuma rota,
tela ou fluxo atual passa a consumir planos estruturados.

## Entregas

- módulo isolado em `modules/nutriflow`, com dependências orientadas para dentro;
- contratos públicos v1 separados dos tipos de persistência;
- envelope versionado de Domain Events e coleta por Aggregate Root;
- eventos iniciais `PlanDraftCreated`, `PlanVersionPublished` e
  `PlanPublicationRevoked`;
- contrato de Unit of Work exigindo estado e outbox na mesma transação;
- serialização determinística para a outbox;
- feature flags desligadas por padrão;
- tabelas aditivas para organizações, membros, planos, versões, publicações,
  auditoria, outbox, consumo idempotente e overrides de flags;
- proteções no banco contra alteração de snapshots publicados e contra
  alteração ou exclusão do histórico de auditoria;
- testes unitários da fundação.
- adaptação do teste de regressão renderizado para simular o binding virtual
  `cloudflare:workers` fora do runtime da Cloudflare.

## Compatibilidade

O fluxo legado de `patient_documents` e PDFs não foi alterado. As novas tabelas
usam o prefixo `nf_`, relacionam pacientes por `clients.id` e permanecem inertes
enquanto as feature flags estiverem desligadas.

## Decisões de conformidade

- não houve alteração dos princípios arquiteturais aprovados;
- não foi necessária PMA/ADR neste marco;
- nenhuma API ou interface do NutriFlow foi exposta ao usuário;
- nenhum dado clínico publicado existente foi modificado;
- a migração é exclusivamente aditiva e possui rollback lógico por abandono das
  tabelas `nf_`, sem apagar dados legados.

## Limite do marco

A implementação concreta do Unit of Work sobre D1, os repositórios, o modelo
completo de conteúdo alimentar e as políticas de autorização pertencem aos
próximos marcos e não devem avançar antes da revisão deste documento.
