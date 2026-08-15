import { EmbedBuilder } from "discord.js";

const DESC_LIMIT = 3900;

export function chunkText(blocks, limit = DESC_LIMIT) {
  const chunks = [];
  let current = "";

  for (const block of blocks) {
    const next = current ? `${current}\n${block}` : block;
    if (next.length > limit) {
      if (current) chunks.push(current);
      if (block.length > limit) {
        for (let i = 0; i < block.length; i += limit) {
          chunks.push(block.slice(i, i + limit));
        }
        current = "";
      } else {
        current = block;
      }
    } else {
      current = next;
    }
  }

  if (current) chunks.push(current);
  return chunks.length ? chunks : ["Nenhum movimento registrado."];
}

export async function sendReport(channel, { title, color, chunks, footer }) {
  const embeds = chunks.map((description, index) => {
    const embed = new EmbedBuilder()
      .setColor(color)
      .setDescription(description)
      .setTimestamp(new Date());

    if (index === 0) embed.setTitle(title);
    if (footer) embed.setFooter({ text: footer });
    if (chunks.length > 1) {
      embed.setFooter({
        text: `${footer ?? ""} · ${index + 1}/${chunks.length}`.replace(/^ · /, ""),
      });
    }
    return embed;
  });

  for (let i = 0; i < embeds.length; i += 10) {
    await channel.send({ embeds: embeds.slice(i, i + 10) });
  }
}
