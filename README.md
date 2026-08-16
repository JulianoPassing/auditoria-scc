# Auditoria SCC

Bot na VPS que **armazena** o histórico dos canais e alimenta o ranking da calculadora.

## Discord (uma vez)

1. App `1538203757052166314` → Bot → **Intenção de conteúdo da mensagem** ligada (já feito).
2. Convide o bot no servidor:

https://discord.com/oauth2/authorize?client_id=1538203757052166314&permissions=84992&scope=bot

Permissões: ver canal, ler histórico, enviar mensagens, embeds.

3. Copie o **token** do bot (Developer Portal → Bot → Reset Token).
4. O bot precisa estar no canal `#registros-dts` (e no canal de logs PM/PRS).

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

Para o DTS atualizar o ranking da calculadora, o `.env` da VPS e o Vercel precisam do **mesmo** segredo:

| VPS (`.env`) | Vercel |
|---|---|
| `CALCULADORA_SYNC_SECRET` | `AUDITORIA_SYNC_SECRET` |
| `CALCULADORA_SYNC_URL=https://calculadora-scc.vercel.app/api/auditoria-sync` | — |

## Módulo PM/PRS

| | ID |
|---|---|
| Servidor | `1328895149392265287` |
| Lê logs | `1465711267179397264` |
| Envia relatório | `1538288085685633056` |
| App de origem | AmighiniTario `1465711301975081111` |

Todo dia às **00:00 BRT** o bot fecha o dia (00:00–23:59) e manda o relatório no canal de destino, agrupado por `Nome (steam:id)`.

## Módulo ranking (calculadora)

Lê os canais das calculadoras (PM, PRS, DTS), guarda os embeds e atualiza [relatorios.html](https://calculadora-scc.vercel.app/relatorios.html) e o ranking diário.

Canais (pelo nome, o bot precisa estar neles):

- `#registros-dts`
- ficha PM / ficha PRS
- pátio / apreensão veicular
- multas PRS
- blitz
- ilegais PM e PRS

Não lê canais de ranking (são saída, não entrada).

- Varredura ao ligar, a cada 5 minutos, e no `!auditoria`
- Alteração de característica DTS é armazenada, mas não entra no placar

No canal de relatório, quem tem **Gerenciar servidor** pode mandar `!auditoria` para um preview do dia atual (não fecha o dia) e forçar o sync do DTS.

## Acrescentar outro módulo

1. Copie `src/modules/pm-prs` para `src/modules/outro-nome`.
2. Troque `id`, `guildId`, `listenChannelId`, `reportChannelId` e o parser se o texto for diferente.
3. Importe e coloque na lista em `src/modules/index.js`.
4. Reinicie o bot.

