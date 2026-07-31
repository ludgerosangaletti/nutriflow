# NutriFlow — Fase 1 / Sprint 1

## Escopo entregue

Esta Sprint implementa a base transacional do editor de rascunhos: título, observações gerais, dias, refeições, alimentos manuais e notas estruturadas.

## Fluxo técnico

1. O contrato público `SaveFoodPlanDraftCommandV1` permanece em `v1`.
2. A aplicação recupera o rascunho pelo identificador público, cliente e organização.
3. O domínio valida referências, unicidade, conteúdo e revisão esperada.
4. O salvamento usa compare-and-swap da revisão.
5. Conteúdo normalizado, auditoria e evento de domínio são persistidos em um único lote D1.
6. A chave de idempotência impede duplicidade de salvamentos repetidos.

## Concorrência e integridade

O primeiro `UPDATE` do lote altera a revisão somente quando ela corresponde a `expectedRevision`. Todas as demais instruções são condicionadas à nova revisão. Em conflito, nenhuma alteração clínica, auditoria ou evento é gravado. Falhas de unidade ou de integridade fazem rollback do lote completo.

## Persistência

- `nf_plan_days`: dias do plano;
- `nf_meals`: refeições;
- `nf_meal_items`: alimentos manuais e referências futuras;
- `nf_plan_notes`: observações estruturadas;
- `nf_plan_versions`: título, observações gerais e revisão;
- `nf_audit_entries`: trilha da alteração;
- `nf_outbox_events`: evento `nutriflow.plan-draft-saved.v1`.

A migração `0023_nutriflow_base_units.sql` inclui oito unidades globais reutilizáveis e é idempotente.

## Feature flag e produção

O fluxo usa obrigatoriamente `nutriflow.editor.enabled`. A flag continua desligada por padrão. Nenhuma rota pública nem interface de produção foi ativada nesta Sprint; o site e o fluxo legado de PDFs permanecem inalterados.

## Evidências

- criação e recuperação de rascunho;
- salvamento normalizado de dia, refeição, alimento e nota;
- recuperação integral do conteúdo;
- replay idempotente;
- conflito de revisão sem gravações parciais;
- rollback por unidade inválida;
- migração de unidades executável mais de uma vez;
- 46 testes automatizados aprovados;
- verificação TypeScript isolada do módulo aprovada.

## Conformidade

Não houve PMA/ADR, mudança estrutural, quebra de contrato público, regressão crítica ou risco novo à integridade ou segurança. O incremento ocorreu por extensão da arquitetura existente.
