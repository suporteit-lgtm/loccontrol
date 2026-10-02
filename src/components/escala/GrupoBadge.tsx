/** Grupo da escala: cor da paleta atual + a letra (nunca só a cor). A = accent, B = warn. */
export function GrupoBadge({ grupo, rotulo = false }: { grupo: "A" | "B"; rotulo?: boolean }) {
  const cor = grupo === "A" ? "var(--color-accent)" : "var(--warn)";
  return (
    <span
      className="tag"
      style={{
        background: `color-mix(in srgb, ${cor} 16%, transparent)`,
        color: grupo === "A" ? "var(--color-accent-700)" : "var(--warn-forte)",
        border: `1px solid color-mix(in srgb, ${cor} 40%, transparent)`,
        fontWeight: 800,
      }}
    >
      {rotulo ? `Grupo ${grupo}` : grupo}
    </span>
  );
}
