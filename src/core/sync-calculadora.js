import { lastWeeklyResetMs } from "./day.js";
import { aggregateRanking } from "./store.js";

const DEFAULT_URL = "https://calculadora-scc.vercel.app/api/auditoria-sync";

export async function syncDtsCalculadora(mod) {
  if (mod?.kind !== "records") return null;

  const secret = process.env.CALCULADORA_SYNC_SECRET;
  if (!secret) {
    console.warn("[ranking] CALCULADORA_SYNC_SECRET ausente — gravado local, ranking não atualizado");
    return null;
  }

  const sinceMs = lastWeeklyResetMs();
  const users = aggregateRanking(mod.id, { sinceMs });
  const url = process.env.CALCULADORA_SYNC_URL || DEFAULT_URL;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret,
      fonte: "auditoria-ranking",
      sinceMs,
      users,
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`calculadora ${response.status}: ${body.slice(0, 240)}`);
  }

  const dts = users.reduce((sum, u) => sum + (Number(u.dts?.veiculos) || 0), 0);
  const pm = users.reduce((sum, u) => sum + (Number(u.pm?.apreensoes) || 0), 0);
  const prs = users.reduce((sum, u) => sum + (Number(u.prs?.apreensoes) || 0), 0);
  console.log(`[ranking] relatorios.html atualizado: ${users.length} oficiais · PM ${pm} · PRS ${prs} · DTS ${dts}`);
  return { users: users.length, dts, pm, prs };
}
