# NutriFlow — Autorização Executiva da Fase 1

## Status

Autorização registrada em 31 de julho de 2026. A execução da Fase 1 passa a ocorrer em Sprints consolidadas, sem aprovações intermediárias obrigatórias.

## Condições permanentes

- aderência integral à arquitetura e à Constituição Técnica aprovadas;
- compatibilidade dos contratos públicos;
- feature flags desligadas para recursos não homologados;
- preservação do site público e das funções em produção;
- auditoria, observabilidade, autorização, versionamento e idempotência obrigatórios;
- ausência de regressões críticas.

## Interrupção obrigatória

A Sprint deve ser interrompida e submetida à revisão se houver necessidade de PMA/ADR, mudança estrutural, quebra de contrato público, regressão crítica ou risco à integridade dos dados ou à segurança.

## Entrega

Cada revisão deverá consolidar os incrementos relacionados, evidências de testes, riscos residuais, estado das feature flags e confirmação expressa sobre a existência — ou não — de gatilho de interrupção.
