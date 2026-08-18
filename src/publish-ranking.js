import "dotenv/config";
import { publishClosingRankings } from "./core/ranking-discord.js";
import { modules } from "./modules/index.js";

const dts = modules.find((mod) => mod.id === "dts");

const resultado = await publishClosingRankings({
  moduleId: dts?.id || "dts",
  republicar: true,
  semanal: true,
});

console.log(JSON.stringify(resultado, null, 2));
