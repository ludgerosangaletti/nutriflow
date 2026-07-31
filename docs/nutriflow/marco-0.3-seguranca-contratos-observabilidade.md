# NutriFlow — Marco 0.3: Segurança, contratos e observabilidade

## Escopo aprovado

Este marco conclui os gates não visuais de segurança e contratos da Fase 0.
Nenhuma rota pública, tela, editor ou leitura estruturada do paciente foi
ativada. A autenticação atual continua sob responsabilidade do Supabase; o
NutriFlow passa a possuir a camada de autorização que deve ser aplicada depois
da autenticação e antes de qualquer caso de uso futuro.

## Entregas

- contexto explícito de identidade para equipe, paciente e serviços internos;
- matriz de autorização por ação, organização, paciente, vigência e publicação;
- negação segura por padrão e erros de aplicação estáveis;
- contratos públicos v1 para comandos, queries, DTO publicado, sucesso e erro;
- validação em runtime de versão, campos, limites e conteúdo aninhado;
- mapeamento de DTOs que não permite serializar objetos internos ou campos de
  transporte desconhecidos;
- geração ou propagação validada de `correlation_id`;
- telemetria mínima de operação: nome, correlação, resultado, duração e código
  de erro, sem conteúdo clínico;
- testes negativos de autorização, contratos e observabilidade.

## Matriz de autorização

| Identidade | Escopo permitido | Restrições obrigatórias |
| --- | --- | --- |
| Owner | Comandos e queries administrativas | Associação ativa e mesma organização do recurso. |
| Admin | Comandos e queries administrativas | Associação ativa e mesma organização do recurso. |
| Nutricionista | Criar, ler, editar, revisar, publicar e revogar | Associação ativa e mesma organização do recurso. |
| Paciente | Ler publicação estruturada | Conta ativa, mesmo `client_id`, vigência ativa e publicação ativa. |
| Serviço interno | Ler publicação para consumidor autorizado | Mesma organização, publicação ativa e escopo explícito `nutriflow:read-published`. |

Feature flag não substitui autorização. Mesmo quando uma flag for ativada em
marco futuro, a política continuará sendo verificada no servidor para o objeto
solicitado.

## Contratos v1

Os parsers aceitam `unknown`, validam o contrato e produzem objetos imutáveis.
Eles cobrem:

- criação de plano;
- salvamento de rascunho e conteúdo aninhado;
- publicação de versão;
- consulta de publicação pelo paciente;
- DTO de plano publicado;
- envelope de erro com `errorCode`, mensagem segura e `correlationId`.

Versões diferentes de `v1`, quantidades não positivas, revisões inválidas,
campos obrigatórios vazios e estruturas aninhadas inválidas são rejeitados
antes de alcançar domínio ou persistência.

## Códigos de erro estáveis

- `NF_FEATURE_DISABLED`
- `NF_INVALID_INPUT`
- `NF_UNAUTHENTICATED`
- `NF_NOT_FOUND`
- `NF_VERSION_CONFLICT`
- `NF_FORBIDDEN`
- `NF_ACCESS_EXPIRED`
- `NF_IDEMPOTENCY_CONFLICT`
- `NF_PUBLICATION_IMMUTABLE`
- `NF_INTERNAL_ERROR`

Mensagens públicas são pré-definidas. Exceções internas, SQL, dados clínicos e
detalhes de provider não entram no envelope nem nas métricas.

## Observabilidade mínima

Toda operação futura deverá receber um `correlation_id` válido e propagá-lo
para auditoria, Domain Events, outbox e telemetria. O registro operacional
contém somente:

- nome estável da operação;
- `correlation_id`;
- sucesso ou erro;
- duração em milissegundos;
- código de erro estável, quando aplicável.

O contrato da telemetria não aceita plano, paciente, refeição, anamnese ou outro
conteúdo clínico, reduzindo o risco de vazamento em logs.

## Compatibilidade e isolamento

- não houve migração de banco neste marco;
- o fluxo de PDF, autenticação, painel e Portal do Paciente não foi alterado;
- não foram criadas rotas `/api/v1/nutriflow`;
- todas as feature flags continuam desligadas;
- nenhum plano ou documento clínico existente foi modificado;
- o domínio continua sem dependência de Supabase, D1, HTTP ou interface.

## Validação do marco

- equipe suspensa é negada;
- acesso entre organizações é negado;
- paciente não pode ler plano de outro `client_id`;
- vigência expirada e publicação revogada são negadas;
- serviço interno sem escopo explícito é negado;
- versões e payloads inválidos são rejeitados antes da persistência;
- campos inesperados não vazam para DTOs mapeados;
- erros públicos não expõem falhas internas;
- telemetria registra códigos e latência sem conteúdo clínico;
- regressão integral da aplicação é executada antes do checkpoint.

## Avaliação formal dos critérios arquiteturais

| Critério | Avaliação |
| --- | --- |
| C01 — Quebra compatibilidade retroativa? | Não. Os contratos v1 ainda não estavam expostos e o sistema legado não foi alterado. |
| C02 — Exige remodelagem do banco ou domínio? | Não. A implementação adiciona políticas e validadores na camada de aplicação. |
| C03 — Afeta auditoria ou versionamento? | Reforça ambos ao exigir versão e `correlation_id`, sem mudar registros anteriores. |
| C04 — Altera planos publicados? | Não. Não existe mutação ou migração de conteúdo clínico. |
| C05 — Pode ser implementado por extensão? | Sim. Foram adicionadas políticas, contratos e portas sobre a fundação existente. |
| C06 — Introduz acoplamento? | Não. Autenticação externa será adaptada para um contexto interno; a política não depende do Supabase. |
| C07 — Compromete escala horizontal? | Não. Organização, objeto e escopos de serviço são dimensões obrigatórias da decisão. |
| C08 — Aumenta latência crítica? | O custo é determinístico e local; nenhuma chamada externa foi adicionada. |

## PMA/ADR

Não foi necessária Proposta de Mudança Arquitetural. O marco implementa
diretamente os gates de segurança, contratos e observabilidade definidos na
Constituição Técnica.

## Limites e próximo portão de revisão

O Marco 0.3 não cria handlers HTTP, casos de uso completos, idempotência
persistida, processador da outbox, editor, preview ou leitura do paciente. O
próximo marco somente poderá começar após aprovação formal desta entrega.

