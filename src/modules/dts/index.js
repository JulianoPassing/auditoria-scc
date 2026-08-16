import { parseDtsEmbed } from "./parse.js";
import { buildDtsReport } from "./report.js";

/**
 * Armazena os embeds do canal de registros DTS e envia o placar para a calculadora.
 * Não depende de bot de origem: lê o histórico do canal.
 */
export default {
  id: "dts",
  name: "DTS",
  kind: "records",
  guildId: "1328895149392265287",
  listenChannelId: process.env.DTS_CHANNEL_ID || "",
  listenChannelPattern: /registros-dts/i,
  reportChannelId: "1538288085685633056",
  parse: parseDtsEmbed,
  buildReport: buildDtsReport,
};
