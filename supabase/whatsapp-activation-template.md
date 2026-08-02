# WhatsApp — ativação da conta presencial

## Modelo para aprovação na Meta

- **Nome:** `ativacao_conta_presencial_v1`
- **Categoria:** `UTILITY`
- **Idioma:** Português (Brasil) — `pt_BR`

### Corpo

Olá, {{1}}! Seu acesso à Área do Paciente de Ludgero Sangaletti está disponível.

Para confirmar seu e-mail, completar seu cadastro e criar sua senha, toque no botão abaixo.

Se precisar de ajuda, responda esta mensagem.

### Botão

- Tipo: acessar site / URL dinâmica
- Texto: `Ativar minha conta`
- URL: `https://ludgerosangaletti.com.br/{{1}}`

## Configuração no site

Depois que a Meta aprovar o modelo, configure a variável de produção:

`WHATSAPP_ACTIVATION_TEMPLATE_NAME=ativacao_conta_presencial_v1`

O parâmetro dinâmico do botão recebe somente o caminho individual de ativação.
O link completo nunca é persistido no banco e um novo link é gerado para cada
reenvio. Nenhum dado clínico é enviado pelo WhatsApp.
