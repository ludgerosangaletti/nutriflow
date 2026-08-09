# AutomaÃ§Ã£o de validaÃ§Ã£o de mÃ­dia do NutriFlow Training

O preflight valida um diretÃ³rio local sem importar, publicar ou alterar D1/R2. Ele verifica o manifesto item a item, reconhece os slugs da Biblioteca Global, detecta duplicidades e arquivos inesperados, confere limites, assinaturas MP4/poster e usa `ffprobe` para confirmar H.264 e duraÃ§Ã£o real.

## Uso

Coloque `manifest.json`, MP4s e posters no mesmo diretÃ³rio e execute:

```sh
npm run validate:training-media -- /caminho/do/lote
```

O ambiente precisa disponibilizar `ffprobe`. O comando imprime JSON e termina com cÃ³digo `0` apenas quando o lote inteiro pode seguir para o importador atual. Um item invÃ¡lido nunca dispara upload nem associaÃ§Ã£o.

O resumo informa `received`, `recognized`, `approved`, `rejected` e o motivo de cada rejeiÃ§Ã£o. O importador oficial aceita no mÃ¡ximo 24 itens por operaÃ§Ã£o; lotes maiores podem ser inspecionados pelo preflight. O relatÃ³rio marca `requiresBatchSplit` e produz um `importPlan` determinÃ­stico, preservando a ordem do manifesto e dividindo somente os itens aprovados em grupos de atÃ© 24. Cada grupo continua sendo enviado separadamente pelo importador oficial para preservar sua atomicidade.

## Cobertura automatizada

- manifesto, slugs, correspondÃªncia e duplicidades;
- MP4/H.264, duraÃ§Ã£o, tamanho e poster;
- comportamento fail-safe antes do import;
- gravaÃ§Ã£o R2 simulada, metadados e chaves versionadas;
- associaÃ§Ã£o em lote, auditoria e substituiÃ§Ã£o explÃ­cita;
- snapshot publicado imutÃ¡vel apÃ³s troca da mÃ­dia da biblioteca;
- entrega restrita Ã  publicaÃ§Ã£o, organizaÃ§Ã£o e Range Requests;
- poster, fallback, `muted`, `playsInline`, `loop`, `preload` e carregamento sob demanda;
- troca de dias sem percorrer ou prÃ©-carregar toda a rotina.

R2/D1 de produÃ§Ã£o, instalaÃ§Ã£o PWA, decodificaÃ§Ã£o do aparelho e desempenho de rede mÃ³vel continuam exigindo uma validaÃ§Ã£o humana amostral controlada. A automaÃ§Ã£o nÃ£o habilita `nutriflow.training.enabled`.
