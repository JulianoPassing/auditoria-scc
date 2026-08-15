import { chunkText } from "../../core/reporter.js";
import { formatDateBr } from "../../core/day.js";

function itemLines(bucket) {
  return Object.entries(bucket)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .map(([key, qty]) => {
      const [item, storage] = key.split("||");
      const where = storage ? ` (${storage})` : "";
      return `• ${item} ×${qty}${where}`;
    });
}

export function buildPmPrsReport(day, { preview = false } = {}) {
  const players = Object.keys(day.players).sort((a, b) => a.localeCompare(b, "pt-BR"));
  const blocks = [];

  if (!players.length) {
    blocks.push("Nenhum movimento de armazenamento registrado neste período.");
  }

  for (const key of players) {
    const player = day.players[key];
    const retirou = itemLines(player.pegou);
    const colocou = itemLines(player.colocou);
    const parts = [`**${key}**`];
    parts.push(retirou.length ? `Retirou:\n${retirou.join("\n")}` : "Retirou: —");
    parts.push(colocou.length ? `Colocou:\n${colocou.join("\n")}` : "Colocou: —");
    blocks.push(parts.join("\n"));
  }

  const label = formatDateBr(day.date);
  const title = preview
    ? `Auditoria PM/PRS — ${label} (parcial)`
    : `Auditoria PM/PRS — ${label}`;

  return {
    title,
    color: 0x2ecc71,
    chunks: chunkText(blocks),
    footer: "00:00–23:59 BRT · módulo pm-prs",
  };
}
