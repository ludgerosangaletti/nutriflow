# Modelo opcional do WhatsApp — lembrete de retorno

Use este modelo na Meta somente depois de validar primeiro o fluxo por e-mail.

- Nome: `lembrete_retorno_presencial`
- Categoria: `UTILITY`
- Idioma: `pt_BR`

## Corpo

Olá, {{1}}! Seu retorno com o nutricionista Ludgero Sangaletti está previsto
para {{2}}.

Para confirmar, use o botão abaixo. A conversa será aberta diretamente com o
Ludgero no WhatsApp humano para que o horário seja alinhado em tempo real.

## Botão

- Tipo: visitar site
- Texto: `Confirmar pelo WhatsApp`
- URL base: `https://wa.me/5542999889176?text={{1}}`

Depois que a Meta aprovar o modelo, cadastre no ambiente de produção do site:

`WHATSAPP_RETURN_TEMPLATE_NAME=lembrete_retorno_presencial`

Sem essa variável, o sistema envia normalmente os dois e-mails e registra o
WhatsApp automático como não configurado, sem prejudicar o lembrete.
