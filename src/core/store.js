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
