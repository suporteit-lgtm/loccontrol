import { redirect } from "next/navigation";
import { contaPortal } from "@/lib/escala/auth";
import { semanaDaEscala } from "@/lib/escala/semana";
import { CartaoEscala } from "@/components/escala/CartaoEscala";

export const dynamic = "force-dynamic";

const ERROS: Record<string, string> = {
  dominio: "Esta conta não é @locgrupo.com.br. Entre com o seu e-mail corporativo.",
  falha: "Não foi possível concluir o login. Tente de novo.",
};

/** Mesmo fundo e layout da tela de login do LocControl, com um único botão Google. */
export default async function EscalaLoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  if (await contaPortal()) redirect("/escala");
  const { erro } = await searchParams;
  const msg = erro ? (ERROS[erro] ?? ERROS.falha) : null;
  const semana = await semanaDaEscala();

  return (
    <div className="login-split">
      <div className="login-form-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: "var(--space-8)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Locagora"
            data-logo="1"
            style={{ width: 140, maxWidth: "100%", filter: "brightness(1.35) saturate(1.05)" }}
          />
          <div style={{ width: 1, height: 24, background: "rgb(255 255 255 / 0.15)" }} />
          <div style={{ fontWeight: 800, fontSize: 13, letterSpacing: "0.16em", color: "#fff", opacity: 0.9 }}>ESCALA</div>
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 16,
            width: "min(400px, 100%)",
            animation: "entrada 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.1) both",
          }}
        >
          {msg && (
            <div
              role="alert"
              style={{
                fontSize: 13,
                color: "var(--danger-forte)",
                background: "var(--danger-bg)",
                border: "1px solid color-mix(in srgb, var(--danger-base) 30%, transparent)",
                borderRadius: 8,
                padding: "10px 14px",
              }}
            >
              {msg}
            </div>
          )}

          <CartaoEscala semana={semana} href="/escala/auth/login" />
          <p className="text-muted" style={{ fontSize: 12.5, margin: 0, textAlign: "center" }}>Use seu e-mail @locgrupo.com.br</p>
        </div>

        <div className="text-muted" style={{ fontSize: 11, marginTop: "var(--space-8)" }}>
          acesso restrito · @locgrupo.com.br · <a href="/" style={{ color: "inherit" }}>trocar módulo</a>
        </div>
      </div>

      <div className="login-hero">
        <h1 style={{ fontSize: "clamp(28px, 3.6vw, 44px)", color: "#fff", maxWidth: 620, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
          Seu lugar no escritório,<br />
          <span style={{ color: "var(--ok-base)" }}>sem surpresa</span>
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "color-mix(in srgb, #fff 78%, transparent)", maxWidth: 460, marginTop: 16 }}>
          Veja os dias do seu grupo, reserve uma vaga livre ou entre na lista de espera.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 48 }}>
          {[
            "Segunda e sexta do seu grupo; terça a quinta livres para agendar",
            "Não vai? Avise e libere seu lugar para outra pessoa",
            "Lembretes por e-mail e os dias direto no Google Agenda",
          ].map((linha) => (
            <div key={linha} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--ok-base)", flex: "none" }} />
              <span style={{ fontSize: 14.5, color: "color-mix(in srgb, #fff 82%, transparent)" }}>{linha}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
