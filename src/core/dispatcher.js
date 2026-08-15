import { PermissionFlagsBits } from "discord.js";
import { dateKey, previousDateKey, shiftDateKey, snowflakeFromMs, startOfDayMs } from "./day.js";
import { addMovement, loadDay, saveDay } from "./store.js";
import { sendReport } from "./reporter.js";

function isFromSource(message, sourceAppId) {
  return message.author?.id === sourceAppId || message.applicationId === sourceAppId;
}

export function ingestMessage(mod, message) {
  if (message.channelId !== mod.listenChannelId) return false;
  if (mod.guildId && message.guildId && message.guildId !== mod.guildId) return false;
  if (mod.sourceAppId && !isFromSource(message, mod.sourceAppId)) return false;

  const event = mod.parse?.(message);
  if (!event) return false;

  const key = dateKey(message.createdAt);
  const day = loadDay(mod.id, key);

  if (day.lastMessageId && BigInt(message.id) <= BigInt(day.lastMessageId)) {
    return false;
  }

  addMovement(day, { ...event, messageId: message.id });
  saveDay(mod.id, day);
  return true;
}

async function fetchMessagesInRange(channel, startMs, endMs, afterId) {
  const collected = [];
  let before = snowflakeFromMs(endMs);

  while (true) {
    const batch = await channel.messages.fetch({ limit: 100, before });
    if (batch.size === 0) break;

    let reachedStart = false;
    for (const msg of batch.values()) {
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

    before = batch.last()?.id;
    if (reachedStart || batch.size < 100) break;
  }

  return collected.reverse();
}

export async function backfill(client, mod, key = dateKey()) {
  const channel = await client.channels.fetch(mod.listenChannelId);
  if (!channel?.isTextBased()) {
    console.warn(`[${mod.id}] canal de leitura inválido: ${mod.listenChannelId}`);
    return;
  }

  const day = loadDay(mod.id, key);
  const startMs = startOfDayMs(key);
  const endMs = startOfDayMs(shiftDateKey(key, 1));
  const messages = await fetchMessagesInRange(channel, startMs, endMs, day.lastMessageId);

  let count = 0;
  for (const msg of messages) {
    if (ingestMessage(mod, msg)) count += 1;
  }

  if (count) console.log(`[${mod.id}] backfill ${key}: ${count} logs`);
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
