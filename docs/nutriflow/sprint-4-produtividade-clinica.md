# NutriFlow — Fase 1 / Sprint 4

## Resultado

A Sprint 4 transforma conteúdo já montado pelo nutricionista em blocos reutilizáveis e reduz operações repetitivas no editor. A implementação estende o domínio aprovado, sem remodelagem central, PMA/ADR ou alteração destrutiva. O fluxo legado de PDFs continua funcionando sem mudanças.

## Meal Templates

- criação de um modelo a partir da refeição selecionada;
- rascunho e liberação explícita;
- pesquisa por nome;
- aplicação de uma versão liberada como nova refeição completa;
- criação de nova versão a partir da refeição atual;
- arquivamento lógico;
- proveniência `templatePublicId + versionNumber` persistida no plano;
- histórico append-only: uma edição cria nova versão e não reescreve a anterior;
- auditoria e um Domain Event em outbox para cada criação de versão ou arquivamento.

## Receitas

- criação a partir dos alimentos versionados da refeição selecionada;
- ingredientes com revisão de alimento, quantidade, unidade e preparo;
- modo de preparo, rendimento e unidade de rendimento;
- rascunho, liberação, pesquisa, nova versão e arquivamento;
- inclusão no plano como item de receita com referência à versão liberada;
- itens manuais não são convertidos silenciosamente em ingredientes versionados;
- auditoria e outbox persistidas junto da alteração clínica.

## Produtividade do editor

- duplicação de um dia completo, incluindo refeições, itens e observações vinculadas;
- duplicação de refeição e de alimento com novos identificadores;
- movimentação de refeições entre dias pelo próprio cabeçalho;
- reordenação de dias, refeições e alimentos preservada;
- aplicação de template e receita em uma ação;
- pesquisa da Biblioteca Global com debounce de 180 ms, cancelamento de requisições obsoletas e cache local limitado;
- feedback visual de carregamento, sincronização, conflito e confirmação;
- autosave com controle de revisão, repetição transitória e idempotência;
- layout clean e responsivo para desktop, tablet e celular.

## Contratos, domínio e persistência

Foram adicionados contratos públicos `v1` para pesquisa, salvamento/versionamento e arquivamento de Meal Templates e Receitas. As operações passam pelos mesmos limites de autorização, feature flags, idempotência e observabilidade já consolidados.

Os repositórios D1 usam as entidades preparadas na Fase 0. Cada gravação de conteúdo, auditoria e outbox é enviada em um único batch atômico. O isolamento combina `organization_id`, escopo do conteúdo e autorização do ator. Resultados reutilizáveis somente podem ser aplicados quando sua versão está liberada.

## Migração aditiva

`0025_nutriflow_clinical_productivity.sql` adiciona apenas três índices:

- busca do catálogo de alimentos liberados;
- resolução da versão mais recente de Meal Templates;
- resolução da versão mais recente de Receitas.

A migração é idempotente, não remove nem altera colunas, não transforma dados existentes e não habilita feature flags.

## Indicadores de produtividade

### Modelo de interação

- aplicar um Meal Template já localizado: **1 clique** para criar uma refeição completa;
- aplicar uma Receita já localizada: **1 clique** para incluí-la na refeição ativa;
- duplicar um dia completo: **1 clique**;
- duplicar uma refeição: **1 clique**;
- montar uma refeição de três alimentos pela biblioteca: **4 ações principais** — criar a refeição e incluir três resultados — sem contar a digitação da pesquisa;
- montar a mesma refeição por template: **1 ação principal**.

Ainda não existe uma média clínica real de tempo porque as flags permanecem desligadas e não há amostra de uso homologado. Fabricar esse número comprometeria a qualidade da baseline. O editor registra `editor.simple-plan.duration` e a quantidade de ações até uma refeição atingir três itens; a média real será formada na homologação controlada.

### Desempenho e custo estrutural

- pesquisa do catálogo: 1 consulta de domínio, limitada, após 180 ms de debounce;
- pesquisa de Meal Templates: 1 consulta de domínio;
- pesquisa de Receitas: 1 consulta de domínio;
- cache local: retorno sem nova consulta para termos já visitados na sessão;
- primeira versão: 1 batch atômico do repositório;
- nova versão: 2 leituras de resolução mais 1 batch atômico;
- arquivamento: 1 leitura mais 1 batch atômico;
- limite de aplicação: 25 resultados por contrato, 16 usados pelo painel;
- eventos: 1 evento versionado por alteração persistida; replay idempotente não duplica evento.

As operações ainda executam, fora do custo do repositório, a consulta de feature flag e o ciclo de idempotência. A API expõe `Server-Timing` e `x-nutriflow-query-count`, enquanto a interface registra duração de pesquisa, criação de versão, abertura, primeiro autosave e salvamentos, sem conteúdo clínico nos logs.

## Oportunidades posteriores

- favoritos e uso recente para ordenar templates/receitas;
- atalhos de teclado para aplicar o primeiro resultado;
- seleção múltipla e ações em lote;
- drag-and-drop acessível como alternativa à movimentação atual;
- telemetria agregada da homologação para medir p50/p95 e tempo clínico real;
- publicação estruturada ao paciente somente após Sprint específica e homologação formal.

## Segurança de exposição

`nutriflow.editor.enabled`, `nutriflow.catalog.global.enabled`, `nutriflow.recipes.enabled`, `nutriflow.meal_templates.enabled` e `nutriflow.patient_view.enabled` permanecem desligadas por padrão. O código de publicação ao paciente não foi ativado. Nenhuma funcionalidade da Sprint 4 é exposta prematuramente, e o PDF permanece o mecanismo produtivo vigente.

## Validações concluídas

- 61 testes automatizados aprovados;
- build de produção aprovado, incluindo as novas rotas `v1`;
- regressão do HTML renderizado aprovada;
- lint e verificação de tipos aprovados no escopo NutriFlow;
- migração `0025` validada como aditiva e idempotente;
- criação, versionamento, busca e arquivamento testados no esquema real em SQLite/D1;
- rollback atômico, auditoria e outbox conferidos;
- contratos recusam receitas sem ingredientes alimentares versionados;
- duplicação e movimentação preservam ordenação e não colidem identificadores;
- prévia pública e login sem overflow horizontal, sem erro da aplicação e sem entrada visível do NutriFlow;
- feature flags conferidas como desligadas por padrão.
