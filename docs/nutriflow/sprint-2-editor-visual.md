# NutriFlow — Fase 1 / Sprint 2

## Resultado

A Sprint 2 entrega a primeira interface funcional do Editor NutriFlow para criação e edição de planos alimentares em rascunho. O editor permanece administrativo, transacional e invisível em produção enquanto `nutriflow.editor.enabled` estiver desligada.

## Interface entregue

- criação do primeiro rascunho estruturado por paciente;
- edição de título e observações gerais;
- criação, seleção, renomeação, reordenação e exclusão de dias;
- criação, edição, reordenação e exclusão de refeições;
- horário e orientações específicas por refeição;
- cadastro manual de alimentos, quantidade escalada, unidade e preparo;
- exclusão de alimentos com normalização automática da ordenação;
- resumo visual de dias, refeições e alimentos;
- layout responsivo para desktop, tablet e celular;
- estados visuais de carregamento, alteração pendente, salvamento, sincronização, erro e conflito.

## Autosave e concorrência

O autosave utiliza debounce de 900 ms, mantém no máximo uma gravação em voo e agenda nova sincronização quando há edição durante o envio. Cada gravação possui chave de idempotência própria, `correlationId` e revisão esperada. Conflitos de revisão retornam estado explícito, sem sobrescrever a versão persistida, e exigem recarga deliberada do profissional.

O salvamento continua sendo processado pelo domínio transacional da Sprint 1. Conteúdo clínico, auditoria e Domain Event permanecem atômicos no D1.

## API administrativa

Foi adicionada a rota interna versionada `v1` para:

- recuperar o rascunho atual;
- criar um rascunho;
- salvar o conteúdo integral do rascunho.

Todas as operações exigem sessão administrativa válida, vínculo ativo com organização, autorização por objeto e feature flag. Os erros públicos usam códigos estáveis e não registram conteúdo clínico em logs.

## Feature flag e produção

O link do editor só é renderizado no prontuário quando a flag está habilitada para o escopo autorizado. A própria rota visual retorna `404` com a flag desligada, e a API rejeita o acesso antes de executar o domínio. A flag continua desligada por padrão e não foi habilitada para organização, paciente ou ambiente de produção.

## Migrações

Nenhuma migração foi necessária. A Sprint reutiliza o esquema aditivo e as unidades globais já aprovadas nas migrações `0020` a `0023`.

## Validações

- 49 testes unitários e de integração aprovados;
- testes do estado visual cobrem montagem, imutabilidade, reordenação e exclusões em cascata;
- validação TypeScript isolada do domínio e do estado do editor aprovada;
- `git diff --check` aprovado;
- build de produção aprovado;
- regressão de HTML renderizado executada no checkpoint final.

## Desempenho operacional

- debounce de autosave: 900 ms;
- apenas uma solicitação de salvamento simultânea por editor;
- nova gravação curta (350 ms) quando há mudanças durante uma requisição em voo;
- consultas e escritas continuam delimitadas por organização e paciente;
- nenhuma tarefa de maior custo computacional foi introduzida nesta Sprint.

## Conformidade

Não houve PMA/ADR, alteração estrutural, quebra de contrato público, regressão crítica ou novo risco à integridade, segurança ou auditabilidade. O incremento ocorreu por extensão da arquitetura aprovada e manteve o fluxo legado de PDF intacto.

