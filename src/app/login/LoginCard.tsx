"use client";

import { useState, useTransition } from "react";
import { entrarComEmail } from "@/app/actions/sessao";
import { CampoSenha } from "@/components/CampoSenha";

export function LoginCard() {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [pending, start] = useTransition();

  const entrar = () =>
    start(async () => {
      const r = await entrarComEmail(email, senha);
      if (r && !r.ok) setErro(r.msg);
    });

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
          <div
            style={{
              fontWeight: 800,
              fontSize: 13,
              letterSpacing: "0.16em",
              color: "#fff",
              opacity: 0.9,
            }}
          >
            LOCCONTROL
          </div>
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
            <h1 style={{ fontSize: 28, margin: 0, letterSpacing: "-0.01em" }}>Acesse sua conta</h1>
            <p className="text-muted" style={{ fontSize: 14, margin: "8px 0 0", lineHeight: 1.5 }}>
              Informe seu e-mail corporativo e senha para continuar.
            </p>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
            <div className="field">
              <label style={{ fontSize: 12, marginBottom: 8 }}>E-mail corporativo</label>
              <input
                className="input"
                type="email"
                autoFocus
                autoComplete="username"
                style={{ height: 44 }}
                placeholder="nome.sobrenome@locgrupo.com.br"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErro("");
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter") entrar();
                }}
              />
            </div>
            <div className="field">
              <label style={{ fontSize: 12, marginBottom: 8 }}>Senha</label>
              <CampoSenha
                value={senha}
                autoComplete="current-password"
                style={{ height: 44 }}
                onChange={(v) => {
                  setSenha(v);
                  setErro("");
                }}
                onEnter={entrar}
              />
            </div>
          </div>

          {erro && (
            <div
              role="alert"
              style={{
                fontSize: 13,
                color: "var(--danger-forte)",
                background: "var(--danger-bg)",
                border: "1px solid color-mix(in srgb, var(--danger-base) 30%, transparent)",
                borderRadius: 8,
                padding: "10px 14px",
                animation: "entrada 0.18s ease both",
              }}
            >
              {erro}
            </div>
          )}

          <button
            className="btn btn-primary btn-block"
            disabled={pending || !email.includes("@") || !senha}
            onClick={entrar}
            style={{ height: 48, fontSize: 15, marginTop: 0, fontWeight: 700 }}
          >
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </div>

        <div className="text-muted" style={{ fontSize: 11, marginTop: "var(--space-8)" }}>
          acesso restrito · @locgrupo.com.br
        </div>
      </div>

      <div className="login-hero">
        <h1 style={{ fontSize: "clamp(28px, 3.6vw, 44px)", color: "#fff", maxWidth: 620, lineHeight: 1.15, letterSpacing: "-0.02em" }}>
          Gestão inteligente<br />
          do <span style={{ color: "var(--ok-base)" }}>ciclo de vida</span>
        </h1>
        <p style={{ fontSize: 16, lineHeight: 1.6, color: "color-mix(in srgb, #fff 78%, transparent)", maxWidth: 460, marginTop: 16 }}>
          Acompanhe admissões, transferências e desligamentos com RH e TI sempre sincronizados, em tempo real.
        </p>

        <div style={{ display: "flex", flexDirection: "column", gap: 20, marginTop: 48 }}>
          {[
            "Admissão, transferência e desligamento em um fluxo só",
            "RH e TI acompanham cada etapa em tempo real, sem planilha paralela",
            "Histórico completo de acessos, equipamentos e pendências por colaborador",
          ].map((linha) => (
            <div key={linha} style={{ display: "flex", alignItems: "center", gap: 14 }}>
              <span style={{ width: 7, height: 7, borderRadius: 999, background: "var(--ok-base)", flex: "none" }} />
              <span style={{ fontSize: 14.5, color: "color-mix(in srgb, #fff 82%, transparent)" }}>{linha}</span>
            </div>
          ))}
        </div>

        <div
          style={{
            position: "absolute",
            left: "clamp(32px, 6vw, 72px)",
            right: "clamp(32px, 6vw, 72px)",
            bottom: "clamp(32px, 6vw, 72px)",
            display: "flex",
            flexDirection: "column",
            gap: 10,
          }}
        >
          <div className="hero-ticker" style={{ fontSize: 16, fontWeight: 600, color: "#fff" }}>
            <span style={{ animationDelay: "0s" }}>Sem planilha paralela.</span>
            <span style={{ animationDelay: "6s" }}>Um só lugar pra RH e TI.</span>
            <span style={{ animationDelay: "12s" }}>Do primeiro dia ao último clique.</span>
          </div>
          <span style={{ fontSize: 12, color: "color-mix(in srgb, #fff 40%, transparent)" }}>
            © 2026 Locagora. Todos os direitos reservados.
          </span>
        </div>
      </div>
    </div>
  );
}
