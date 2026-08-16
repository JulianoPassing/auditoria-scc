function stripMarkdown(text) {
  return String(text ?? "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .trim();
}

function fieldValue(embed, namePattern) {
  const fields = embed.fields || embed.data?.fields || [];
  const field = fields.find((f) => namePattern.test(stripMarkdown(f.name || "")));
  return stripMarkdown(field?.value || "");
}

export function parseDtsEmbed(message) {
  const embed = message.embeds?.[0];
  if (!embed) return null;

  const title = stripMarkdown(embed.title ?? "");
  let tipo = null;
  if (/altera[cç][aã]o de caracter/i.test(title)) tipo = "alteracao";
  else if (/registro detran street/i.test(title)) tipo = "registro";
  else return null;

  const registrado = fieldValue(embed, /registrado por/i);
  const discordId =
    registrado.match(/discord id:\s*(\d{15,25})/i)?.[1] ||
    registrado.match(/<@(\d{15,25})>/)?.[1];
  if (!discordId) return null;

  const nomeRegistrado = registrado.match(/nome:\s*(.+)/i)?.[1]?.trim();
  const oficial = fieldValue(embed, /oficial dts/i);

  return {
    kind: "record",
    tipo,
    discordId,
    name: oficial || nomeRegistrado || "Usuário",
    at: message.createdTimestamp ?? null,
  };
}
