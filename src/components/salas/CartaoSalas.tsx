import { LogoGoogle } from "@/components/escala/CartaoEscala";

/** Cartão do módulo de salas (escolha de módulo e login de /salas). */
export function CartaoSalas({ href, compacto = false }: { href: string; compacto?: boolean }) {
  return (
    <a href={href} className="modulo-destaque" style={compacto ? { padding: "14px 18px 12px", gap: 6 } : undefined}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
        <span style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.16em", color: "var(--accent-base)" }}>SALAS DE REUNIÃO</span>
        <span className="modulo-selo">novo</span>
      </div>
      <span style={{ fontWeight: 800, fontSize: compacto ? 17 : 21, lineHeight: 1.2, color: "#10162b" }}>Agende uma sala</span>
      {!compacto && (
        <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "#4a5468" }}>
          Veja os horários livres de todas as salas e reserve em poucos cliques.
        </span>
      )}
      <span className="modulo-cta" style={compacto ? { marginTop: 2, paddingTop: 10 } : undefined}>
        <LogoGoogle />
        Entrar com Google
        <span style={{ marginLeft: "auto", fontSize: 18, lineHeight: 1 }}>→</span>
      </span>
    </a>
  );
}
