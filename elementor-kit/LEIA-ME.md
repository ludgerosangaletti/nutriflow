# Landing page — Ludgero Sangaletti

Este pacote traduz a landing page para uma estrutura de **Flexbox Containers do Elementor Pro**.

## Antes de importar

1. Abra `landing-ludgero-elementor.json` em um editor de texto.
2. Substitua todas as ocorrências de `55SEUNUMERO` pelo número completo do WhatsApp, com DDI e DDD, somente números. Exemplo: `5542999999999`.
3. No WordPress, acesse a biblioteca de Templates do Elementor, clique no ícone de importação e envie o arquivo JSON.
4. Insira o template em uma página com layout **Elementor Canvas** ou **Elementor Largura Total**.
5. Em **Configurações do site → CSS personalizado**, cole o conteúdo de `elementor-custom.css`.

O Elementor aceita templates em `.json` ou `.zip` e utiliza Containers Flexbox para layouts responsivos. A estrutura deste pacote segue esse modelo.

## Configurações globais recomendadas

- Cor primária: `#0D2D25`
- Fundo: `#F4F0E7`
- Destaque: `#D9F26D`
- Superfície clara: `#FFFDF8`
- Texto secundário: `#61766E`
- Títulos: Georgia, 400
- Textos e botões: Arial, 400–800
- Largura máxima do conteúdo: `1280px`
- Breakpoints: desktop padrão, tablet em `1024px`, celular em `767px`

## Hierarquia de Containers

- Cabeçalho
- Hero
  - Coluna de mensagem e CTA
  - Cartão “Sua evolução”
- Barra de credenciais
- Benefícios
  - Título
  - Quatro cartões
  - Processo em três etapas
- Autoridade
  - Apresentação e credenciais
  - Prova objetiva e áreas de atuação
- Perguntas frequentes
- CTA final
- Rodapé

## Ajustes finais

- Troque a marca textual `LS` por seu logotipo, caso queira.
- Revise o destino do WhatsApp em todos os botões.
- Se desejar usar uma foto profissional, insira-a no cartão da coluna direita do Hero sem alterar a hierarquia do H1.
- Cadastre título SEO e meta descrição no plugin de SEO do WordPress.
- Configure eventos de clique do WhatsApp no Google Tag Manager ou no pixel usado no site.

## Texto SEO sugerido

**Título:** Ludgero Sangaletti | Nutrição Clínica e Esportiva

**Descrição:** Consultoria nutricional personalizada para emagrecimento, saúde e performance. Atendimento presencial em Guarapuava e online.

