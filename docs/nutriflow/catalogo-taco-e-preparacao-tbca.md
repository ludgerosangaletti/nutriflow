# Catálogo TACO e preparação da TBCA

## Escopo desta entrega

O catálogo global do NutriFlow passa a coexistir com a importação integral da tabela principal da TACO, 4ª edição. A importação é aditiva, versionada e não modifica alimentos manuais, alimentos da organização ou as revisões já publicadas.

## Proveniência reproduzível

- Fonte: NEPA/Unicamp — Tabela Brasileira de Composição de Alimentos, 4ª edição.
- Arquivo oficial: `taco-4a-edicao.xlsx`.
- SHA-256: `a66b8ec528daeabc63bc2b015fc9bd8c6d76b941c2fc0ed93a4311d449302d14`.
- Importação: 597 alimentos, 15 categorias, 26 componentes e 13.407 valores nutricionais.
- Base de referência: 100 g da parte comestível.
- Identificadores: `food_taco_NNNN` e `foodrev_taco_NNNN_v1`.

Valores numéricos são armazenados em escala 1.000. `Tr` é preservado como zero com origem `taco:trace`; `NA` e células vazias não geram valor nutricional, evitando interpretar ausência como zero.

## Compatibilidade e prioridade de busca

A API pública permanece em `v1`. O campo `source` foi adicionado como opcional, preservando consumidores existentes. A ordenação prioriza alimentos próprios da organização, depois TACO e, por fim, o catálogo global clínico legado. A busca continua sendo feita em uma consulta e aceita nome, sinônimos e categoria.

## TBCA

A fonte TBCA 7.3 foi registrada apenas como estrutura preparada, com status `blocked_pending_commercial_authorization`. Nenhum alimento ou nutriente da TBCA foi copiado. A importação somente poderá ser habilitada após autorização formal compatível com o uso comercial da plataforma e uma revisão de proveniência.

## Totais nutricionais futuros

O domínio contém um cálculo puro para escalar nutrientes de referências por massa. A exposição de totais permanece protegida pela flag `nutriflow.nutrition_totals.enabled`, desligada por padrão e fora da homologação controlada. Valores ausentes permanecem `null`; nenhum total incompleto é apresentado como completo.
