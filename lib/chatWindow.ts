// Janelas de 12h do bate-papo. Ancoradas em 00h e 12h no horário de Brasília
// (America/Sao_Paulo, UTC-3 fixo desde o fim do horário de verão em 2019).
// Cada janela vira um item de histórico rotulado por data + faixa de hora.
const TZ_OFFSET_HOURS = -3;
const HALF = 12 * 3600_000;

export type ChatWindow = {
  start: Date; // início da janela (UTC real)
  end: Date; // fim da janela (UTC real)
  key: string; // identificador estável, ex. "2026-08-01-0"
  label: string; // rótulo humano, ex. "01/08/2026 · 00h–12h"
};

// Lê o "relógio de parede" de São Paulo a partir de um instante UTC.
function spParts(d: Date) {
  const sp = new Date(d.getTime() + TZ_OFFSET_HOURS * 3600_000);
  return {
    y: sp.getUTCFullYear(),
    m: sp.getUTCMonth(),
    day: sp.getUTCDate(),
    h: sp.getUTCHours(),
  };
}

export function windowOf(d: Date): ChatWindow {
  const { y, m, day, h } = spParts(d);
  const half = h < 12 ? 0 : 1;

  // Início da janela no relógio de SP, convertido de volta para UTC real.
  const startSpWall = Date.UTC(y, m, day, half === 0 ? 0 : 12, 0, 0, 0);
  const start = new Date(startSpWall - TZ_OFFSET_HOURS * 3600_000);
  const end = new Date(start.getTime() + HALF);

  const dd = String(day).padStart(2, "0");
  const mm = String(m + 1).padStart(2, "0");
  const label = `${dd}/${mm}/${y} · ${half === 0 ? "00h–12h" : "12h–24h"}`;
  const key = `${y}-${mm}-${dd}-${half}`;

  return { start, end, key, label };
}

export function currentWindow(): ChatWindow {
  return windowOf(new Date());
}

// ---------------------------------------------------------------------------
// Consolidação por dia
//
// Enquanto o dia está em curso, faz sentido ver as metades separadas: a janela
// ao vivo e, quando já passou do meio-dia, a janela da manhã que fechou. Quando
// as duas janelas de um dia se completam — ou seja, o dia virou —, aquele dia
// deixa de ser duas entradas e passa a ser uma só. É assim que o histórico vai
// comprimindo: por janela no dia corrente, por dia daí para trás.
// ---------------------------------------------------------------------------
export type ChatBucket = {
  key: string;
  label: string;
  start: Date; // usado só para ordenar
};

// Identificador do dia (relógio de São Paulo), ex. "2026-08-01".
function dayKey(d: Date): string {
  const { y, m, day } = spParts(d);
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

// Em qual "gaveta" uma mensagem cai: a janela de 12h, se for de hoje; o dia
// inteiro, se for de qualquer dia anterior (já consolidado).
export function bucketOf(d: Date, now: Date = new Date()): ChatBucket {
  const w = windowOf(d);
  if (dayKey(d) === dayKey(now)) {
    return { key: w.key, label: w.label, start: w.start };
  }

  const { y, m, day } = spParts(d);
  const dd = String(day).padStart(2, "0");
  const mm = String(m + 1).padStart(2, "0");
  // Início do dia (00h de SP) em UTC real — só para ordenação.
  const start = new Date(Date.UTC(y, m, day, 0, 0, 0, 0) - TZ_OFFSET_HOURS * 3600_000);

  return { key: dayKey(d), label: `${dd}/${mm}/${y} · dia completo`, start };
}
