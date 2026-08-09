# NutriFlow Training — validação pré-produção controlada

## Escopo e proteção

`nutriflow.training.enabled` permanece desligada por padrão e não deve ser ativada para a organização nesta etapa. A demonstração só pode ocorrer com uma conta já existente, identificada como conta de teste e confirmada pelo administrador.

Use a ação existente de **Homologação controlada** no prontuário dessa conta. Ela cria overrides individuais, auditáveis e com expiração máxima de 90 dias; Training passa a integrar essa mesma lista restrita. Não criar paciente real, não usar uma conta de paciente em atendimento e não criar override organizacional.

Para encerrar o acesso de teste, use a mesma ação para suspender a homologação controlada. Isso remove o direito de acesso sem apagar entitlement, rascunhos, versões, publicações, mídia ou auditoria.

## Migrations

As migrations 0040 e 0041 são aditivas em relação aos módulos de Nutrition: só criam ou alteram tabelas e índices `nf_training_*`. A 0040 é repetível por `IF NOT EXISTS` e pela seed protegida. A 0041 usa `ALTER TABLE ... ADD COLUMN`, operação que o SQLite/D1 não oferece em variante `IF NOT EXISTS`; sua proteção contra reaplicação é o ledger oficial de migrations. Execute-a exclusivamente pelo fluxo oficial uma única vez e confirme o registro de 0041 antes de qualquer nova tentativa. Não a execute manualmente duas vezes.

## Roteiro da demonstração

1. Confirme a conta de teste, a razão e a data de expiração. Ative a Homologação controlada.
2. No prontuário, abra **Treino**, ative o entitlement e crie o rascunho.
3. Monte uma segunda-feira com **Peito** e **Tríceps**. Exemplo mínimo: Supino reto (3 x 8–10, 60 s) e Tríceps pulley (3 x 10–12, 45 s). Publique.
4. Opcionalmente associe uma mídia curta de teste: MP4/H.264 sem áudio, até 8 MiB e 90 s, com poster WebP/JPEG até 500 KiB. Uma mídia indisponível deve exibir o fallback visual, sem esconder a prescrição.
5. Entre somente com a conta controlada e valide: Home → card Treino → treino do dia → navegação SEG–DOM → dia de descanso → abertura sob demanda da demonstração.
6. Altere o rascunho ou a mídia da biblioteca depois da publicação e confirme que a publicação anterior continua mostrando o snapshot original. Revogue o entitlement e confirme que o histórico permanece, mas o Portal volta ao estado comercial.
7. Suspenda a Homologação controlada ao terminar a revisão. Registre a evidência com os IDs da auditoria e da publicação.

## Critérios de parada

Interromper a demonstração e suspender a homologação controlada se houver acesso entre organizações/pacientes, publicação que não respeite o snapshot, prescrição invisível diante de falha de mídia ou regressão do Portal. O rollback operacional é imediato pelo override individual; a flag organizacional continua desligada.
