# NutriFlow — Marco 0.2: Modelo de domínio e persistência transacional

## Escopo aprovado

Este marco amplia a fundação não visível do NutriFlow com o primeiro modelo de
domínio executável e sua persistência transacional em D1. Nenhuma tela, rota
pública, API clínica ou fluxo existente foi ativado.

## Entregas

- Value Objects validados para identificadores públicos, unidades, quantidades
  escaladas, revisões, versões e ordenação;
- agregado `FoodPlanDraft`, com transições explícitas, controle otimista de
  revisão e invariantes para edição e revisão;
- snapshot publicado v1 profundamente imutável e independente dos registros
  editáveis;
- contratos públicos v1 para conteúdo, comandos de salvamento, rascunhos e
  planos publicados;
- portas de repositório para planos e auditoria;
- implementação D1 do Unit of Work, acumulando estado clínico, auditoria e
  eventos outbox em um único lote atômico;
- modelo relacional aditivo para conteúdo de planos, unidades, nutrientes,
  alimentos versionados, receitas, modelos de refeição, substituições,
  observações e preferências de entrega;
- proteções no banco contra alteração de revisões ou versões liberadas;
- testes unitários, de migração, de invariantes e de integração transacional
  sobre SQLite compatível com o esquema D1.

## Modelo de conteúdo

O plano estruturado passa a possuir dias, refeições, itens alimentares,
substituições e observações. Quantidades são armazenadas como inteiros escalados
(`quantity_milli`), evitando imprecisão de ponto flutuante. Itens preservam
nome, unidade e revisão da fonte como snapshot, permitindo reproduzir uma versão
publicada mesmo que catálogos evoluam posteriormente.

As entidades preparatórias de Biblioteca Global de Alimentos, Nutrientes,
Receitas e Meal Templates foram modeladas por extensão do domínio. Elas não
estão disponíveis ao usuário e permanecem desativadas por feature flags.

## Atomicidade e auditoria

Cada caso de uso deve executar dentro de `NutriFlowUnitOfWork`. A implementação
D1 prepara todas as escritas e as envia em um único `batch`:

1. estado do agregado e de seu conteúdo;
2. registro de auditoria;
3. eventos internos na outbox.

Se qualquer comando falhar, nenhum dos três conjuntos pode permanecer gravado.
Os eventos somente podem ser despachados depois da confirmação da transação.

## Compatibilidade e isolamento

- o fluxo legado de PDFs e `patient_documents` não foi alterado;
- todas as novas tabelas usam o prefixo `nf_`;
- o vínculo com o paciente reutiliza `clients.id` sem duplicar identidade;
- o paciente continuará podendo receber somente PDF durante a transição;
- nenhuma feature flag do NutriFlow foi habilitada;
- nenhuma alteração foi feita nos dados clínicos já publicados.

## Feature flags

Continuam desligadas por padrão:

- editor administrativo;
- visualização estruturada no Portal do Paciente;
- atualizações em tempo real;
- despacho de Domain Events;
- catálogo global;
- receitas;
- Meal Templates.

## Validação do marco

- migrações exclusivamente aditivas e aplicáveis em banco limpo;
- 27 tabelas `nf_` verificadas pelos testes de migração;
- snapshots publicados e revisões liberadas protegidos contra mutação;
- conflito de revisão rejeitado pelo agregado;
- refeição vazia impedida de avançar para revisão;
- lote D1 comprovado como atômico no sucesso e no rollback;
- isolamento organizacional de eventos validado antes do commit;
- regressão do sistema existente preservada pelos testes completos do projeto.

## Avaliação formal dos critérios arquiteturais

| Critério | Avaliação |
| --- | --- |
| C01 — Quebra compatibilidade retroativa? | Não. O modelo é aditivo e o PDF legado permanece intacto. |
| C02 — Exige remodelagem do banco existente? | Não. Somente novas tabelas, índices e proteções `nf_` foram adicionados. |
| C03 — Afeta auditoria ou versionamento? | Reforça ambos sem alterar contratos publicados. |
| C04 — Altera planos já publicados? | Não. Nenhum plano legado é migrado ou modificado. |
| C05 — Pode ser implementado por extensão? | Sim. O marco estende as portas, o domínio e o esquema aprovados. |
| C06 — Introduz acoplamento entre módulos? | Não. O domínio não importa D1, UI, framework ou infraestrutura. |
| C07 — Compromete escalabilidade futura? | Não. Organização, IDs públicos, outbox e referências versionadas foram preservados. |
| C08 — Aumenta resposta de operações críticas? | Não há operação pública ativa. Escritas futuras serão atômicas; processamento pesado permanece destinado à outbox assíncrona. |

## PMA/ADR

Não foi necessária Proposta de Mudança Arquitetural. Todas as decisões deste
marco são extensões diretas da arquitetura e da Constituição Técnica aprovadas.

## Limites e próximo portão de revisão

Este marco não implementa autorização, endpoints públicos, editor, publicação
para pacientes, sincronização em tempo real nem processador assíncrono da
outbox. Esses itens somente poderão avançar após a revisão formal do Marco 0.2.

