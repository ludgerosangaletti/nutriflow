# NutriFlow — Autorização Executiva da Fase 1 / Sprint 2

## Status

Autorização registrada em 1º de agosto de 2026. A Sprint 2 e os incrementos subsequentes da Fase 1 podem ser executados em entregas consolidadas, sem validações intermediárias obrigatórias.

## Prioridade autorizada

Construir a primeira interface funcional do Editor NutriFlow sobre a infraestrutura transacional existente, incluindo dias, refeições, alimentos, observações, autosave, indicadores de sincronização e integração com o domínio, mantendo o recurso integralmente protegido pela feature flag desligada.

## Condições permanentes

- preservação integral da Constituição Técnica, do Diagnóstico Arquitetural e do Documento de UX;
- compatibilidade retroativa dos contratos públicos;
- isolamento por organização e autorização por objeto;
- persistência atômica, idempotência, auditoria, observabilidade e Domain Events;
- migrações exclusivamente aditivas;
- nenhuma exposição prematura em produção.

## Interrupção obrigatória

A execução deve ser interrompida se surgir necessidade de PMA/ADR, mudança da arquitetura central, quebra de contrato público, regressão crítica, risco à integridade/auditabilidade dos dados clínicos ou impedimento que dependa de decisão arquitetural.

