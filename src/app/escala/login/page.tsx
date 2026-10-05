import { redirect } from "next/navigation";
import { contaPortal } from "@/lib/escala/auth";

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
            gap: 32,
            width: "min(360px, 100%)",
            animation: "entrada 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.1) both",
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, margin: 0, letterSpacing: "-0.01em" }}>Escala de Presença</h1>
            <p className="text-muted" style={{ fontSize: 14, margin: "8px 0 0", lineHeight: 1.5 }}>
              Use seu e-mail @locgrupo.com.br
            </p>
          </div>

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

          <a
            href="/escala/auth/login"
            className="btn btn-primary btn-block"
            style={{ height: 48, fontSize: 15, marginTop: 0, fontWeight: 700, gap: 10, textDecoration: "none" }}
          >
            <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
              <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
              <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
              <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
              <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.4 2.2-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
            </svg>
            Entrar com Google
          </a>
        </div>

        <div className="text-muted" style={{ fontSize: 11, marginTop: "var(--space-8)" }}>
          acesso restrito · @locgrupo.com.br
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
            "Grupos A e B se alternam a cada dia útil",
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
