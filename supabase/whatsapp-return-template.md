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

## Botões de resposta rápida

- `Confirmar retorno`
- `Remarcar retorno`
- `Cancelar retorno`

O webhook reconhece tanto os textos acima quanto os identificadores:

- `confirmar_retorno`
- `remarcar_retorno`
- `cancelar_retorno`

Depois que a Meta aprovar o modelo, cadastre no ambiente de produção do site:

`WHATSAPP_RETURN_TEMPLATE_NAME=lembrete_retorno_presencial`

Sem essa variável, o sistema envia normalmente os dois e-mails e registra o
WhatsApp automático como não configurado, sem prejudicar o lembrete.

## Aviso administrativo no WhatsApp humano

Crie um segundo modelo:

- Nome: `alerta_retorno_paciente`
- Categoria: `UTILITY`
- Idioma: `pt_BR`

Corpo:

`Agenda presencial: {{1}} — {{2}} — {{3}}. Confira a solicitação no painel administrativo.`

Variáveis:

1. nome do paciente;
2. ação realizada;
3. data e horário envolvidos.

Depois da aprovação, cadastre:

`WHATSAPP_ADMIN_RETURN_TEMPLATE_NAME=alerta_retorno_paciente`

O aviso será enviado para o WhatsApp humano `+55 42 99987-6280`. Enquanto esse
segundo modelo não estiver aprovado, o aviso administrativo continuará sendo
enviado por e-mail.
