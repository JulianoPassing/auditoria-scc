import "dotenv/config";
import { publishClosingRankings } from "./core/ranking-discord.js";
import { syncDtsCalculadora } from "./core/sync-calculadora.js";
import { modules } from "./modules/index.js";

const dts = modules.find((mod) => mod.id === "dts");

const resultado = await publishClosingRankings({
  moduleId: dts?.id || "dts",
  republicar: true,
  semanal: true,
});

if (dts) {
  await syncDtsCalculadora(dts).catch((err) => {
    console.error("[ranking] sync da calculadora falhou (relatório do Discord já foi)", err);
  });
}

console.log(JSON.stringify(resultado, null, 2));
