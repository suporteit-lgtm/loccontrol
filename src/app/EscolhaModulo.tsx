/** Tela de entrada: Escala de Presença em destaque; LocControl como acesso secundário. */
import { CartaoEscala } from "@/components/escala/CartaoEscala";
import type { DiaSemana } from "@/lib/escala/semana";

export type { DiaSemana };

export function EscolhaModulo({ semana, hrefEscala = "/escala" }: { semana: DiaSemana[] | null; hrefEscala?: string }) {
  return (
    <div className="login-split">
      <div className="login-form-panel">
        <div style={{ marginBottom: "var(--space-8)" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="/logo.png"
            alt="Locagora"
            data-logo="1"
            style={{ width: 140, maxWidth: "100%", filter: "brightness(1.35) saturate(1.05)" }}
          />
        </div>

        <div
          style={{
            display: "flex",
            flexDirection: "column",
            gap: 22,
            width: "min(400px, 100%)",
            animation: "entrada 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.1) both",
          }}
        >
          <div>
            <h1 style={{ fontSize: 26, margin: 0, letterSpacing: "-0.015em" }}>Onde você quer entrar?</h1>
            <p className="text-muted" style={{ fontSize: 14, margin: "8px 0 0", lineHeight: 1.5 }}>
              Escolha o módulo para continuar.
            </p>
          </div>

          {/* Destaque: Escala de Presença */}
          <CartaoEscala semana={semana} href={hrefEscala} />

          <div style={{ display: "flex", alignItems: "center", gap: 12, color: "rgb(255 255 255 / 0.4)", fontSize: 11.5 }}>
            <span style={{ flex: 1, height: 1, background: "rgb(255 255 255 / 0.14)" }} />
            equipe de RH e TI
            <span style={{ flex: 1, height: 1, background: "rgb(255 255 255 / 0.14)" }} />
          </div>

          {/* Secundário: LocControl */}
          <a href="/login" className="modulo-opcao">
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0 }}>
              <span style={{ fontWeight: 800, fontSize: 10.5, letterSpacing: "0.16em", opacity: 0.7 }}>LOCCONTROL</span>
              <span style={{ fontWeight: 600, fontSize: 14 }}>Gestão de RH e TI</span>
            </span>
            <span style={{ fontSize: 12.5, opacity: 0.7, whiteSpace: "nowrap" }}>Entrar →</span>
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
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "color-mix(in srgb, #fff 78%, transparent)", maxWidth: 480, marginTop: 16 }}>
          Segunda e sexta são do seu grupo; de terça a quinta, qualquer pessoa agenda. Quem não puder ir libera o lugar para quem está na fila.
        </p>
        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 48 }}>
          {[
            "Calendário do mês com o seu grupo e as vagas livres",
            "Reserva e lista de espera com aviso por e-mail",
            "Os seus dias direto no Google Agenda",
          ].map((linha) => (
            <div key={linha} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--ok-base)", flex: "none" }} />
              <span style={{ fontSize: 14.5, color: "color-mix(in srgb, #fff 82%, transparent)" }}>{linha}</span>
            </div>
          ))}
        </div>
        <span
          style={{
            position: "absolute",
            left: "clamp(32px, 6vw, 72px)",
            bottom: "clamp(32px, 6vw, 72px)",
            fontSize: 12,
            color: "color-mix(in srgb, #fff 40%, transparent)",
          }}
        >
          © 2026 Locagora. Todos os direitos reservados.
        </span>
      </div>
    </div>
  );
}
