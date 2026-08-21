// Helpers de formatação compartilhados entre servidor e cliente.

/** dd/mm/aaaa a partir de ISO (date ou timestamptz) */
export function dataBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso.length === 10 ? iso + "T00:00:00" : iso);
  if (isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)}/${d.getFullYear()}`;
}

/** dd/mm HH:MM (formato dos eventos/auditoria do protótipo) */
export function quandoBR(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return "—";
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getDate())}/${p(d.getMonth() + 1)} ${p(d.getHours())}:${p(d.getMinutes())}`;
}

export function agora(): string {
  return quandoBR(new Date().toISOString());
}

/** SLA no formato do protótipo: cor/peso conforme urgência. */
export interface Sla {
  txt: string;
  cor: string;
  peso: number;
}

export function sla(alvoIso: string | null | undefined, agoraMs?: number): Sla | null {
  if (!alvoIso) return null;
  const alvo = new Date(alvoIso).getTime();
  if (isNaN(alvo)) return null;
  const H = 3600e3;
  const d = Math.max(0, alvo - (agoraMs ?? Date.now()));
  const hh = Math.floor(d / H);
  const mm = Math.floor((d % H) / 60e3);
  const txt = hh >= 48 ? `em ${Math.floor(hh / 24)} dias` : `${hh}h ${String(mm).padStart(2, "0")}min`;
  if (hh >= 24) return { txt, cor: "var(--color-neutral-700)", peso: 400 };
  if (hh >= 12) return { txt, cor: "var(--warn-forte)", peso: 500 };
  return { txt, cor: "var(--warn-forte)", peso: 700 };
}

/** Avatar determinístico: iniciais + cor derivada do nome (paleta do protótipo). */
export interface Avatar {
  ini: string;
  bg: string;
  cor: string;
  borda: string;
}

export function avatar(nome: string): Avatar {
  const pal = ["#5980a6", "#6f9a6b", "#b0894a", "#8a6fa6", "#a66f76", "#5f9a94"];
  let h = 0;
  for (const ch of nome) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const c = pal[h % pal.length];
  const ps = nome.trim().split(/\s+/);
  return {
    ini: ((ps[0]?.[0] ?? "?") + (ps.length > 1 ? ps[ps.length - 1][0] : "")).toUpperCase(),
    bg: `color-mix(in srgb, ${c} 16%, var(--color-surface))`,
    cor: `color-mix(in srgb, ${c} 72%, var(--color-text))`,
    borda: `color-mix(in srgb, ${c} 38%, transparent)`,
  };
}

/** nome.sobrenome@locgrupo.com.br */
/** Padrão da empresa: primeiro.ultimo@locgrupo.com.br (nomes do meio saem). */
export function emailSugerido(nome: string): string {
  const partes = nome
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z\s]/g, "")
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (!partes.length) return "@locgrupo.com.br";
  const local = partes.length === 1 ? partes[0] : `${partes[0]}.${partes[partes.length - 1]}`;
  return `${local}@locgrupo.com.br`;
}

/** Pill de status do colaborador */
export function pill(st: string) {
  if (st === "Ativo") return { bg: "var(--ok-bg)", cor: "var(--ok-forte)", borda: "transparent" };
  if (st === "Afastado") return { bg: "var(--warn-bg)", cor: "var(--warn-forte)", borda: "transparent" };
  if (st === "Desligado")
    return { bg: "var(--color-neutral-300)", cor: "var(--color-neutral-800)", borda: "transparent" };
  return { bg: "transparent", cor: "var(--color-neutral-700)", borda: "var(--color-neutral-400)" };
}

export function unidadeFull(c: { cidade?: string | null; unidade?: string | null }): string {
  if (!c?.unidade) return "—";
  return c.cidade ? `${c.cidade} · ${c.unidade}` : c.unidade;
}

export function primeiroNome(nome: string) {
  return nome.split(" ")[0];
}
