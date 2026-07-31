# NutriFlow — Marco 1.1: Rascunho inicial do plano alimentar

## Escopo aprovado

Este marco inaugura o MVP com a menor fatia clínica vertical segura: criar um
plano alimentar vazio em estado de rascunho e recuperar sua versão de trabalho
mais recente. A operação é exclusivamente administrativa, protegida pela flag
`nutriflow.editor.enabled` e não publica conteúdo ao paciente.

## Entregas

- caso de uso para criação do primeiro rascunho;
- operação de aplicação atravessando a fronteira obrigatória da Fase 0;
- autorização contextual por organização e paciente;
- idempotência persistida para impedir duplicação por repetição da solicitação;
- criação transacional de plano, versão 1, auditoria e Domain Event;
- evento `nutriflow.plan-draft-created.v1` registrado na outbox;
- contrato de resposta `FoodPlanDraftV1` com conteúdo inicialmente vazio;
- porta de leitura independente da infraestrutura;
- adapter D1 para recuperar o rascunho mais recente do paciente;
- teste integrado no schema real comprovando criação, replay e recuperação.

## Fluxo da operação

1. A fronteira resolve e valida a correlação.
2. A flag do editor é avaliada no servidor.
3. O ator é autorizado no escopo da organização e do paciente.
4. A chave idempotente é adquirida.
5. O agregado `FoodPlanDraft` cria a versão inicial e emite o evento.
6. Plano, versão, auditoria e outbox são persistidos no mesmo batch D1.
7. A resposta v1 é armazenada para replay idempotente.
8. A consulta recupera somente um rascunho pertencente à mesma organização e
   ao mesmo paciente.

## Estado inicial do rascunho

- plano: `draft`;
- versão: 1;
- revisão otimista: 1;
- schema do conteúdo: 1;
- dias: vazio;
- refeições: vazio;
- observações estruturadas: vazio;
- publicação: inexistente.

## Limites deliberados

Este marco não inclui:

- tela do editor;
- inclusão, edição, ordenação ou remoção de refeições;
- cadastro manual de alimentos;
- observações do plano;
- revisão ou publicação;
- visualização estruturada na Área do Paciente;
- API pública;
- ativação de feature flag em produção;
- migração de banco.

O painel administrativo existente e o fluxo de upload de PDF permanecem
inalterados. A integração visual será um marco próprio, depois que as operações
de edição do rascunho estiverem aprovadas, evitando uma interface conectada a um
domínio ainda incompleto.

## Compatibilidade e segurança

- nenhuma tabela legada foi modificada;
- nenhuma publicação clínica existente foi alterada;
- nenhuma flag foi habilitada em produção;
- a leitura usa `organization_id + client_id`, impedindo vazamento entre
  organizações;
- a criação exige papel administrativo autorizado;
- a resposta não contém conteúdo clínico além do título escolhido;
- auditoria e evento usam o mesmo identificador de correlação da operação.

## Validação

- uma solicitação válida cria exatamente um plano e uma versão;
- auditoria e outbox são criadas no mesmo commit;
- replay com a mesma chave devolve a mesma resposta sem nova escrita;
- o rascunho recuperado é equivalente ao criado;
- o conteúdo inicial é imutável na resposta e está no schema v1;
- a regressão integral do projeto deve passar antes do checkpoint.

## Avaliação dos critérios arquiteturais

| Critério | Avaliação |
| --- | --- |
| C01 — Compatibilidade retroativa | Preservada; somente novos casos de uso e adapter foram adicionados. |
| C02 — Remodelagem | Não necessária; o marco utiliza o schema aprovado na Fase 0. |
| C03 — Auditoria e versionamento | Aplicados desde a criação, com versão e revisão explícitas. |
| C04 — Planos publicados | Não afetados; o marco opera apenas com rascunhos novos. |
| C05 — Extensão | Implementação integralmente aditiva. |
| C06 — Acoplamento | Aplicação depende de portas; D1 permanece na infraestrutura. |
| C07 — Escalabilidade | Toda leitura e escrita é escopada por organização. |
| C08 — Latência crítica | Não afeta rotas atuais; a operação ainda não está exposta. |

## PMA/ADR

Não foi necessária Proposta de Mudança Arquitetural. A implementação segue os
contratos, o domínio, o Unit of Work, os Domain Events e a estratégia de feature
flags aprovados na Fase 0.

## Próximo portão

O Marco 1.2 somente poderá começar após aprovação formal. A recomendação é
implementar a edição concorrente do conteúdo do rascunho — título, observações,
dias e refeições — com revisão otimista, autosave controlado e histórico
auditável, ainda sem publicação ao paciente.
