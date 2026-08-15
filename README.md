# Auditoria SCC

Bot na VPS que lê embeds de armazenamento no Discord, agrupa por jogador e envia o relatório diário. Cada pasta em `src/modules` é um módulo separado (o primeiro é **PM/PRS**).

## Discord (uma vez)

1. App `1538203757052166314` → Bot → **Intenção de conteúdo da mensagem** ligada (já feito).
2. Convide o bot no servidor:

https://discord.com/oauth2/authorize?client_id=1538203757052166314&permissions=84992&scope=bot

Permissões: ver canal, ler histórico, enviar mensagens, embeds.

3. Copie o **token** do bot (Developer Portal → Bot → Reset Token).

## VPS (PM2)

```bash
git clone https://github.com/JulianoPassing/auditoria-scc.git
cd auditoria-scc
cp .env.example .env
nano .env
npm install
pm2 start src/index.js --name auditoria-scc
pm2 save
pm2 logs auditoria-scc
```

O token fica só no `.env`. Depois de um `git pull`, use `pm2 restart auditoria-scc`.

## Módulo PM/PRS

| | ID |
|---|---|
| Servidor | `1328895149392265287` |
| Lê logs | `1465711267179397264` |
| Envia relatório | `1538288085685633056` |
| App de origem | AmighiniTario `1465711301975081111` |

Todo dia às **00:00 BRT** o bot fecha o dia (00:00–23:59) e manda o relatório no canal de destino, agrupado por `Nome (steam:id)`.

No canal de relatório, quem tem **Gerenciar servidor** pode mandar `!auditoria` para um preview do dia atual (não fecha o dia).

## Acrescentar outro módulo

1. Copie `src/modules/pm-prs` para `src/modules/outro-nome`.
2. Troque `id`, `guildId`, `listenChannelId`, `reportChannelId` e o parser se o texto for diferente.
3. Importe e coloque na lista em `src/modules/index.js`.
4. Reinicie o bot.
