# NutriFlow — Autorização Executiva da Fase 1 / Sprint 4

## Status

Autorização registrada em 1º de agosto de 2026 após a aprovação técnica da Sprint 3. A execução foi autorizada de forma consolidada, com uma única revisão ao término da Sprint.

## Objetivo autorizado

Elevar a produtividade clínica do Editor NutriFlow por meio de Meal Templates e Receitas versionados, duplicação e movimentação rápida de conteúdo, pesquisa otimizada, refinamento da experiência de edição e preparação segura para uma futura publicação ao paciente.

## Condições permanentes

- Constituição Técnica, Diagnóstico Arquitetural, Guia do Produto e Documento de UX permanecem normativos;
- contratos públicos `v1` compatíveis e versionados;
- auditoria, Domain Events, outbox, idempotência e persistência atômica obrigatórias;
- isolamento por organização e autorização por objeto;
- migrações exclusivamente aditivas;
- feature flags desligadas para toda funcionalidade ainda não homologada;
- preservação integral do fluxo legado de PDF e do site em produção.

## Interrupção obrigatória

A execução deveria ser interrompida diante de PMA/ADR, alteração da arquitetura central, quebra de compatibilidade, regressão crítica, risco aos dados clínicos/segurança/auditabilidade ou impedimento dependente de decisão arquitetural. Nenhuma dessas condições ocorreu durante a Sprint 4.
