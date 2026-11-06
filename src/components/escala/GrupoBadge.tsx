import type { Grupo } from "@/lib/escala/calendario";
/** Grupo da escala: cor da paleta atual + a letra (nunca só a cor). A = accent (azul), B = verde Locagora, C = roxo. */
const COR = { A: ["var(--color-accent)", "var(--color-accent-700)"], B: ["var(--ok)", "var(--ok-forte)"], C: ["var(--grupo-c)", "var(--grupo-c-forte)"] } as const;
export function GrupoBadge({ grupo, rotulo = false }: { grupo: Grupo; rotulo?: boolean }) {
  const [cor, forte] = COR[grupo];
  return (
    <span
      className="tag"
      style={{
        background: `color-mix(in srgb, ${cor} 16%, transparent)`,
        color: forte,
        border: `1px solid color-mix(in srgb, ${cor} 40%, transparent)`,
        fontWeight: 800,
      }}
    >
      {rotulo ? `Grupo ${grupo}` : grupo}
    </span>
  );
}
