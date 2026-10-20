// Formatação de datas da Escala (pura — usada no servidor, nos e-mails e no navegador).
const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const SEMANA = ["domingo", "segunda-feira", "terça-feira", "quarta-feira", "quinta-feira", "sexta-feira", "sábado"];
const SEMANA_CURTA = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];

/** Primeira letra maiúscula (o resto como está). */
export function maiuscula(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export function nomeMes(mes1a12: number): string {
  return MESES[mes1a12 - 1];
}

function partes(iso: string) {
  const [a, m, d] = iso.split("-").map(Number);
  return { a, m, d, sem: new Date(Date.UTC(a, m - 1, d)).getUTCDay() };
}

/** "terça-feira, 6 de outubro" */
export function dataLonga(iso: string): string {
  const { m, d, sem } = partes(iso);
  return `${SEMANA[sem]}, ${d} de ${MESES[m - 1]}`;
}

/** "ter, 06/10" */
export function dataCurta(iso: string): string {
  const { m, d, sem } = partes(iso);
  return `${SEMANA_CURTA[sem]}, ${String(d).padStart(2, "0")}/${String(m).padStart(2, "0")}`;
}

/** "seg., 05/10, 18:00" no horário de São Paulo */
export function horaSP(instante: string | Date): string {
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Sao_Paulo",
    hour: "2-digit",
    minute: "2-digit",
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  }).format(new Date(instante));
}

/** "1h 05min" / "12min" / "agora" */
export function restante(ms: number): string {
  if (ms <= 0) return "expirada";
  const min = Math.ceil(ms / 60_000);
  const h = Math.floor(min / 60);
  return h ? `${h}h ${String(min % 60).padStart(2, "0")}min` : `${min}min`;
}
