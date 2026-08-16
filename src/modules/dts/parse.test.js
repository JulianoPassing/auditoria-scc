import { parseDtsEmbed } from "./parse.js";

const message = {
  createdTimestamp: 1_755_280_000_000,
  embeds: [
    {
      title: "📄 Registro Detran Street — DTS",
      fields: [
        { name: "🛡️ Oficial DTS", value: "EST Juliano" },
        {
          name: "📡 Registrado por",
          value: "**Nome:** EST Juliano\n**Discord ID:** `123456789012345678`\n**@usuário:** <@123456789012345678>",
        },
      ],
    },
  ],
};

const event = parseDtsEmbed(message);
const checks = [
  event?.tipo === "registro",
  event?.discordId === "123456789012345678",
  event?.name === "EST Juliano",
];

if (checks.some((ok) => !ok)) {
  console.error("parse dts falhou", event);
  process.exit(1);
}

const alteracao = parseDtsEmbed({
  createdTimestamp: 1,
  embeds: [{ title: "🔧 Alteração de Característica — DTS", fields: message.embeds[0].fields }],
});
if (alteracao?.tipo !== "alteracao") {
  console.error("parse alteração falhou", alteracao);
  process.exit(1);
}

console.log("parse dts ok", event);
