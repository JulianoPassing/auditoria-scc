import "dotenv/config";
import cron from "node-cron";
import { Client, GatewayIntentBits, Partials } from "discord.js";
import { modules } from "./modules/index.js";
import { dateKey, previousDateKey, TIMEZONE } from "./core/day.js";
import {
  backfill,
  closeYesterdayIfNeeded,
  hasManagePermission,
  ingestMessage,
  sendModuleReport,
} from "./core/dispatcher.js";

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
  return modules.find((mod) => mod.listenChannelId === channelId);
}

function moduleByReportChannel(channelId) {
  return modules.find((mod) => mod.reportChannelId === channelId);
}

client.once("ready", async () => {
  console.log(`Logado como ${client.user.tag}`);
  console.log(`Módulos: ${modules.map((m) => m.id).join(", ")}`);

  try {
    await closeYesterdayIfNeeded(client, modules);
  } catch (err) {
    console.error("Falha ao fechar relatórios atrasados", err);
  }

  for (const mod of modules) {
    try {
      await backfill(client, mod);
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
      ingestMessage(listenMod, message);
    } catch (err) {
      console.error(`[${listenMod.id}] erro ao ingerir mensagem`, err);
    }
    return;
  }

  if (message.content.trim() !== "!auditoria") return;
  const reportMod = moduleByReportChannel(message.channelId);
  if (!reportMod || !hasManagePermission(message)) return;

  try {
    await sendModuleReport(client, reportMod, dateKey(), { preview: true });
    await message.react("✅");
  } catch (err) {
    console.error(`[${reportMod.id}] falha no comando !auditoria`, err);
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

client.login(token);
