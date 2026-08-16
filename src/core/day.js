export const TIMEZONE = "America/Sao_Paulo";

function partsInTz(date = new Date(), timeZone = TIMEZONE) {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });
  return Object.fromEntries(
    fmt.formatToParts(date).filter((p) => p.type !== "literal").map((p) => [p.type, p.value]),
  );
}

export function dateKey(date = new Date()) {
  const p = partsInTz(date);
  return `${p.year}-${p.month}-${p.day}`;
}

export function startOfDayMs(key = dateKey()) {
  return new Date(`${key}T00:00:00-03:00`).getTime();
}

export function shiftDateKey(key, days) {
  return dateKey(new Date(startOfDayMs(key) + days * 86400000 + 12 * 3600000));
}

export function previousDateKey(date = new Date()) {
  return shiftDateKey(dateKey(date), -1);
}

export function formatDateBr(key) {
  const [y, m, d] = key.split("-");
  return `${d}/${m}/${y}`;
}

export function snowflakeFromMs(ms) {
  const discordEpoch = 1420070400000n;
  const ts = BigInt(Math.max(0, ms - Number(discordEpoch)));
  return (ts << 22n).toString();
}

/** Segunda 04:30 UTC (01:30 BRT), mesmo horário do reset semanal da calculadora. */
export function lastWeeklyResetMs(now = new Date()) {
  const utcDay = now.getUTCDay();
  const daysSinceMonday = (utcDay + 6) % 7;
  let reset = Date.UTC(
    now.getUTCFullYear(),
    now.getUTCMonth(),
    now.getUTCDate() - daysSinceMonday,
    4,
    30,
    0,
    0,
  );
  if (now.getTime() < reset) reset -= 7 * 86_400_000;
  return reset;
}
