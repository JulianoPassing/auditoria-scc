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

export function parseMoney(text) {
  const s = stripMarkdown(text).replace(/R\$/gi, "").trim();
  if (!s) return 0;
  let normalized = s;
  if (s.includes(",")) {
    normalized = s.replace(/\./g, "").replace(",", ".");
  } else if (/\.\d{3}(\.|$)/.test(s)) {
    normalized = s.replace(/\./g, "");
  }
  const n = Number(String(normalized).replace(/[^\d.-]/g, ""));
  return Number.isFinite(n) && n > 0 ? n : 0;
}

function registrado(embed) {
  const texto = fieldValue(embed, /registrado por/i);
  const discordId =
    texto.match(/discord id:\s*(\d{15,25})/i)?.[1] ||
    texto.match(/<@(\d{15,25})>/)?.[1];
  const nomeRegistrado = texto.match(/nome:\s*(.+)/i)?.[1]?.trim();
  const oficial = fieldValue(embed, /oficial/i);
  return {
    discordId: discordId || null,
    name: oficial || nomeRegistrado || "Usuário",
  };
}

function event(message, embed, extra) {
  const who = registrado(embed);
  if (!who.discordId) return null;
  return {
    kind: "record",
    discordId: who.discordId,
    name: who.name,
    quantidade: 1,
    valorMulta: 0,
    at: message.createdTimestamp ?? null,
    ...extra,
  };
}

export function parseRankingEmbed(message) {
  const embed = message.embeds?.[0];
  if (!embed) return null;

  const title = stripMarkdown(embed.title ?? "");

  if (/altera[cç][aã]o de caracter/i.test(title)) {
    return event(message, embed, { forca: "dts", tipo: "alteracao" });
  }
  if (/registro detran street/i.test(title)) {
    return event(message, embed, { forca: "dts", tipo: "dts" });
  }
  if (/ficha criminal\s*[—-]\s*pm/i.test(title)) {
    return event(message, embed, {
      forca: "pm",
      tipo: "apreensao_pessoa",
      valorMulta: parseMoney(fieldValue(embed, /multa final/i)),
    });
  }
  if (/ficha criminal\s*[—-]\s*prs/i.test(title)) {
    return event(message, embed, {
      forca: "prs",
      tipo: "apreensao_pessoa",
      valorMulta: parseMoney(fieldValue(embed, /multa final/i)),
    });
  }
  if (/apreens[aã]o veicular\s*[—-]\s*prs/i.test(title)) {
    const qtd = Number(title.match(/\((\d+)\s*ve/i)?.[1]) || 1;
    return event(message, embed, {
      forca: "prs",
      tipo: "apreensao_veiculo",
      quantidade: qtd,
      valorMulta: parseMoney(fieldValue(embed, /multa total/i)),
    });
  }
  if (/multa veicular\s*[—-]\s*prs/i.test(title)) {
    return event(message, embed, {
      forca: "prs",
      tipo: "multa",
      valorMulta: parseMoney(fieldValue(embed, /multa total/i)),
    });
  }
  if (/registro de blitz\s*[—-]\s*prs/i.test(title)) {
    return event(message, embed, { forca: "prs", tipo: "blitz" });
  }
  if (/apreens[aã]o de ilegais\s*[—-]\s*pm/i.test(title)) {
    return event(message, embed, { forca: "pm", tipo: "apreensao_ilegais" });
  }
  if (/apreens[aã]o de ilegais\s*[—-]\s*prs/i.test(title)) {
    return event(message, embed, { forca: "prs", tipo: "apreensao_ilegais" });
  }

  return null;
}

export const parseDtsEmbed = parseRankingEmbed;
