# Importação em lote da mídia global do NutriFlow Training

## Objetivo

A Biblioteca global usa demonstrações curadas da plataforma. O administrador proprietário envia um único lote contendo um manifesto JSON, os vídeos MP4/H.264 e os posters. O upload individual permanece disponível para exercícios privados da organização.

## Preparação

1. Otimize cada vídeo como MP4/H.264, sem áudio quando possível, com duração entre 1 e 90 segundos e até 8 MB.
2. Prepare um poster JPEG, PNG ou WebP com até 500 KB.
3. No painel administrativo, abra **Mídias Training** e baixe o modelo JSON com os slugs atuais.
4. Mantenha no manifesto somente os exercícios presentes no lote.

Exemplo:

```json
{
  "apiVersion": 1,
  "items": [
    {
      "slug": "supino_reto",
      "videoFile": "supino_reto.mp4",
      "posterFile": "supino_reto.webp",
      "durationSeconds": 15
    }
  ]
}
```

O slug é estável e corresponde ao identificador global `tr_ex_global_<slug>`. O nome de cada arquivo no manifesto deve corresponder exatamente ao arquivo selecionado.

## Segurança operacional

- O endpoint exige sessão administrativa e papel `owner`.
- O lote inteiro é validado antes de qualquer associação: manifesto, slug, correspondência, assinatura real do MP4, marcador H.264, assinatura do poster, tamanho, duração, duplicidades e limite total.
- A substituição fica desligada por padrão. Se algum exercício já tiver mídia, o lote é recusado sem alterações.
- Quando a substituição é marcada explicitamente, uma nova chave versionada é criada no R2 e a troca é auditada.
- Objetos antigos não são excluídos: publicações imutáveis continuam reproduzindo exatamente a mídia entregue anteriormente.
- Uma falha antes da gravação dos metadados remove os novos objetos do lote e preserva as associações existentes.

## Limites do lote

- Até 24 exercícios.
- Até 64 MB somando todos os arquivos.
- Manifesto de até 64 KB.
- GIF não faz parte da importação global normal; continua disponível apenas no fluxo manual de exceção/legado.
