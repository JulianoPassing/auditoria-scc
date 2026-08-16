import { chunkText } from "../../core/reporter.js";
import { formatDateBr } from "../../core/day.js";

export function buildDtsReport(day, { preview = false } = {}) {
  const byUser = {};
  for (const rec of Object.values(day.records || {})) {
    const id = rec.discordId;
    if (!id) continue;
    if (!byUser[id]) {
      byUser[id] = { name: rec.name || "Usuário", registro: 0, alteracao: 0 };
    }
    if (rec.tipo === "alteracao") byUser[id].alteracao += 1;
    else byUser[id].registro += 1;
    byUser[id].name = rec.name || byUser[id].name;
  }

  const officers = Object.entries(byUser).sort(
    (a, b) => b[1].registro - a[1].registro || a[1].name.localeCompare(b[1].name, "pt-BR"),
  );

  const blocks = [];
  if (!officers.length) {
    blocks.push("Nenhum registro DTS armazenado neste período.");
  } else {
    const total = officers.reduce((sum, [, o]) => sum + o.registro, 0);
    blocks.push(`**Total:** ${total} documento(s) · ${officers.length} oficial(is)`);
    for (const [id, officer] of officers) {
      const extra = officer.alteracao ? ` · ${officer.alteracao} alteração(ões)` : "";
      blocks.push(`• **${officer.name}** (<@${id}>) — **${officer.registro}** registro(s)${extra}`);
    }
  }

  const label = formatDateBr(day.date);
  return {
    title: preview ? `DTS armazenado — ${label} (parcial)` : `DTS armazenado — ${label}`,
    color: 0xe74c3c,
    chunks: chunkText(blocks),
    footer: "00:00–23:59 BRT · módulo dts · fonte: histórico do canal",
  };
}
