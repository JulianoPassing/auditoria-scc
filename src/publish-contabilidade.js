import "dotenv/config";
import { fecharRankings, publishContabilidadeSemanal } from "./core/ranking-discord.js";

const { semanal } = fecharRankings();
const resultado = await publishContabilidadeSemanal(semanal, { republicar: true });
console.log(JSON.stringify(resultado, null, 2));
