# Relatórios profissionais em PDF

## Fonte oficial dos dados

O relatório do plano alimentar é gerado exclusivamente do `snapshot_json` da versão publicada apontada por `nf_publications`. O relatório clínico utiliza os snapshots imutáveis de `nf_clinical_assessments`; fórmulas atuais não recalculam avaliações históricas.

Receitas referenciadas pelo plano são hidratadas pela versão imutável indicada no próprio item. Fotografias só entram no comparativo quando pertencem exatamente ao mês de cada avaliação selecionada, evitando associações clínicas ambíguas.

## Rotas

- Paciente — plano: `/api/nutriflow/v1/plan-pdf`
- Administrador — plano: `/api/admin/nutriflow/plan-report?email=...`
- Paciente — evolução (primeira × mais recente): `/api/evolucao/relatorio`
- Administrador — evolução: `/api/admin/clinical-assessments/report?email=...&from=...&to=...`

Todas as rotas exigem a autorização correspondente, retornam `application/pdf`, usam cache privado desabilitado e não recebem dados clínicos arbitrários da interface.

## Identidade e composição

Os documentos compartilham cabeçalho institucional, logotipo, tipografia, cores discretas, rodapé com data/versão/paginação e margens A4. O plano apresenta identificação, vigência, objetivo, energia, estratégias, refeições, opções, itens, trocas, receitas e orientações. O comparativo apresenta resumo executivo, composição corporal, circunferências, fotografias disponíveis, gráficos e síntese não diagnóstica.

## Consistência e compatibilidade

- Nenhuma migration foi alterada ou criada.
- Contratos públicos existentes foram preservados.
- O fluxo histórico de PDFs continua acessível como contingência.
- Publicações antigas sem nutrientes ou receita completa permanecem geráveis e recebem apresentação segura para dados ausentes.
- O conteúdo clínico é derivado de snapshots; a geração não grava nem modifica prontuário.

## Validação

Os geradores possuem testes automatizados de assinatura PDF e paginação. Os exemplos anonimizados são renderizados com Poppler para inspeção visual de margens, quebras de página, legibilidade e consistência A4.
