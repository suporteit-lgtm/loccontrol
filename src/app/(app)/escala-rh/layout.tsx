import Link from "next/link";
import { contextoEscalaRH, unidadeDaEscala } from "@/lib/escala/rh";
import { lerModos } from "@/lib/escala/envio";
import { AoVivo } from "@/components/escala/AoVivo";

export const dynamic = "force-dynamic";

/** Seção "ESCALA" do LocControl (RH e Admin). Mostra sempre o modo de envio e o estado da unidade. */
export default async function EscalaRHLayout({ children }: { children: React.ReactNode }) {
  await contextoEscalaRH();
  const [modos, { config }] = await Promise.all([lerModos(), unidadeDaEscala()]);

  const avisos: { tom: "warn" | "danger" | "neutro"; texto: string }[] = [];
  if (modos.modo_envio === "DESLIGADO") avisos.push({ tom: "neutro", texto: "E-mails DESLIGADOS — nada é enviado, tudo fica só registrado." });
  if (modos.modo_envio === "TESTE")
    avisos.push({ tom: "warn", texto: `E-mails em modo TESTE — só a allowlist recebe (${modos.allowlist.join(", ") || "vazia"}).` });
  if (modos.modo_google !== "PRODUCAO")
    avisos.push({ tom: "neutro", texto: `Google Agenda e grupos: ${modos.modo_google === "TESTE" ? "modo TESTE (grupos e agenda de teste)" : "DESLIGADO"}.` });
  if (!config.habilitado) avisos.push({ tom: "warn", texto: "Escala ainda não liberada para os colaboradores desta unidade." });

  const cores = {
    warn: ["var(--warn-bg)", "var(--warn-forte)"],
    danger: ["var(--danger-bg)", "var(--danger-forte)"],
    neutro: ["var(--color-neutral-100)", "var(--color-neutral-800)"],
  } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      {avisos.length > 0 && (
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          {avisos.map((a) => (
            <span
              key={a.texto}
              className="tag"
              style={{ background: cores[a.tom][0], color: cores[a.tom][1], fontWeight: 600, fontSize: 12, padding: "5px 12px" }}
            >
              {a.texto}
            </span>
          ))}
          <Link href="/escala-rh/configuracoes" className="btn btn-ghost" style={{ fontSize: 12 }}>
            Configurar →
          </Link>
        </div>
      )}
      <AoVivo />
      {children}
    </div>
  );
}
