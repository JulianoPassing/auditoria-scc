import { PermissionFlagsBits } from "discord.js";
import { dateKey, lastWeeklyResetMs, previousDateKey, shiftDateKey, snowflakeFromMs, startOfDayMs } from "./day.js";
import { addMovement, addRecord, loadDay, saveDay } from "./store.js";
import { sendReport } from "./reporter.js";

function isFromSource(message, sourceAppId) {
  return message.author?.id === sourceAppId || message.applicationId === sourceAppId;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function listenIds(mod) {
  const ids = new Set();
  if (Array.isArray(mod.listenChannelIds)) {
    for (const id of mod.listenChannelIds) {
      if (id) ids.add(String(id));
    }
  }
  if (mod.listenChannelId) ids.add(String(mod.listenChannelId));
  return [...ids];
}

function shouldSkipChannelName(name) {
  return /ranking|auditoria|ticket|antidump|log.?acesso/i.test(String(name || ""));
}

export async function resolveListenChannel(client, mod) {
  const channels = await resolveListenChannels(client, mod);
  return channels[0] || null;
}

export async function resolveListenChannels(client, mod) {
  const ids = new Set(listenIds(mod));
  const patterns = [
    ...(Array.isArray(mod.listenChannelPatterns) ? mod.listenChannelPatterns : []),
    ...(mod.listenChannelPattern ? [mod.listenChannelPattern] : []),
  ];

  if (patterns.length && mod.guildId) {
    try {
      const guild = await client.guilds.fetch(mod.guildId);
      const all = await guild.channels.fetch();
      for (const channel of all.values()) {
        if (!channel?.isTextBased() || shouldSkipChannelName(channel.name)) continue;
        if (patterns.some((pattern) => pattern.test(channel.name))) {
          if (!ids.has(channel.id)) {
            console.log(`[${mod.id}] canal resolvido: #${channel.name} (${channel.id})`);
          }
          ids.add(channel.id);
        }
      }
    } catch (err) {
      console.warn(`[${mod.id}] falha ao listar canais:`, err.message);
    }
  }

  const resolved = [];
  for (const id of ids) {
    try {
      const channel = await client.channels.fetch(id);
      if (channel?.isTextBased() && !shouldSkipChannelName(channel.name)) {
        resolved.push(channel);
      }
    } catch (err) {
      console.warn(`[${mod.id}] canal ${id} inacessível:`, err.message);
    }
  }

  mod.listenChannelIds = resolved.map((channel) => channel.id);
  mod.listenChannelId = mod.listenChannelIds[0] || "";
  return resolved;
}

export function ingestMessage(mod, message) {
  const ids = listenIds(mod);
  if (!ids.length || !ids.includes(message.channelId)) return false;
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
  const channels = await resolveListenChannels(client, mod);
  if (!channels.length) {
    console.warn(`[${mod.id}] canal de leitura inválido: ${mod.listenChannelId || "(não resolvido)"}`);
    return 0;
  }

  const day = loadDay(mod.id, key);
  const startMs = startOfDayMs(key);
  const endMs = startOfDayMs(shiftDateKey(key, 1));
  const afterId = mod.kind === "records" ? null : day.lastMessageId;
  let count = 0;

  for (const channel of channels) {
    const messages = await fetchMessagesInRange(channel, startMs, endMs, afterId);
    for (const msg of messages) {
      if (ingestMessage(mod, msg)) count += 1;
    }
  }

  if (count) console.log(`[${mod.id}] backfill ${key}: ${count} logs`);
  return count;
}

export async function backfillSince(client, mod, startMs = lastWeeklyResetMs()) {
  const channels = await resolveListenChannels(client, mod);
  if (!channels.length) {
    console.warn(`[${mod.id}] canal de leitura inválido: ${mod.listenChannelId || "(não resolvido)"}`);
    return 0;
  }

  let scanned = 0;
  let count = 0;
  for (const channel of channels) {
    const messages = await fetchMessagesInRange(channel, startMs, Date.now() + 1000, null);
    scanned += messages.length;
    for (const msg of messages) {
      if (ingestMessage(mod, msg)) count += 1;
    }
  }

  console.log(`[${mod.id}] varredura completa: ${scanned} msgs em ${channels.length} canal(is), ${count} novos armazenados`);
  return count;
}

export function scheduleDtsSync(_mod) {}

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
