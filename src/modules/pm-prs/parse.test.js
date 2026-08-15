import { parseStorageEmbed } from "./parse.js";

const sample =
  "O jogador **Noel** (steam:**110000156c2b600**, 583) **pegou** o item **moderninha** x87 (metadados: []) **do** armazenamento **bau_utils_prs** nas coordenadas 188.2, 3145.2, 45.4.";

const event = parseStorageEmbed({
  embeds: [{ title: "Armazenamento - bau_utils_prs", description: sample }],
});

const checks = [
  event?.name === "Noel",
  event?.steam === "110000156c2b600",
  event?.action === "pegou",
  event?.item === "moderninha",
  event?.quantity === 87,
  event?.storage === "bau_utils_prs",
];

if (checks.some((ok) => !ok)) {
  console.error("parse falhou", event);
  process.exit(1);
}

console.log("parse ok", event);
