import { lastWeeklyResetMs } from "./day.js";
import { aggregateRecords } from "./store.js";

const DEFAULT_URL = "https://calculadora-scc.vercel.app/api/auditoria-sync";

export async function syncDtsCalculadora(mod) {
  if (mod?.id !== "dts") return null;

  const secret = process.env.CALCULADORA_SYNC_SECRET;
  if (!secret) {
    console.warn("[dts] CALCULADORA_SYNC_SECRET ausente — gravado local, ranking não atualizado");
    return null;
  }

  const sinceMs = lastWeeklyResetMs();
  const users = aggregateRecords(mod.id, { sinceMs, tipo: "registro" });
  const url = process.env.CALCULADORA_SYNC_URL || DEFAULT_URL;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret,
      fonte: "auditoria-dts",
      sinceMs,
      users: users.map(({ id, apelido, veiculos }) => ({ id, apelido, veiculos })),
    }),
  });

  const body = await response.text();
  if (!response.ok) {
    throw new Error(`calculadora ${response.status}: ${body.slice(0, 240)}`);
  }

  const total = users.reduce((sum, u) => sum + u.veiculos, 0);
  console.log(`[dts] ranking atualizado: ${users.length} oficiais, ${total} registros`);
  return { users: users.length, total };
}
