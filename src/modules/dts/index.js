import { parseDtsEmbed } from "./parse.js";
import { buildDtsReport } from "./report.js";

/**
 * Lê os canais das calculadoras (PM, PRS, DTS), armazena os embeds
 * e manda o placar da semana para relatorios.html / ranking.
 */
export default {
  id: "dts",
  name: "Ranking calculadora",
  kind: "records",
  guildId: "1328895149392265287",
  listenChannelId: process.env.DTS_CHANNEL_ID || "1535472849853087765",
  listenChannelIds: [
    "1535472849853087765",
    "1424794466849652897",
    "1535473810931843222",
    "1536925267866685510",
  ],
  listenChannelPatterns: [
    /registros-dts/i,
    /ficha.*pm|criminal.*pm/i,
    /ficha.*prs|criminal.*prs/i,
    /p[áa]tio|apreens[aã]o.?veicular/i,
    /multas?/i,
    /blitz|fiscal/i,
    /ilegais/i,
  ],
  reportChannelId: "1538288085685633056",
  parse: parseDtsEmbed,
  buildReport: buildDtsReport,
};
