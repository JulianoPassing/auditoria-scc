import {
  lastDailyResetMs,
  lastWeeklyResetMs,
  previousDailyResetMs,
  previousWeeklyResetMs,
} from "./day.js";
import { aggregateRanking } from "./store.js";

const WEBHOOK_RANKING_DIARIO =
  process.env.WEBHOOK_RANKING_DIARIO ||
  "https://discord.com/api/webhooks/1537256544469782568/Pqv14_C2or6Hq8QrliRcXOphTwuiC4apyTp0J7mn-MQgYDkqX70Vwwsb0kHZ8ByBvVK7";

const WEBHOOK_RANKING_SEMANAL =
  process.env.WEBHOOK_RANKING_SEMANAL ||
  "https://discord.com/api/webhooks/1537465608671600691/unT0DqAnQ2sBzSW1rVdAgqc6goMCxidHsvY8AihHlx7tKnQpR2p-L1ZvUe6yX01RI82c";

const CARGOS = {
  pm: "1329451959115059312",
  prs: "1341103708519403522",
};

const CATEGORIAS = {
  pm: [
    ["apreensoes", "Apreensões"],
    ["apreensoesPessoas", "Apreensão de pessoas"],
    ["apreensoesIlegais", "Apreensão de ilegais"],
    ["valorMultas", "Valor total de multas"],
  ],
  prs: [
    ["apreensoes", "Apreensões"],
    ["apreensoesPessoas", "Apreensão de pessoas"],
    ["apreensoesVeiculos", "Apreensão veicular"],
    ["apreensoesIlegais", "Apreensão de ilegais"],
    ["multas", "Quantidade de multas"],
    ["valorMultas", "Valor total de multas"],
    ["blitz", "Blitz"],
  ],
  dts: [["veiculos", "Veículos registrados"]],
};

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

function mesclarStats(destino, origem) {
  const out = { ...destino };
  for (const [campo, valor] of Object.entries(origem || {})) {
    if (!(campo in out)) continue;
    out[campo] = (Number(out[campo]) || 0) + (Number(valor) || 0);
  }
  return out;
}

function resolverForcaCargo(user) {
  const nick = String(user?.apelido || "").trim();
  if (/^(SD|CB|SGT|SUB[\s-]?TEN|TEN|CAP|MAJ|CEL|RC|REC|RECRUTA)\b/i.test(nick)) return "pm";
  if (/^(EST|INSP|DIR|AG\s*2|AGT)\b/i.test(nick)) return "prs";
  return null;
}

function usersPorCargo(list) {
  const out = {};
  for (const user of list || []) {
    const clone = {
      ...user,
      pm: { ...emptyPm(), ...user.pm },
      prs: { ...emptyPrs(), ...user.prs },
      dts: { ...emptyDts(), ...user.dts },
    };
    const forca = resolverForcaCargo(user);
    if (forca === "pm") {
      clone.pm = mesclarStats(clone.pm, user.prs);
      clone.prs = emptyPrs();
    } else if (forca === "prs") {
      clone.prs = mesclarStats(clone.prs, user.pm);
      clone.pm = emptyPm();
    }
    out[user.id] = clone;
  }
  return out;
}

function pertenceAForca(user, forca) {
  if (forca === "dts") return true;
  const cargo = resolverForcaCargo(user);
  if (cargo === "pm") return forca === "pm";
  if (cargo === "prs") return forca === "prs";
  return true;
}

function ranking(users, forca, campo) {
  return Object.values(users)
    .filter((u) => pertenceAForca(u, forca))
    .map((u) => ({
      id: u.id,
      apelido: u.apelido || "Usuário",
      valor: Number(u[forca]?.[campo]) || 0,
    }))
    .filter((u) => u.valor > 0)
    .sort((a, b) => b.valor - a.valor || a.apelido.localeCompare(b.apelido, "pt-BR"));
}

function totais(users, forca, campos) {
  const acc = {};
  for (const campo of campos) acc[campo] = 0;
  for (const u of Object.values(users)) {
    if (!pertenceAForca(u, forca)) continue;
    for (const campo of campos) {
      acc[campo] += Number(u[forca]?.[campo]) || 0;
    }
  }
  return acc;
}

function montarDados(list) {
  const users = usersPorCargo(list);
  const camposPm = ["apreensoes", "apreensoesPessoas", "apreensoesIlegais", "valorMultas"];
  const camposPrs = [
    "apreensoes",
    "apreensoesPessoas",
    "apreensoesVeiculos",
    "apreensoesIlegais",
    "multas",
    "valorMultas",
    "blitz",
  ];
  const camposDts = ["veiculos"];
  return {
    pm: {
      totais: totais(users, "pm", camposPm),
      rankings: Object.fromEntries(camposPm.map((campo) => [campo, ranking(users, "pm", campo)])),
    },
    prs: {
      totais: totais(users, "prs", camposPrs),
      rankings: Object.fromEntries(camposPrs.map((campo) => [campo, ranking(users, "prs", campo)])),
    },
    dts: {
      totais: totais(users, "dts", camposDts),
      rankings: { veiculos: ranking(users, "dts", "veiculos") },
    },
  };
}

function formatarValor(campo, valor) {
  if (campo === "valorMultas") {
    return "R$ " + Number(valor || 0).toLocaleString("pt-BR");
  }
  return Number(valor || 0).toLocaleString("pt-BR");
}

function agoraBrasil() {
  return new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function dataBrasil() {
  return new Date().toLocaleDateString("pt-BR", { timeZone: "America/Sao_Paulo" });
}

function top1(grupo, campo) {
  return (grupo?.rankings?.[campo] || [])[0] || null;
}

function linhaTop(campo, lider) {
  if (!lider) return "_Sem registros_";
  return `<@${lider.id}>\n**${lider.apelido}** — **${formatarValor(campo, lider.valor)}**`;
}

function embedForca(titulo, grupo, categorias, semanal, cor) {
  const fields = categorias.map(([campo, label]) => ({
    name: `🥇 ${label}`,
    value: linhaTop(campo, top1(grupo, campo)),
    inline: true,
  }));

  const totaisGrupo = grupo?.totais || {};
  const resumo = categorias
    .map(([campo, label]) => `**${label}:** ${formatarValor(campo, totaisGrupo[campo])}`)
    .join("\n");

  fields.push({
    name: "📊 Total da força",
    value: resumo || "_Sem registros_",
    inline: false,
  });

  return {
    title: titulo,
    color: cor,
    fields,
    footer: {
      text: `Street Car Club Roleplay • ${semanal ? "Ranking semanal • zera após o RR" : "Ranking diário"} • ${agoraBrasil()}`,
      icon_url: "https://i.imgur.com/aawPk38.png",
    },
    timestamp: new Date().toISOString(),
  };
}

function payloadForca({ dados, forca, cargoId, tituloEmbed, cor, semanal, cabecalho }) {
  return {
    username: semanal ? "Severino Ranking Semanal PM e PRS" : "Severino Ranking PM e PRS",
    avatar_url: "https://i.imgur.com/aawPk38.png",
    content: `${cabecalho}\n<@&${cargoId}>`,
    allowed_mentions: {
      parse: [],
      users: [
        ...new Set(
          CATEGORIAS[forca]
            .map(([campo]) => top1(dados[forca], campo)?.id)
            .filter(Boolean),
        ),
      ],
      roles: [cargoId],
    },
    embeds: [embedForca(tituloEmbed, dados[forca], CATEGORIAS[forca], semanal, cor)],
  };
}

function montarPayloads(dados, semanal, { republicar = false } = {}) {
  const aviso = republicar ? "\n🔁 **Republicação do encerramento (corrigido)**" : "";
  const titulo = semanal
    ? `🏁 **Ranking semanal — ${dataBrasil()}**\nApós o RR. Encerramento da semana — placar zera agora.${aviso}`
    : `🏆 **Ranking diário — ${dataBrasil()}**${aviso}`;

  return [
    payloadForca({
      dados,
      forca: "pm",
      cargoId: CARGOS.pm,
      tituloEmbed: semanal ? "🛡️ Polícia Militar — Top 1 da semana" : "🛡️ Polícia Militar — Top 1",
      cor: 0x3a4f73,
      semanal,
      cabecalho: `${titulo}\n🛡️ **Polícia Militar**`,
    }),
    payloadForca({
      dados,
      forca: "prs",
      cargoId: CARGOS.prs,
      tituloEmbed: semanal ? "🛣️ Polícia Rodoviária — Top 1 da semana" : "🛣️ Polícia Rodoviária — Top 1",
      cor: 0xc9a227,
      semanal,
      cabecalho: `🛣️ **Polícia Rodoviária**`,
    }),
    payloadForca({
      dados,
      forca: "dts",
      cargoId: CARGOS.prs,
      tituloEmbed: semanal ? "📋 Despachante — Top 1 da semana" : "📋 Despachante — Top 1",
      cor: 0xc9a227,
      semanal,
      cabecalho: `📋 **Despachante**`,
    }),
  ];
}

async function enviarWebhook(url, payload) {
  const response = await fetch(`${url}?wait=true`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    const detalhe = await response.text();
    throw new Error(`Webhook ${response.status}: ${detalhe.slice(0, 300)}`);
  }
}

function resumoTotais(dados) {
  return {
    pm: dados.pm?.totais?.apreensoes || 0,
    prs: dados.prs?.totais?.apreensoes || 0,
    dts: dados.dts?.totais?.veiculos || 0,
  };
}

export function fecharRankings(moduleId = "dts") {
  const diarioInicio = lastDailyResetMs();
  const semanalInicio = lastWeeklyResetMs();
  return {
    diario: aggregateRanking(moduleId, {
      sinceMs: previousDailyResetMs(),
      untilMs: diarioInicio,
    }),
    semanal: aggregateRanking(moduleId, {
      sinceMs: previousWeeklyResetMs(),
      untilMs: semanalInicio,
    }),
  };
}

export async function publishClosingRankings({ moduleId = "dts", republicar = true, semanal = true } = {}) {
  const fechamento = fecharRankings(moduleId);
  const dadosDiario = montarDados(fechamento.diario);
  const dadosSemanal = montarDados(fechamento.semanal);

  for (const payload of montarPayloads(dadosDiario, false, { republicar })) {
    await enviarWebhook(WEBHOOK_RANKING_DIARIO, payload);
  }

  if (semanal) {
    for (const payload of montarPayloads(dadosSemanal, true, { republicar })) {
      await enviarWebhook(WEBHOOK_RANKING_SEMANAL, payload);
    }
  }

  const diario = resumoTotais(dadosDiario);
  const semana = resumoTotais(dadosSemanal);
  console.log(
    `[ranking] publicado encerramento · diário PM ${diario.pm} PRS ${diario.prs} DTS ${diario.dts}` +
      (semanal ? ` · semanal PM ${semana.pm} PRS ${semana.prs} DTS ${semana.dts}` : ""),
  );

  return { ok: true, diario, semanal: semanal ? semana : null };
}
