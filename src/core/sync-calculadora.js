import {
  lastDailyResetMs,
  lastWeeklyResetMs,
  previousDailyResetMs,
  previousWeeklyResetMs,
} from "./day.js";
import { aggregateRanking } from "./store.js";

const DEFAULT_URL = "https://calculadora-scc.vercel.app/api/auditoria-sync";

function toPayloadUsers(users) {
  return users.map((u) => ({
    id: u.id,
    apelido: u.apelido,
    veiculos: Number(u.dts?.veiculos) || 0,
    pm: u.pm,
    prs: u.prs,
    dts: u.dts,
  }));
}

function totais(users) {
  return {
    oficiais: users.length,
    pm: users.reduce((sum, u) => sum + (Number(u.pm?.apreensoes) || 0), 0),
    prs: users.reduce((sum, u) => sum + (Number(u.prs?.apreensoes) || 0), 0),
    dts: users.reduce((sum, u) => sum + (Number(u.dts?.veiculos) || 0), 0),
  };
}

export async function syncDtsCalculadora(mod) {
  if (mod?.kind !== "records") return null;

  const secret = process.env.CALCULADORA_SYNC_SECRET;
  if (!secret) {
    console.warn("[ranking] CALCULADORA_SYNC_SECRET ausente — gravado local, ranking não atualizado");
    return null;
  }

  const diarioInicio = lastDailyResetMs();
  const semanalInicio = lastWeeklyResetMs();
  const users = aggregateRanking(mod.id, { sinceMs: semanalInicio });
  const diario = aggregateRanking(mod.id, { sinceMs: diarioInicio });
  const fechamentoDiario = aggregateRanking(mod.id, {
    sinceMs: previousDailyResetMs(),
    untilMs: diarioInicio,
  });
  const fechamentoSemanal = aggregateRanking(mod.id, {
    sinceMs: previousWeeklyResetMs(),
    untilMs: semanalInicio,
  });
  const url = process.env.CALCULADORA_SYNC_URL || DEFAULT_URL;
  const payloadUsers = toPayloadUsers(users);

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret,
      fonte: "auditoria-ranking",
      sinceMs: semanalInicio,
      sinceDiarioMs: diarioInicio,
      users: payloadUsers,
      diario: toPayloadUsers(diario),
      fechamentoDiario: toPayloadUsers(fechamentoDiario),
      fechamentoSemanal: toPayloadUsers(fechamentoSemanal),
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`calculadora ${response.status}: ${body.slice(0, 240)}`);
  }

  let remoto = {};
  try {
    remoto = JSON.parse(body);
  } catch {
    remoto = {};
  }

  const semana = totais(users);
  const dia = totais(diario);
  const fechouDia = totais(fechamentoDiario);
  const fechouSemana = totais(fechamentoSemanal);
  console.log(
    `[ranking] relatorios.html atualizado: semana ${semana.oficiais} oficiais · PM ${semana.pm} · PRS ${semana.prs} · DTS ${semana.dts}` +
      ` · diário PM ${dia.pm} PRS ${dia.prs} DTS ${dia.dts}` +
      ` · fechamento dia DTS ${fechouDia.dts} · fechamento semana DTS ${fechouSemana.dts}` +
      (remoto.veiculos != null ? ` · vercel DTS ${remoto.veiculos}` : ""),
  );
  return { users: users.length, dts: semana.dts, pm: semana.pm, prs: semana.prs };
}
