/** Tela de entrada: o usuário escolhe entre o LocControl e a Escala de Presença. */
const MODULOS = [
  {
    href: "/login",
    nome: "LOCCONTROL",
    titulo: "Ciclo de vida de colaboradores",
    texto: "RH e TI: admissões, desligamentos, acessos e chamados.",
    acesso: "E-mail e senha",
  },
  {
    href: "/escala",
    nome: "ESCALA",
    titulo: "Escala de Presença",
    texto: "Seus dias no escritório, reservas de vaga e lista de espera.",
    acesso: "Conta Google @locgrupo.com.br",
  },
];

export function EscolhaModulo() {
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
            gap: 24,
            width: "min(380px, 100%)",
            animation: "entrada 0.4s cubic-bezier(0.2, 0.9, 0.3, 1.1) both",
          }}
        >
          <div>
            <h1 style={{ fontSize: 28, margin: 0, letterSpacing: "-0.01em" }}>Onde você quer entrar?</h1>
            <p className="text-muted" style={{ fontSize: 14, margin: "8px 0 0", lineHeight: 1.5 }}>
              Escolha o módulo para continuar.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {MODULOS.map((m) => (
              <a key={m.href} href={m.href} className="modulo-opcao">
                <span style={{ fontWeight: 800, fontSize: 11, letterSpacing: "0.16em", opacity: 0.75 }}>{m.nome}</span>
                <span style={{ fontWeight: 700, fontSize: 17 }}>{m.titulo}</span>
                <span style={{ fontSize: 13, opacity: 0.75, lineHeight: 1.45 }}>{m.texto}</span>
                <span style={{ fontSize: 11.5, opacity: 0.55, marginTop: 4 }}>Acesso: {m.acesso} →</span>
              </a>
            ))}
          </div>
        </div>

        <div className="text-muted" style={{ fontSize: 11, marginTop: "var(--space-8)" }}>
          acesso restrito · @locgrupo.com.br
        </div>
      </div>

      <div className="login-hero">
        <h1 style={{ fontSize: "clamp(28px, 3.6vw, 44px)", color: "#fff", maxWidth: 620, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
          Sistemas internos<br />
          da <span style={{ color: "var(--ok-base)" }}>Locagora</span>
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "color-mix(in srgb, #fff 78%, transparent)", maxWidth: 460, marginTop: 16 }}>
          Um só endereço para a gestão de pessoas e para a escala de presença no escritório.
        </p>
      </div>
    </div>
  );
}
