# NutriFlow — Fase 1 / Sprint 5

## Resultado executivo

A Sprint 5 introduz a primeira experiência estruturada do paciente, mantendo o plano alimentar como elemento central e preservando integralmente o fluxo legado de PDF. O módulo foi implementado e validado, mas permanece protegido pela Feature Flag `nutriflow.patient_view.enabled`, desligada por padrão.

Nenhuma funcionalidade da Sprint foi exposta prematuramente em produção.

## Funcionalidades implementadas

### Dashboard e plano alimentar

- Nova rota autenticada `/plano-alimentar`;
- cabeçalho contextual para acompanhamento online ou presencial;
- status de publicação e sincronização;
- navegação horizontal por dias;
- refeições ordenadas, com horários flexíveis ou definidos;
- alimentos com quantidade, unidade, preparo e observações;
- receitas identificadas e com modo de preparo;
- substituições organizadas por grupo e alternativas;
- orientações gerais e notas destinadas ao paciente;
- estado vazio compatível com o período de transição para o plano estruturado.

### Publicação controlada

- Novo endpoint administrativo idempotente `POST /api/admin/nutriflow/publications`;
- ação de publicação disponível somente dentro do editor já protegido por flag;
- confirmação explícita antes da publicação;
- validação de refeições vazias e revisão concorrente;
- geração de snapshot e SHA-256;
- estado clínico, publicação, auditoria e outbox gravados no mesmo batch atômico;
- versão publicada protegida pelos gatilhos de imutabilidade já existentes;
- publicação não implica exposição: o paciente só recebe o conteúdo com a flag própria homologada.

### Continuidade da experiência atual

- O card NutriFlow só aparece na Área do Paciente quando a flag está ativa para a organização ou para o paciente;
- PDFs permanecem disponíveis e não foram alterados;
- check-ins existentes continuam sendo a fonte inicial da evolução de peso;
- avaliação física continua sendo o PDF atual, agora representado também no dashboard estruturado;
- consultoria online e atendimento presencial utilizam o mesmo portal com contextualização de modalidade.

### Preparação para aplicativo

Foi criado o endpoint público versionado `GET /api/nutriflow/v1/portal`. O contrato v1 não depende de componentes React e pode ser consumido futuramente por Android, iOS e demais canais.

O endpoint:

- deriva o paciente exclusivamente da sessão Supabase validada no servidor;
- não aceita `clientId`, e-mail ou identificador de publicação fornecido pelo navegador;
- aplica autorização por identidade, paciente, vigência e escopo;
- retorna somente a publicação ativa;
- utiliza `Cache-Control: private, no-store` para dados clínicos;
- expõe correlação, versão, `Server-Timing` e contagem de consultas sem registrar conteúdo clínico nos logs.

## Arquitetura e separação de responsabilidades

- `contracts/v1/patient-portal.ts`: contrato público estável;
- `application/portal/get-patient-portal.ts`: autorização e caso de uso;
- `application/ports/patient-portal-repository.ts`: porta de leitura;
- `infrastructure/d1/d1-patient-portal-repository.ts`: projeção D1;
- `app/api/nutriflow/v1/portal/route.ts`: adaptador HTTP;
- `app/plano-alimentar/*`: interface do paciente;
- `app/nutriflow/server.ts`: composição de dependências e resolução segura da identidade.

O domínio não depende da interface. O portal consome snapshots publicados imutáveis e não modifica rascunhos, publicações, auditoria ou outbox.

## Persistência e migração

A migração `0026_nutriflow_patient_portal.sql` é exclusivamente aditiva e cria apenas índices de leitura para:

- publicação ativa mais recente;
- documentos de avaliação física;
- histórico de check-ins e peso.

Nenhuma tabela, coluna ou dado existente foi removido ou reescrito.

## Segurança e privacidade

- Autenticação Supabase validada por `auth.getUser()` no servidor;
- ausência de autorização baseada em `user_metadata`;
- proteção contra IDOR por não aceitar identificadores de paciente no endpoint;
- isolamento por organização e paciente;
- bloqueio de contas suspensas e vigências expiradas;
- publicação revogada não é entregue;
- erros retornam códigos estáveis e mensagens seguras;
- logs operacionais não incluem nome, e-mail, peso, plano ou conteúdo clínico.

## Responsividade e acessibilidade

- Layout adaptado a desktop, tablet e celular;
- navegação de dias com rolagem horizontal segura em telas estreitas;
- cards em coluna única abaixo de 860 px;
- alimentos reorganizados sem corte de quantidades abaixo de 600 px;
- elementos interativos nativos (`button`, `nav`, `details`, `summary`);
- textos e estados com rótulos explícitos;
- gráfico de peso com descrição acessível.

## Testes e regressão

- 65 testes unitários e de integração: aprovados;
- teste do contrato e projeção do Portal do Paciente: aprovado;
- autorização cruzada e expiração de vigência: aprovadas;
- publicação atômica, auditoria, outbox e imutabilidade: aprovadas;
- migração aditiva 0026: aprovada;
- build de produção em cinco etapas: aprovado;
- validação do artefato Sites: aprovada;
- regressão HTML do site público: aprovada;
- fluxo legado de PDF: preservado.

## Indicadores técnicos

- projeção do contrato completo em teste automatizado: aproximadamente 1,7 ms;
- endpoint do portal: máximo conhecido de 6 consultas D1 por abertura (contexto, flag, publicação, peso, avaliação e check-in);
- consulta de publicação utiliza índice composto por organização, paciente, status e data;
- volume de Domain Events por leitura: zero, porque leituras não alteram o domínio;
- cache clínico: desativado deliberadamente;
- métrica operacional disponível em `Server-Timing` e `nutriflow.portal.metric`.

Métricas de rede reais serão coletadas somente na homologação controlada, quando a flag for ativada para uma conta de teste. Medir antes disso exigiria exposição indevida ou dados artificiais no ambiente produtivo.

## Conformidade

- Compatibilidade retroativa: preservada;
- contratos públicos versionados: preservados;
- versionamento e imutabilidade de publicação: preservados;
- auditoria e Domain Events de escrita: inalterados;
- idempotência e persistência atômica: inalteradas;
- isolamento por organização: preservado;
- migração exclusivamente aditiva: confirmada;
- Feature Flag desligada: confirmada;
- PMA/ADR: não necessário.

## Próxima homologação recomendada

1. Aplicar a migração 0026 no ambiente de homologação;
2. criar ou selecionar uma publicação estruturada de teste;
3. ativar `nutriflow.patient_view.enabled` somente para a conta de teste;
4. validar desktop, iPhone e Android;
5. confirmar receitas, substituições, avaliação física, peso e check-in;
6. revisar métricas reais de abertura;
7. desligar a flag ou ampliar o rollout somente após aprovação formal.
