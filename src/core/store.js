import fs from "node:fs";
import path from "node:path";

const DATA_DIR = path.resolve("data");

function filePath(moduleId, dateKey) {
  return path.join(DATA_DIR, moduleId, `${dateKey}.json`);
}

function emptyDay(dateKey) {
  return {
    date: dateKey,
    reported: false,
    lastMessageId: null,
    players: {},
    records: {},
  };
}

export function loadDay(moduleId, dateKey) {
  const file = filePath(moduleId, dateKey);
  if (!fs.existsSync(file)) {
    return emptyDay(dateKey);
  }
  try {
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return {
      ...emptyDay(dateKey),
      ...parsed,
      players: parsed.players ?? {},
      records: parsed.records ?? {},
    };
  } catch {
    return emptyDay(dateKey);
  }
}

export function saveDay(moduleId, day) {
  const dir = path.join(DATA_DIR, moduleId);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(filePath(moduleId, day.date), JSON.stringify(day, null, 2));
}

export function addMovement(day, event) {
  const playerKey = `${event.name} (steam:${event.steam})`;
  if (!day.players[playerKey]) {
    day.players[playerKey] = {
      name: event.name,
      steam: event.steam,
      pegou: {},
      colocou: {},
    };
  }

  const bucket = event.action === "pegou" ? "pegou" : "colocou";
  const itemKey = `${event.item}||${event.storage}`;
  const current = day.players[playerKey][bucket][itemKey] ?? 0;
  day.players[playerKey][bucket][itemKey] = current + event.quantity;

  if (!day.lastMessageId || BigInt(event.messageId) > BigInt(day.lastMessageId)) {
    day.lastMessageId = event.messageId;
  }

  return playerKey;
}

export function addRecord(day, event) {
  if (!event?.messageId || day.records[event.messageId]) return false;

  day.records[event.messageId] = {
    discordId: String(event.discordId),
    name: event.name || "Usuário",
    tipo: event.tipo || "registro",
    at: event.at ?? null,
  };

  if (!day.lastMessageId || BigInt(event.messageId) > BigInt(day.lastMessageId)) {
    day.lastMessageId = event.messageId;
  }

  return true;
}

export function aggregateRecords(moduleId, { sinceMs = 0, tipo = "registro" } = {}) {
  const dir = path.join(DATA_DIR, moduleId);
  if (!fs.existsSync(dir)) return [];

  const users = {};
  for (const file of fs.readdirSync(dir)) {
    if (!file.endsWith(".json")) continue;
    let day;
    try {
      day = JSON.parse(fs.readFileSync(path.join(dir, file), "utf8"));
    } catch {
      continue;
    }

    for (const [messageId, rec] of Object.entries(day.records || {})) {
      if (tipo && rec.tipo !== tipo) continue;
      if (sinceMs && Number(rec.at) && Number(rec.at) < sinceMs) continue;
      const id = String(rec.discordId || "");
      if (!id) continue;
      if (!users[id]) {
        users[id] = { id, apelido: rec.name || "Usuário", veiculos: 0, messageIds: [] };
      }
      users[id].veiculos += 1;
      users[id].apelido = rec.name || users[id].apelido;
      users[id].messageIds.push(messageId);
    }
  }

  return Object.values(users).sort((a, b) => b.veiculos - a.veiculos);
}
