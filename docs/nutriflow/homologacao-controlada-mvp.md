# NutriFlow — Homologação Controlada do MVP

## Incremento de habilitação

Foi criada uma superfície compacta no prontuário administrativo de cada
paciente. Ela permanece recolhida quando inativa e apresenta:

- estado consolidado das cinco flags necessárias ao MVP;
- alerta quando uma ativação antiga não corresponde ao perfil controlado;
- checklist automático das nove etapas do ciclo clínico;
- progresso percentual;
- prazo de expiração;
- ativação individual com confirmação explícita;
- suspensão imediata por novo override append-only.

As flags controladas são:

1. `nutriflow.editor.enabled`;
2. `nutriflow.catalog.global.enabled`;
3. `nutriflow.meal_templates.enabled`;
4. `nutriflow.recipes.enabled`;
5. `nutriflow.patient_view.enabled`.

`nutriflow.realtime_updates.enabled` e `nutriflow.domain_events.enabled` não são
ativadas. O fluxo atual já persiste Domain Events na outbox; o despacho e a
atualização por canal em tempo real não são pré-requisitos para a homologação
clínica do MVP.

## Segurança e isolamento

O endpoint administrativo usa sessão Supabase validada no servidor e resolve o
vínculo ativo do profissional com a organização. A autorização reutiliza a
matriz do domínio: nutricionistas podem operar o editor quando liberado, mas
somente `owner` e `admin` configuram flags.

O paciente não informa identificadores de paciente ou publicação ao Portal. A
API deriva `clientId` da identidade Supabase validada, verifica acesso vigente,
flag individual e publicação ativa, prevenindo acesso horizontal indevido.

Todas as respostas autenticadas usam `private, no-store`. Nenhuma chave secreta
é enviada ao navegador.

## Auditoria e rastreabilidade

Cada ativação ou suspensão grava no mesmo lote atômico:

- cinco overrides individuais;
- uma entrada de auditoria;
- um Domain Event `nutriflow.homologation-access-configured.v1` na outbox.

A abertura de um plano publicado no Portal registra
`patient-portal.viewed`, sem conteúdo clínico, permitindo comprovar a etapa de
visualização durante a homologação.

## Idempotência

O endpoint `POST /api/admin/nutriflow/homologation` exige
`Idempotency-Key`. Repetições do mesmo comando retornam o resultado persistido;
reuso da chave com conteúdo diferente é rejeitado.

## Métricas iniciais

As APIs expõem `Server-Timing`, versão pública e contagem conhecida de consultas.
Os logs registram apenas duração, tipo de ação, quantidade de flags e presença
de plano publicado; nenhuma resposta clínica é enviada à telemetria.

## Estado de exposição

Os defaults permanecem desligados. Esta entrega apenas cria o controle
individual; nenhuma conta é ativada automaticamente e nenhuma funcionalidade é
liberada globalmente.

## Roteiro de validação manual

1. abrir o prontuário da conta fake autorizada;
2. expandir **Homologação controlada**;
3. confirmar a conta de teste, escolher o prazo e ativar;
4. validar o Editor NutriFlow, a Biblioteca, Meal Templates e Receitas;
5. construir e publicar uma versão;
6. entrar manualmente na conta fake do paciente e abrir o plano;
7. publicar/consultar avaliação física;
8. enviar um check-in;
9. confirmar o checklist completo e suspender a homologação ao final.

## Critério de encerramento

O parecer de aptidão para uso clínico contínuo somente será emitido após o
roteiro manual com a conta de teste, coleta das métricas reais, registro das
inconsistências e reteste das correções.

