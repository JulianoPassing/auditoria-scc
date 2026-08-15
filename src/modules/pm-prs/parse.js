function stripMarkdown(text) {
  return String(text ?? "")
    .replace(/\*\*/g, "")
    .replace(/__/g, "")
    .replace(/`/g, "")
    .trim();
}

const PATTERN =
  /O jogador\s+(.+?)\s+\(steam:([^,\s)]+)\s*,\s*(\d+)\)\s+(pegou|colocou)\s+o item\s+(.+?)\s+x(\d+)/i;

export function parseStorageEmbed(message) {
  const embed = message.embeds?.[0];
  if (!embed) return null;

  const title = stripMarkdown(embed.title ?? "");
  const description = stripMarkdown(embed.description ?? embed.data?.description ?? "");
  if (!description) return null;
  if (title && !/armazenamento/i.test(title) && !/armazenamento/i.test(description)) {
    return null;
  }

  const match = description.match(PATTERN);
  if (!match) return null;

  const storageFromTitle = title.match(/armazenamento\s*[-–:]\s*(\S+)/i)?.[1];
  const storageFromBody = description.match(/armazenamento\s+(\S+)/i)?.[1];

  return {
    name: match[1].trim(),
    steam: match[2].trim(),
    sourceId: match[3],
    action: match[4].toLowerCase(),
    item: match[5].trim(),
    quantity: Number(match[6]),
    storage: storageFromBody || storageFromTitle || "desconhecido",
  };
}
