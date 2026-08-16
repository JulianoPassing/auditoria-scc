import { PermissionFlagsBits } from "discord.js";
import { dateKey, lastWeeklyResetMs, previousDateKey, shiftDateKey, snowflakeFromMs, startOfDayMs } from "./day.js";
import { addMovement, addRecord, loadDay, saveDay } from "./store.js";
import { sendReport } from "./reporter.js";
import { syncDtsCalculadora } from "./sync-calculadora.js";

function isFromSource(message, sourceAppId) {
  return message.author?.id === sourceAppId || message.applicationId === sourceAppId;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function resolveListenChannel(client, mod) {
  if (mod.listenChannelId) {
    try {
      const channel = await client.channels.fetch(mod.listenChannelId);
      if (channel?.isTextBased()) return channel;
    } catch (err) {
      console.warn(`[${mod.id}] canal ${mod.listenChannelId} inacessível:`, err.message);
    }
  }

  if (mod.listenChannelPattern && mod.guildId) {
    const guild = await client.guilds.fetch(mod.guildId);
    const channels = await guild.channels.fetch();
    const found = channels.find(
      (channel) => channel?.isTextBased() && mod.listenChannelPattern.test(channel.name),
    );
    if (found) {
      mod.listenChannelId = found.id;
      console.log(`[${mod.id}] canal resolvido: #${found.name} (${found.id})`);
      return found;
    }
  }

  return null;
}

export function ingestMessage(mod, message) {
  if (!mod.listenChannelId || message.channelId !== mod.listenChannelId) return false;
  if (mod.guildId && message.guildId && message.guildId !== mod.guildId) return false;
  if (mod.sourceAppId && !isFromSource(message, mod.sourceAppId)) return false;

  const event = mod.parse?.(message);
  if (!event) return false;

  const key = dateKey(message.createdAt);
  const day = loadDay(mod.id, key);
  const payload = { ...event, messageId: message.id, at: event.at ?? message.createdTimestamp };

  if (mod.kind === "records" || event.kind === "record") {
    if (!addRecord(day, payload)) return false;
  } else {
    if (day.lastMessageId && BigInt(message.id) <= BigInt(day.lastMessageId)) {
      return false;
    }
    addMovement(day, payload);
  }

  saveDay(mod.id, day);
  return true;
}

async function fetchMessagesInRange(channel, startMs, endMs, afterId) {
  const collected = [];
  let before = snowflakeFromMs(endMs);
  let pages = 0;
  const maxPages = 50;

  while (pages < maxPages) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    pages += 1;
    if (batch.size === 0) break;

    const msgs = [...batch.values()].sort((a, b) => (BigInt(a.id) > BigInt(b.id) ? -1 : 1));
    let reachedStart = false;

    for (const msg of msgs) {
      if (afterId && BigInt(msg.id) <= BigInt(afterId)) {
        reachedStart = true;
        break;
      }
      if (msg.createdTimestamp < startMs) {
        reachedStart = true;
        break;
      }
      if (msg.createdTimestamp < endMs) {
        collected.push(msg);
      }
    }

    const oldest = msgs[msgs.length - 1];
    if (!oldest || reachedStart || batch.size < 100) break;
    before = oldest.id;
    await sleep(350);
  }

  collected.sort((a, b) => (BigInt(a.id) < BigInt(b.id) ? -1 : 1));
  return collected;
}

export async function backfill(client, mod, key = dateKey()) {
  const channel = await resolveListenChannel(client, mod);
  if (!channel?.isTextBased()) {
    console.warn(`[${mod.id}] canal de leitura inválido: ${mod.listenChannelId || "(não resolvido)"}`);
    return 0;
  }

  const day = loadDay(mod.id, key);
  const startMs = startOfDayMs(key);
  const endMs = startOfDayMs(shiftDateKey(key, 1));
  const afterId = mod.kind === "records" ? null : day.lastMessageId;
  const messages = await fetchMessagesInRange(channel, startMs, endMs, afterId);

  let count = 0;
  for (const msg of messages) {
    if (ingestMessage(mod, msg)) count += 1;
  }

  if (count) console.log(`[${mod.id}] backfill ${key}: ${count} logs`);
  return count;
}

export async function backfillSince(client, mod, startMs = lastWeeklyResetMs()) {
  const channel = await resolveListenChannel(client, mod);
  if (!channel?.isTextBased()) {
    console.warn(`[${mod.id}] canal de leitura inválido: ${mod.listenChannelId || "(não resolvido)"}`);
    return 0;
  }

  const messages = await fetchMessagesInRange(channel, startMs, Date.now() + 1000, null);
  let count = 0;
  for (const msg of messages) {
    if (ingestMessage(mod, msg)) count += 1;
  }

  console.log(`[${mod.id}] varredura completa: ${messages.length} msgs no canal, ${count} novos armazenados`);
  return count;
}

let dtsSyncTimer = null;

export function scheduleDtsSync(mod) {
  if (mod?.id !== "dts") return;
  clearTimeout(dtsSyncTimer);
  dtsSyncTimer = setTimeout(() => {
    syncDtsCalculadora(mod).catch((err) => console.error("[dts] falha no sync da calculadora", err));
  }, 8000);
}

export async function sendModuleReport(client, mod, date, { preview = false } = {}) {
  const channel = await client.channels.fetch(mod.reportChannelId);
  if (!channel?.isTextBased()) {
    throw new Error(`[${mod.id}] canal de relatório inválido: ${mod.reportChannelId}`);
  }

  const day = loadDay(mod.id, date);
  await sendReport(channel, mod.buildReport(day, { preview }));

  if (!preview) {
    day.reported = true;
    saveDay(mod.id, day);
  }
}

export async function closeYesterdayIfNeeded(client, modules) {
  const yesterday = previousDateKey();
  for (const mod of modules) {
    const day = loadDay(mod.id, yesterday);
    if (day.reported) continue;
    try {
      await backfill(client, mod, yesterday);
      await sendModuleReport(client, mod, yesterday);
      console.log(`[${mod.id}] relatório de ${yesterday} enviado`);
    } catch (err) {
      console.error(`[${mod.id}] falha ao enviar relatório de ${yesterday}`, err);
    }
  }
}

export function hasManagePermission(message) {
  return Boolean(
    message.member?.permissions.has(PermissionFlagsBits.ManageGuild) ||
      message.member?.permissions.has(PermissionFlagsBits.Administrator),
  );
}
