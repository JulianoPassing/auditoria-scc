# Auditoria SCC

Bot na VPS que lê embeds de armazenamento no Discord, agrupa por jogador e envia o relatório diário. Cada pasta em `src/modules` é um módulo separado (o primeiro é **PM/PRS**).

## Discord (uma vez)

1. App `1538203757052166314` → Bot → **Intenção de conteúdo da mensagem** ligada (já feito).
2. Convide o bot no servidor:

https://discord.com/oauth2/authorize?client_id=1538203757052166314&permissions=84992&scope=bot

Permissões: ver canal, ler histórico, enviar mensagens, embeds.

3. Copie o **token** do bot (Developer Portal → Bot → Reset Token).

## VPS

```bash
git clone <url-do-repo> auditoria-scc
cd auditoria-scc
cp .env.example .env
nano .env   # cole DISCORD_BOT_TOKEN=
docker compose up -d --build
docker compose logs -f
```

Sem Docker:

```bash
cp .env.example .env
npm install
node src/index.js
```

Ou copie `auditoria-scc.service` para `/etc/systemd/system/` e `systemctl enable --now auditoria-scc`.

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
