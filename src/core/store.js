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
    forca: event.forca || null,
    tipo: event.tipo || "registro",
    quantidade: Math.max(1, Number(event.quantidade) || 1),
    valorMulta: Math.max(0, Number(event.valorMulta) || 0),
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

function emptyPm() {
  return { apreensoes: 0, apreensoesPessoas: 0, apreensoesIlegais: 0, valorMultas: 0 };
}

function emptyPrs() {
  return {
    apreensoes: 0,
    apreensoesPessoas: 0,
    apreensoesVeiculos: 0,
    apreensoesIlegais: 0,
    multas: 0,
    valorMultas: 0,
    blitz: 0,
  };
}

function emptyDts() {
  return { veiculos: 0 };
}

function applyRankingEvent(user, rec) {
  let forca = rec.forca;
  let tipo = rec.tipo;
  if (!forca && (tipo === "registro" || tipo === "dts")) {
    forca = "dts";
    tipo = "dts";
  }
  if (!forca || tipo === "alteracao") return;

  const quantidade = Math.max(1, Number(rec.quantidade) || 1);
  const valorMulta = Math.max(0, Number(rec.valorMulta) || 0);

  if (forca === "pm") {
    if (tipo === "apreensao_pessoa") {
      user.pm.apreensoes += quantidade;
      user.pm.apreensoesPessoas += quantidade;
      user.pm.valorMultas += valorMulta;
    } else if (tipo === "apreensao_ilegais") {
      user.pm.apreensoes += quantidade;
      user.pm.apreensoesIlegais += quantidade;
    }
    return;
  }

  if (forca === "prs") {
    if (tipo === "apreensao_pessoa") {
      user.prs.apreensoes += quantidade;
      user.prs.apreensoesPessoas += quantidade;
      user.prs.valorMultas += valorMulta;
    } else if (tipo === "apreensao_veiculo") {
      user.prs.apreensoes += quantidade;
      user.prs.apreensoesVeiculos += quantidade;
      user.prs.valorMultas += valorMulta;
    } else if (tipo === "apreensao_ilegais") {
      user.prs.apreensoes += quantidade;
      user.prs.apreensoesIlegais += quantidade;
    } else if (tipo === "multa") {
      user.prs.multas += quantidade;
      user.prs.valorMultas += valorMulta;
    } else if (tipo === "blitz") {
      user.prs.blitz += quantidade;
    }
    return;
  }

  if (forca === "dts") {
    user.dts.veiculos += quantidade;
  }
}

export function aggregateRanking(moduleId, { sinceMs = 0 } = {}) {
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

    for (const rec of Object.values(day.records || {})) {
      if (sinceMs && Number(rec.at) && Number(rec.at) < sinceMs) continue;
      const id = String(rec.discordId || "");
      if (!id) continue;
      if (!users[id]) {
        users[id] = {
          id,
          apelido: rec.name || "Usuário",
          pm: emptyPm(),
          prs: emptyPrs(),
          dts: emptyDts(),
        };
      }
      users[id].apelido = rec.name || users[id].apelido;
      applyRankingEvent(users[id], rec);
    }
  }

  return Object.values(users);
}
