# Autorização Executiva — Homologação Controlada do MVP NutriFlow

## Estado

Autorização recebida em 1º de agosto de 2026. A construção de novas
funcionalidades fica suspensa durante esta etapa. O escopo permitido é a
ativação individual, observabilidade, estabilização e refinamento do MVP já
aprovado.

## Objetivo

Validar em cenário clínico real o ciclo:

`Consulta → Anamnese → Plano → Meal Templates → Receitas → Publicação → Portal → Avaliação física → Check-in`.

## Guardrails obrigatórios

- flags globais permanecem desligadas;
- ativação somente por `owner` ou `admin`, para um `clientId` específico;
- confirmação explícita de conta de teste;
- validade limitada a no máximo 90 dias;
- ativação e suspensão acrescentam novos overrides, sem apagar o histórico;
- conjunto de flags, auditoria e Domain Event/outbox são persistidos no mesmo
  lote atômico;
- a operação possui chave de idempotência e contrato público `v1`;
- o Portal continua exigindo identidade Supabase validada no servidor,
  propriedade do paciente, acesso vigente e publicação ativa;
- PDF e todos os fluxos produtivos anteriores permanecem compatíveis;
- nenhuma flag organizacional ou global é criada por esta superfície.

## Interrupção obrigatória

A homologação deve parar diante de regressão crítica, necessidade de PMA/ADR,
quebra arquitetural, incompatibilidade de contrato público ou risco à
integridade clínica.

