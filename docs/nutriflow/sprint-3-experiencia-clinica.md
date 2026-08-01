# NutriFlow — Fase 1 / Sprint 3

## Resultado

A Sprint 3 transforma o Editor NutriFlow em uma superfície mais próxima da rotina clínica, mantendo toda a funcionalidade não homologada protegida por feature flags desligadas. O incremento reutiliza integralmente o domínio, os contratos e o modelo relacional da Fase 0; não houve PMA/ADR nem remodelagem central.

## Biblioteca Global de Alimentos

- contrato público próprio em `v1`;
- catálogo inicial curado com 30 alimentos de uso frequente;
- revisões liberadas e imutáveis, com nome, categoria, sinônimos, quantidade e unidade de referência;
- pesquisa por nome e aliases;
- filtro por categoria;
- resultados limitados e ordenados por relevância;
- catálogo global combinado com futuros alimentos da organização sem violar o isolamento;
- uma consulta de catálogo por pesquisa;
- cache por termo/categoria, debounce de 180 ms e cancelamento de requisições obsoletas.

O catálogo inicial não declara valores nutricionais. As entidades de nutrientes permanecem preparadas no domínio, mas nenhum dado clínico estimado ou sem fonte foi introduzido.

## Inclusão e edição no plano

Ao incluir um alimento da biblioteca, o plano armazena a identidade pública e o número da revisão, além de snapshots de nome, quantidade e unidade. Isso preserva reprodutibilidade e permite que o nutricionista edite no plano:

- nome exibido;
- quantidade;
- unidade;
- preparo/detalhe;
- observação clínica ou orientação;
- posição na refeição.

A proveniência e a revisão de origem permanecem imutáveis por decisão arquitetural.

## Produtividade e UX

- refeição selecionada visualmente como destino da biblioteca;
- pesquisa por teclado com setas e `Enter`;
- duplicação de refeição e alimento;
- reordenação de alimentos;
- cadastro manual preservado;
- atalho `Ctrl/⌘ + S`;
- skeleton de abertura;
- mensagens separadas de sincronização, conflito e confirmação;
- componentes reutilizáveis para carregamento, sincronização e avisos;
- layout responsivo para desktop, tablet e celular.

## Autosave

- debounce reduzido de 900 ms para 750 ms;
- estado mais recente atualizado de forma síncrona antes do agendamento;
- no máximo uma gravação em voo;
- nova gravação automática quando ocorre edição durante o envio;
- uma repetição curta para falha transitória, reutilizando a mesma chave de idempotência;
- aviso de saída quando há conteúdo pendente;
- conflito de revisão continua bloqueando sobrescrita silenciosa.

## Receitas e Meal Templates

O registro padronizado de ferramentas do editor já contém Biblioteca, Receitas e Meal Templates com alvos de inserção distintos. Receitas e Meal Templates permanecem no estado `prepared`, usando as entidades versionadas da Fase 0 e suas flags independentes (`nutriflow.recipes.enabled` e `nutriflow.meal_templates.enabled`). Nenhuma interface incompleta é renderizada.

## Migração aditiva

`0024_nutriflow_global_food_catalog.sql`:

- adiciona somente um índice de busca case-insensitive;
- inclui 30 alimentos globais e suas primeiras revisões liberadas;
- é idempotente;
- não altera nem remove tabelas ou colunas existentes;
- não habilita nenhuma feature flag.

## Indicadores de desempenho

### Instrumentação entregue

- `editor.open.duration`: tempo de abertura do editor;
- `editor.first-autosave.duration`: primeira alteração até confirmação do autosave;
- `editor.save.duration`: duração de cada salvamento;
- `catalog.search.duration`: duração da pesquisa e quantidade de resultados;
- `Server-Timing`: duração das APIs administrativas;
- `x-nutriflow-query-count`: consultas do domínio principal.

Os tempos médios reais não são reportados como produção porque as flags continuam desligadas e, portanto, ainda não existe amostra clínica real. A instrumentação está pronta para formar a primeira baseline durante a homologação controlada, sem registrar conteúdo clínico.

### Custos estruturais

- abertura do rascunho: 5 consultas de conteúdo, sendo 4 executadas em paralelo após localizar a versão;
- pesquisa do catálogo: 1 consulta, limitada a 25 resultados;
- salvamento: 5 consultas de recuperação e 1 batch atômico com `8 + dias + refeições + alimentos + notas` statements;
- eventos: 1 evento `nutriflow.plan-draft-saved.v1` por edição efetivamente persistida; replay idempotente não publica novo evento;
- primeira tentativa de autosave: 750 ms de debounce mais o tempo de rede/persistência.

## Validações

- 55 testes automatizados aprovados;
- build de produção concluído;
- regressão de HTML renderizado aprovada;
- lint e verificação de tipos aprovados no escopo NutriFlow;
- migração idempotente e catálogo com 30 revisões liberadas;
- pesquisa por nome, sinônimos e categoria em uma consulta;
- contrato limitado contra pesquisas de custo excessivo;
- inclusão de snapshot versionado;
- edição de todas as propriedades permitidas;
- duplicação e reordenação sem colisões de identificadores;
- feature flags futuras desligadas;
- inspeção visual da página pública e do acesso do paciente sem overflow horizontal;
- nenhuma entrada do NutriFlow visível com as flags desligadas.

## Estado de produção

`nutriflow.editor.enabled`, `nutriflow.catalog.global.enabled`, `nutriflow.recipes.enabled` e `nutriflow.meal_templates.enabled` permanecem desligadas por padrão. Nenhuma funcionalidade da Sprint 3 foi exposta prematuramente, e o fluxo legado de PDFs permanece intacto.
