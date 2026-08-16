import "dotenv/config";
import cron from "node-cron";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { modules } from "./modules/index.js";
import { dateKey, previousDateKey, TIMEZONE } from "./core/day.js";
import {
  backfill,
  backfillSince,
  closeYesterdayIfNeeded,
  hasManagePermission,
  ingestMessage,
  resolveListenChannel,
  scheduleDtsSync,
  sendModuleReport,
} from "./core/dispatcher.js";
import { syncDtsCalculadora } from "./core/sync-calculadora.js";

const token = process.env.DISCORD_BOT_TOKEN;

if (!token) {
  console.error("Defina DISCORD_BOT_TOKEN no arquivo .env");
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel],
});

function moduleByListenChannel(channelId) {
  return modules.find((mod) => {
    const ids = [
      ...(Array.isArray(mod.listenChannelIds) ? mod.listenChannelIds : []),
      mod.listenChannelId,
    ].filter(Boolean);
    return ids.includes(channelId);
  });
}

function modulesByReportChannel(channelId) {
  return modules.filter((mod) => mod.reportChannelId === channelId);
}

const dtsMod = () => modules.find((mod) => mod.id === "dts");

client.once("ready", async () => {
  console.log(`Logado como ${client.user.tag}`);
  console.log(`Módulos: ${modules.map((m) => m.id).join(", ")}`);

  for (const mod of modules) {
    try {
      await resolveListenChannel(client, mod);
    } catch (err) {
      console.error(`[${mod.id}] falha ao resolver canal`, err);
    }
  }

  try {
    await closeYesterdayIfNeeded(client, modules);
  } catch (err) {
    console.error("Falha ao fechar relatórios atrasados", err);
  }

  for (const mod of modules) {
    try {
      if (mod.kind === "records") {
        await backfillSince(client, mod);
        scheduleDtsSync(mod);
      } else {
        await backfill(client, mod);
      }
    } catch (err) {
      console.error(`[${mod.id}] falha no backfill`, err);
    }
  }
});

client.on("messageCreate", async (message) => {
  if (message.author.id === client.user.id) return;

  const listenMod = moduleByListenChannel(message.channelId);
  if (listenMod) {
    try {
      if (ingestMessage(listenMod, message)) {
        scheduleDtsSync(listenMod);
      }
    } catch (err) {
      console.error(`[${listenMod.id}] erro ao armazenar mensagem`, err);
    }
    return;
  }

  if (message.content.trim() !== "!auditoria") return;
  const reportMods = modulesByReportChannel(message.channelId);
  if (!reportMods.length || !hasManagePermission(message)) return;

  try {
    for (const reportMod of reportMods) {
      if (reportMod.kind === "records") {
        await backfillSince(client, reportMod);
        await syncDtsCalculadora(reportMod).catch((err) =>
          console.error("[ranking] falha no sync da calculadora", err),
        );
      }
      await sendModuleReport(client, reportMod, dateKey(), { preview: true });
    }
    await message.react("✅");
  } catch (err) {
    console.error("falha no comando !auditoria", err);
    await message.reply("Não consegui enviar o relatório. Veja o log da VPS.").catch(() => {});
  }
});

cron.schedule(
  "0 0 * * *",
  async () => {
    const yesterday = previousDateKey();
    console.log(`Fechando o dia ${yesterday}`);
    for (const mod of modules) {
      try {
        await sendModuleReport(client, mod, yesterday);
        console.log(`[${mod.id}] relatório diário enviado`);
      } catch (err) {
        console.error(`[${mod.id}] falha no relatório diário`, err);
      }
    }
  },
  { timezone: TIMEZONE },
);

cron.schedule(
  "*/5 * * * *",
  async () => {
    const mod = dtsMod();
    if (!mod) return;
    try {
      await backfillSince(client, mod);
      await syncDtsCalculadora(mod);
    } catch (err) {
      console.error("[ranking] falha na varredura periódica", err);
    }
  },
  { timezone: TIMEZONE },
);

client.login(token);
