import { parseStorageEmbed } from "./parse.js";
import { buildPmPrsReport } from "./report.js";

/**
 * Módulo PM / PRS
 *
 * Para criar outro módulo: copie esta pasta, troque `id`, canais e o parse.
 * Depois registre em src/modules/index.js.
 */
export default {
  id: "pm-prs",
  name: "PM / PRS",
  guildId: "1328895149392265287",
  listenChannelId: "1465711267179397264",
  reportChannelId: "1538288085685633056",
  sourceAppId: "1465711301975081111",
  parse: parseStorageEmbed,
  buildReport: buildPmPrsReport,
};
