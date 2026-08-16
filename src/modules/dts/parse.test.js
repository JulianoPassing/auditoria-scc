import { parseDtsEmbed, parseMoney } from "./parse.js";

const fields = [
  { name: "🛡️ Oficial DTS", value: "EST Juliano" },
  {
    name: "📡 Registrado por",
    value: "**Nome:** EST Juliano\n**Discord ID:** `123456789012345678`\n**@usuário:** <@123456789012345678>",
  },
  { name: "💰 Multa final", value: "**R$ 1.500,00**" },
  { name: "💰 Multa total", value: "**R$ 2.000**" },
];

function msg(title) {
  return { createdTimestamp: 1, embeds: [{ title, fields }] };
}

const dts = parseDtsEmbed(msg("📄 Registro Detran Street — DTS"));
const checks = [
  dts?.tipo === "dts",
  dts?.forca === "dts",
  dts?.discordId === "123456789012345678",
  dts?.name === "EST Juliano",
  parseDtsEmbed(msg("🔧 Alteração de Característica — DTS"))?.tipo === "alteracao",
  parseDtsEmbed(msg("📋 Ficha Criminal — PM"))?.tipo === "apreensao_pessoa",
  parseDtsEmbed(msg("📋 Ficha Criminal — PRS"))?.forca === "prs",
  parseDtsEmbed(msg("🚗 Apreensão Veicular — PRS (3 veículos)"))?.quantidade === 3,
  parseDtsEmbed(msg("💰 Multa Veicular — PRS"))?.tipo === "multa",
  parseDtsEmbed(msg("🚦 Registro de Blitz — PRS"))?.tipo === "blitz",
  parseDtsEmbed(msg("📦 Apreensão de Ilegais — PM"))?.forca === "pm",
  parseMoney("**R$ 1.500,00**") === 1500,
];

if (checks.some((ok) => !ok)) {
  console.error("parse ranking falhou", dts, checks);
  process.exit(1);
}

console.log("parse ranking ok", dts);
