import { chunkText } from "../../core/reporter.js";
import { formatDateBr } from "../../core/day.js";

const LABELS = {
  dts: "DTS",
  apreensao_pessoa: "Pessoas",
  apreensao_veiculo: "Veículos",
  apreensao_ilegais: "Ilegais",
  multa: "Multas",
  blitz: "Blitz",
  alteracao: "Alteração DTS",
};

export function buildDtsReport(day, { preview = false } = {}) {
  const byUser = {};
  const totais = {};

  for (const rec of Object.values(day.records || {})) {
    const id = rec.discordId;
    if (!id) continue;
    const tipo = rec.tipo === "registro" ? "dts" : rec.tipo;
    if (!byUser[id]) byUser[id] = { name: rec.name || "Usuário", tipos: {} };
    byUser[id].name = rec.name || byUser[id].name;
    const qtd = Math.max(1, Number(rec.quantidade) || 1);
    byUser[id].tipos[tipo] = (byUser[id].tipos[tipo] || 0) + qtd;
    totais[tipo] = (totais[tipo] || 0) + qtd;
  }

  const officers = Object.entries(byUser).sort((a, b) => {
    const ta = Object.values(a[1].tipos).reduce((s, n) => s + n, 0);
    const tb = Object.values(b[1].tipos).reduce((s, n) => s + n, 0);
    return tb - ta || a[1].name.localeCompare(b[1].name, "pt-BR");
  });

  const blocks = [];
  if (!officers.length) {
    blocks.push("Nenhum registro de calculadora armazenado neste período.");
  } else {
    const resumo = Object.entries(totais)
      .filter(([tipo]) => tipo !== "alteracao")
      .map(([tipo, n]) => `${LABELS[tipo] || tipo}: **${n}**`)
      .join(" · ");
    blocks.push(`**Totais:** ${resumo || "—"}`);
    for (const [id, officer] of officers) {
      const partes = Object.entries(officer.tipos)
        .filter(([tipo]) => tipo !== "alteracao")
        .map(([tipo, n]) => `${LABELS[tipo] || tipo} ${n}`);
      if (!partes.length) continue;
      blocks.push(`• **${officer.name}** (<@${id}>) — ${partes.join(" · ")}`);
    }
  }

  const label = formatDateBr(day.date);
  return {
    title: preview ? `Ranking armazenado — ${label} (parcial)` : `Ranking armazenado — ${label}`,
    color: 0xe74c3c,
    chunks: chunkText(blocks),
    footer: "00:00–23:59 BRT · canais da calculadora · fonte: histórico do Discord",
  };
}
