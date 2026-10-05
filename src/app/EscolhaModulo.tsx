/** Tela de entrada: Escala de Presença em destaque; LocControl como acesso secundário. */
export interface DiaSemana {
  nome: string; // "Seg"
  data: string; // AAAA-MM-DD
  /** dia útil da escala; com grupo nulo = dia livre (ter–qui) */
  util: boolean;
  grupo: "A" | "B" | null;
  feriado: string | null;
  hoje: boolean;
}
function LogoGoogle() {
  return (
    <svg width="18" height="18" viewBox="0 0 48 48" aria-hidden="true">
      <path fill="#EA4335" d="M24 9.5c3.5 0 6.6 1.2 9.1 3.6l6.8-6.8C35.8 2.4 30.3 0 24 0 14.6 0 6.6 5.4 2.7 13.3l7.9 6.1C12.5 13.6 17.8 9.5 24 9.5z" />
      <path fill="#4285F4" d="M46.1 24.5c0-1.6-.1-3.1-.4-4.5H24v9h12.4c-.5 2.9-2.2 5.3-4.6 6.9l7.4 5.7c4.3-4 6.9-9.9 6.9-17.1z" />
      <path fill="#FBBC05" d="M10.6 28.6c-.5-1.4-.8-3-.8-4.6s.3-3.2.8-4.6l-7.9-6.1C1 16.6 0 20.2 0 24s1 7.4 2.7 10.7l7.9-6.1z" />
      <path fill="#34A853" d="M24 48c6.5 0 11.9-2.1 15.8-5.8l-7.4-5.7c-2.1 1.4-4.8 2.2-8.4 2.2-6.2 0-11.5-4.1-13.4-9.9l-7.9 6.1C6.6 42.6 14.6 48 24 48z" />
    </svg>
  );
}

export function EscolhaModulo({ semana }: { semana: DiaSemana[] | null }) {
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
          <a href="/escala" className="modulo-destaque">
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <span style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.16em", color: "var(--accent-base)" }}>
                ESCALA DE PRESENÇA
              </span>
              <span className="modulo-selo">novo</span>
            </div>
            <span style={{ fontWeight: 800, fontSize: 21, lineHeight: 1.2, color: "#10162b" }}>Seus dias no escritório</span>
            <span style={{ fontSize: 13.5, lineHeight: 1.5, color: "#4a5468" }}>
              Veja os dias do seu grupo, reserve uma vaga livre ou entre na lista de espera.
            </span>
            {semana && (
              <div style={{ display: "flex", flexDirection: "column", gap: 6, margin: "4px 0 2px" }}>
                <span style={{ fontSize: 11, color: "#7a8296" }}>
                  {semana.some((d) => d.hoje) ? "Esta semana" : "Próxima semana"} · BH Centro
                </span>
                <div style={{ display: "flex", gap: 6 }}>
                  {semana.map((d) => (
                    <span
                      key={d.data}
                      className="modulo-dia"
                      data-g={d.grupo ?? (d.util ? "livre" : undefined)}
                      data-hoje={d.hoje ? "1" : undefined}
                      title={d.feriado ?? (d.grupo ? `Grupo ${d.grupo}` : d.util ? "Dia livre para agendar" : "Sem escala")}
                      aria-label={`${d.nome} ${d.data.slice(8)}: ${d.feriado ? `feriado, ${d.feriado}` : d.grupo ? `Grupo ${d.grupo}` : d.util ? "dia livre" : "sem escala"}${d.hoje ? " (hoje)" : ""}`}
                    >
                      <span>{d.nome} {d.data.slice(8)}</span>
                      <strong>{d.grupo ?? (d.util ? "Livre" : "—")}</strong>
                    </span>
                  ))}
                </div>
              </div>
            )}
            <span className="modulo-cta">
              <LogoGoogle />
              Entrar com Google
              <span style={{ marginLeft: "auto", fontSize: 18, lineHeight: 1 }}>→</span>
            </span>
          </a>

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
          Os grupos A e B se alternam a cada dia útil. Quem não puder ir libera o lugar para quem está na fila.
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
