# NutriFlow — Marco 0.5: Encerramento da Fase 0

## Escopo aprovado

Este marco encerra a Fase 0 por meio de uma fronteira única de aplicação que
compõe correlação, telemetria, feature flag, autorização e idempotência. Também
fecha a administração interna e auditável de overrides de flags. Nenhuma tela,
rota pública, editor ou visualização estruturada do paciente é ativada.

## Entregas

- `NutriFlowOperationRunner` como fronteira padrão para operações futuras;
- correlação resolvida antes da execução e propagada para a telemetria;
- avaliação server-side de feature flag antes do caso de uso;
- autorização sobre ator, organização e recurso antes da execução;
- idempotência opcional para comandos mutáveis;
- erro estável e seguro quando uma função estiver desligada;
- ação administrativa exclusiva para configuração de feature flags;
- override append-only por organização ou conta de teste;
- configuração de override e auditoria no mesmo Unit of Work D1;
- precedência determinística para o override válido mais recente;
- desligamento lógico seguro por novo override, sem apagar histórico;
- testes integrados de composição, isolamento, atomicidade e rollback lógico.

## Fronteira de aplicação

Toda futura operação exposta pelo NutriFlow deverá atravessar, nesta ordem:

1. resolução do identificador de correlação;
2. início da observabilidade operacional;
3. avaliação server-side da feature flag;
4. autorização contextual;
5. idempotência, quando a operação puder produzir efeitos;
6. execução do caso de uso;
7. encerramento da telemetria com código estável.

Essa fronteira não depende de HTTP, React, D1 ou outro framework. Adaptadores de
entrada futuros deverão depender dela, e nunca reproduzir essas regras.

## Administração segura de feature flags

Somente atores internos com papel `owner` ou `admin` podem registrar overrides.
Nutricionistas, pacientes e identidades de serviço não recebem essa permissão.
Cada alteração exige justificativa, correlação, escopo explícito e gera um
registro de auditoria na mesma transação.

Overrides são append-only. Desligar uma função cria uma nova decisão auditável,
em vez de remover ou sobrescrever a anterior. Isso permite rollback lógico
imediato, mantém o histórico reproduzível e evita alterações destrutivas.

## Estado de ativação

Todas as flags permanecem desligadas por padrão e nenhum override foi criado em
produção. O editor administrativo, a publicação estruturada, a leitura pelo
paciente e futuras integrações continuam indisponíveis. Os testes usam somente
banco efêmero e contas simuladas.

## Compatibilidade e isolamento

- o fluxo legado de PDF permanece integralmente ativo e inalterado;
- autenticação, convites, painel administrativo e Área do Paciente não mudam;
- não existem novas rotas `/api/v1/nutriflow`;
- não há alteração de schema ou nova migração neste marco;
- não existem chamadas externas, jobs ou mensagens reais;
- o domínio permanece independente da interface e da infraestrutura;
- a configuração operacional depende de portas da aplicação e adapter D1.

## Matriz de encerramento da Fase 0

| Gate | Evidência | Estado |
| --- | --- | --- |
| Estrutura modular | domínio, aplicação, infraestrutura e contratos separados | Atendido |
| Schema isolado | tabelas `nf_` e migrações estritamente aditivas | Atendido |
| Domínio extensível | agregados, snapshots, revisões e eventos versionados | Atendido |
| Unit of Work | estado, auditoria, outbox e flags com commit atômico | Atendido |
| Domain Events | envelope versionado, metadados e outbox confiável | Atendido |
| Contratos públicos | contratos v1 e erros estáveis preparados, sem exposição prematura | Atendido |
| Segurança | autorização por organização, papel, recurso e vigência | Atendido |
| Resiliência | idempotência, leases, retry, dead-letter e consumidores idempotentes | Atendido |
| Feature flags | default off, resolução server-side e overrides auditáveis | Atendido |
| Observabilidade | correlação e telemetria sem conteúdo clínico | Atendido |
| Compatibilidade | fluxo PDF e funcionalidades atuais preservados | Atendido |
| Testes | unidade, integração D1, migração, atomicidade e regressão | Atendido |

## Avaliação formal dos critérios arquiteturais

| Critério | Avaliação |
| --- | --- |
| C01 — Quebra compatibilidade retroativa? | Não. A fronteira e a configuração de flags são extensões internas. |
| C02 — Exige remodelagem do banco ou domínio? | Não. O marco reutiliza o schema e as portas aprovadas. |
| C03 — Afeta auditoria ou versionamento? | Reforça ambos: toda alteração operacional é append-only, correlacionada e auditada. |
| C04 — Altera planos publicados? | Não. Nenhum plano clínico é criado, publicado ou modificado. |
| C05 — Pode ser implementado por extensão? | Sim. A solução adiciona casos de uso e composição sobre os contratos existentes. |
| C06 — Introduz acoplamento? | Não. Entrada, aplicação, domínio e D1 permanecem separados por portas. |
| C07 — Compromete escala horizontal? | Não. Os mecanismos são persistidos, escopados e independentes de processo local. |
| C08 — Aumenta latência crítica? | Não materialmente. A fronteira executa verificações necessárias e mantém efeitos externos assíncronos. |

## PMA/ADR

Não foi necessária Proposta de Mudança Arquitetural. O marco consolida os
mecanismos obrigatórios já aprovados e não altera contratos, domínio central ou
comportamento clínico publicado.

## Conclusão e portão de revisão

Com as evidências acima, a Fase 0 está tecnicamente completa. Isso não autoriza
automaticamente o início do MVP nem a ativação de qualquer feature flag. O
próximo trabalho deverá ser aprovado formalmente e avançar como uma fatia
vertical controlada, mantendo o PDF em coexistência e atravessando a fronteira
de aplicação consolidada neste marco.
