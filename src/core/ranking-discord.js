import { chunkText } from "./reporter.js";
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

const WEBHOOK_CONTABILIDADE =
  process.env.WEBHOOK_CONTABILIDADE ||
  "https://discord.com/api/webhooks/1538783750551240704/Hg0nTwQW5Ws_KlGtbp7bKlJLe6rN9e4bSZpT0ddsEqMG-8s8xhel1B0ehEoEJXa5Ycj9";

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

function oficiais(users, forca, campos) {
  return Object.values(users)
    .filter((u) => pertenceAForca(u, forca))
    .map((u) => {
      const stats = {};
      let atividade = 0;
      for (const campo of campos) {
        const valor = Number(u[forca]?.[campo]) || 0;
        stats[campo] = valor;
        atividade += valor;
      }
      return {
        id: u.id,
        apelido: u.apelido || "Usuário",
        stats,
        atividade,
        valorMultas: Number(u[forca]?.valorMultas) || 0,
        veiculos: Number(u[forca]?.veiculos) || 0,
      };
    })
    .filter((u) => u.atividade > 0)
    .sort((a, b) => {
      if (forca === "dts") return b.veiculos - a.veiculos || a.apelido.localeCompare(b.apelido, "pt-BR");
      return b.valorMultas - a.valorMultas || b.atividade - a.atividade || a.apelido.localeCompare(b.apelido, "pt-BR");
    });
}

function dinheiro(valor) {
  return "R$ " + Number(valor || 0).toLocaleString("pt-BR");
}

function dezPorCento(valor) {
  return Math.round(Number(valor || 0) * 0.1);
}

function linhaPm(oficial, pos) {
  const s = oficial.stats;
  const comissao = dezPorCento(oficial.valorMultas);
  return [
    `**${pos}.** <@${oficial.id}> — **${oficial.apelido}**`,
    `Pessoas **${s.apreensoesPessoas || 0}** · Ilegais **${s.apreensoesIlegais || 0}** · Apreensões **${s.apreensoes || 0}**`,
    `Multas **${dinheiro(oficial.valorMultas)}** → 💵 **${dinheiro(comissao)}** (10%)`,
  ].join("\n");
}

function linhaPrs(oficial, pos) {
  const s = oficial.stats;
  const comissao = dezPorCento(oficial.valorMultas);
  return [
    `**${pos}.** <@${oficial.id}> — **${oficial.apelido}**`,
    `Pessoas **${s.apreensoesPessoas || 0}** · Veículos **${s.apreensoesVeiculos || 0}** · Ilegais **${s.apreensoesIlegais || 0}** · Multas **${s.multas || 0}** · Blitz **${s.blitz || 0}**`,
    `Valor **${dinheiro(oficial.valorMultas)}** → 💵 **${dinheiro(comissao)}** (10%)`,
  ].join("\n");
}

function linhaDts(oficial, pos) {
  return `**${pos}.** <@${oficial.id}> — **${oficial.apelido}**\nVeículos **${oficial.veiculos || 0}**`;
}

function embedsForca({ titulo, descricaoTopo, linhas, cor, footer }) {
  const chunks = chunkText(linhas.length ? linhas : ["_Sem registros_"]);
  return chunks.map((description, index) => ({
    title: chunks.length > 1 ? `${titulo} (${index + 1}/${chunks.length})` : titulo,
    color: cor,
    description: index === 0 && descricaoTopo ? `${descricaoTopo}\n\n${description}` : description,
    footer: { text: footer, icon_url: "https://i.imgur.com/aawPk38.png" },
    timestamp: new Date().toISOString(),
  }));
}

export async function publishContabilidadeSemanal(list, { republicar = false } = {}) {
  const users = usersPorCargo(list);
  const pm = oficiais(users, "pm", ["apreensoes", "apreensoesPessoas", "apreensoesIlegais", "valorMultas"]);
  const prs = oficiais(users, "prs", [
    "apreensoes",
    "apreensoesPessoas",
    "apreensoesVeiculos",
    "apreensoesIlegais",
    "multas",
    "valorMultas",
    "blitz",
  ]);
  const dts = oficiais(users, "dts", ["veiculos"]);

  const folhaPm = pm.reduce((sum, u) => sum + dezPorCento(u.valorMultas), 0);
  const folhaPrs = prs.reduce((sum, u) => sum + dezPorCento(u.valorMultas), 0);
  const multasPm = pm.reduce((sum, u) => sum + u.valorMultas, 0);
  const multasPrs = prs.reduce((sum, u) => sum + u.valorMultas, 0);
  const veiculosDts = dts.reduce((sum, u) => sum + u.veiculos, 0);
  const aviso = republicar ? "\n🔁 **Republicação do encerramento (corrigido)**" : "";
  const footer = `Street Car Club Roleplay • Contabilidade semanal • ${agoraBrasil()}`;

  const ids = [...pm, ...prs, ...dts].map((u) => u.id);
  const base = {
    username: "Severino Contabilidade SCC",
    avatar_url: "https://i.imgur.com/aawPk38.png",
    allowed_mentions: { parse: [], users: [...new Set(ids)].slice(0, 100) },
  };

  await enviarWebhook(WEBHOOK_CONTABILIDADE, {
    ...base,
    content:
      `📒 **Contabilidade semanal — ${dataBrasil()}**\n` +
      `Relatório completo por oficial. PM e PRS recebem **10%** das multas. DTS entra no geral, **sem 10%**.${aviso}`,
    embeds: [
      {
        title: "💰 Folha da semana",
        color: 0x2ecc71,
        fields: [
          {
            name: "🛡️ Polícia Militar",
            value: `Oficiais: **${pm.length}**\nMultas: **${dinheiro(multasPm)}**\n💵 10% a pagar: **${dinheiro(folhaPm)}**`,
            inline: true,
          },
          {
            name: "🛣️ Polícia Rodoviária",
            value: `Oficiais: **${prs.length}**\nMultas: **${dinheiro(multasPrs)}**\n💵 10% a pagar: **${dinheiro(folhaPrs)}**`,
            inline: true,
          },
          {
            name: "📋 Despachante",
            value: `Oficiais: **${dts.length}**\nVeículos: **${veiculosDts.toLocaleString("pt-BR")}**\n💵 10%: **não se aplica**`,
            inline: true,
          },
          {
            name: "🏦 Total a pagar (PM + PRS)",
            value: `**${dinheiro(folhaPm + folhaPrs)}**`,
            inline: false,
          },
        ],
        footer: { text: footer, icon_url: "https://i.imgur.com/aawPk38.png" },
        timestamp: new Date().toISOString(),
      },
    ],
  });

  const blocos = [
    {
      titulo: "🛡️ Polícia Militar — lista completa",
      descricaoTopo: `💵 10% da semana: **${dinheiro(folhaPm)}**`,
      linhas: pm.map((u, i) => linhaPm(u, i + 1)),
      cor: 0x3a4f73,
    },
    {
      titulo: "🛣️ Polícia Rodoviária — lista completa",
      descricaoTopo: `💵 10% da semana: **${dinheiro(folhaPrs)}**`,
      linhas: prs.map((u, i) => linhaPrs(u, i + 1)),
      cor: 0xc9a227,
    },
    {
      titulo: "📋 Despachante — lista completa",
      descricaoTopo: "Sem 10%. Só o volume da semana.",
      linhas: dts.map((u, i) => linhaDts(u, i + 1)),
      cor: 0x5b8a72,
    },
  ];

  for (const bloco of blocos) {
    const embeds = embedsForca({ ...bloco, footer });
    for (let i = 0; i < embeds.length; i += 10) {
      await enviarWebhook(WEBHOOK_CONTABILIDADE, {
        ...base,
        embeds: embeds.slice(i, i + 10),
      });
    }
  }

  console.log(
    `[contabilidade] semanal · PM ${pm.length} oficiais 10% ${dinheiro(folhaPm)} · PRS ${prs.length} oficiais 10% ${dinheiro(folhaPrs)} · DTS ${dts.length} oficiais ${veiculosDts} veículos`,
  );

  return {
    ok: true,
    pm: { oficiais: pm.length, multas: multasPm, dezPorCento: folhaPm },
    prs: { oficiais: prs.length, multas: multasPrs, dezPorCento: folhaPrs },
    dts: { oficiais: dts.length, veiculos: veiculosDts },
    totalPagar: folhaPm + folhaPrs,
  };
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
    await publishContabilidadeSemanal(fechamento.semanal, { republicar });
  }

  const diario = resumoTotais(dadosDiario);
  const semana = resumoTotais(dadosSemanal);
  console.log(
    `[ranking] publicado encerramento · diário PM ${diario.pm} PRS ${diario.prs} DTS ${diario.dts}` +
      (semanal ? ` · semanal PM ${semana.pm} PRS ${semana.prs} DTS ${semana.dts}` : ""),
  );

  return { ok: true, diario, semanal: semanal ? semana : null };
}
