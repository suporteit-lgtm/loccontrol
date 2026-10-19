"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { entrarComEmail } from "@/app/actions/sessao";
import { ThemeToggleButton } from "@/components/ThemeToggle";
import { CampoSenha } from "@/components/CampoSenha";

export function LoginCard({ trocarModulo = false }: { trocarModulo?: boolean }) {
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState("");
  const [pending, start] = useTransition();
  const [lembrar, setLembrar] = useState(true);
  const senhaRef = useRef<HTMLDivElement>(null);

  // "Lembrar de mim": o e-mail fica salvo neste navegador
  useEffect(() => {
    try {
      const salvo = localStorage.getItem("lc_email");
      if (salvo) {
        setEmail(salvo);
        senhaRef.current?.querySelector("input")?.focus();
      }
    } catch {}
  }, []);

  const entrar = () =>
    start(async () => {
      try {
        if (lembrar) localStorage.setItem("lc_email", email.trim().toLowerCase());
        else localStorage.removeItem("lc_email");
      } catch {}
      const r = await entrarComEmail(email, senha, lembrar);
      if (r && !r.ok) setErro(r.msg);
    });

  return (
    <div
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        padding: 24,
        position: "relative",
      }}
    >
      <ThemeToggleButton style={{ position: "absolute", top: 16, right: 16 }} />
      <div
        className="blueprint"
        style={{
          width: "min(380px, 100%)",
          padding: "40px 32px",
          display: "flex",
          flexDirection: "column",
          gap: 20,
          alignItems: "center",
          textAlign: "center",
        }}
      >
        <div style={{ display: "flex", flexDirection: "column", gap: 12, alignItems: "center" }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Locagora" data-logo="1" style={{ width: 210, maxWidth: "100%" }} />
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: 18,
              letterSpacing: "0.2em",
              color: "var(--color-accent-700)",
            }}
          >
            LOCCONTROL
          </div>
          <div className="text-muted" style={{ fontSize: 13 }}>
            Ciclo de vida de colaboradores · RH e TI
          </div>
        </div>
        <div className="field" style={{ width: "100%", textAlign: "left" }}>
          <label>E-mail corporativo</label>
          <input
            className="input"
            type="email"
            autoComplete="username"
            style={{ fontFamily: "var(--mono)" }}
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
        <div className="field" style={{ width: "100%", textAlign: "left" }}>
          <label>Senha</label>
          <CampoSenha
            value={senha}
            autoComplete="current-password"
            onChange={(v) => {
              setSenha(v);
              setErro("");
            }}
            onEnter={entrar}
          />
        </div>
        {erro && (
          <div style={{ fontSize: 12, color: "var(--danger-forte)", width: "100%", textAlign: "left" }}>{erro}</div>
        )}
        <button
          className="btn btn-primary btn-block"
          disabled={pending || !email.includes("@") || !senha}
          onClick={entrar}
          style={{ height: 44, fontSize: 15 }}
        >
          <div>
            <h1 style={{ fontSize: 28, margin: 0, letterSpacing: "-0.01em" }}>Acesse sua conta</h1>
            <p className="text-muted" style={{ fontSize: 14, margin: "8px 0 0", lineHeight: 1.5 }}>
              Informe seu e-mail corporativo e senha para continuar.
            </p>
          </div>

          {/* form de verdade: o navegador oferece salvar a senha */}
          <form
            id="form-login"
            onSubmit={(e) => {
              e.preventDefault();
              if (email.includes("@") && senha && !pending) entrar();
            }}
            style={{ display: "flex", flexDirection: "column", gap: 20 }}
          >
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
              />
            </div>
            <div className="field" ref={senhaRef}>
              <label style={{ fontSize: 12, marginBottom: 8 }}>Senha</label>
              <CampoSenha
                value={senha}
                autoComplete="current-password"
                style={{ height: 44 }}
                onChange={(v) => {
                  setSenha(v);
                  setErro("");
                }}
              />
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={lembrar}
              className="esc-switch"
              onClick={() => setLembrar(!lembrar)}
              style={{ marginTop: -6 }}
            >
              <span className="esc-switch-trilho" aria-hidden><span /></span>
              <span>
                <strong style={{ fontSize: 13 }}>Lembrar de mim</strong>
                <span className="text-muted" style={{ display: "block", fontSize: 11.5 }}>
                  Mantém você conectado por 30 dias e guarda o seu e-mail neste navegador.
                </span>
              </span>
            </button>
          </form>

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
            type="submit"
            form="form-login"
            className="btn btn-primary btn-block"
            disabled={pending || !email.includes("@") || !senha}
            style={{ height: 48, fontSize: 15, marginTop: 0, fontWeight: 700 }}
          >
            {pending ? "Entrando..." : "Entrar"}
          </button>
        </div>

        <div className="text-muted" style={{ fontSize: 11, marginTop: "var(--space-8)" }}>
          acesso restrito · @locgrupo.com.br
          {trocarModulo && (
            <>
              {" · "}
              <a href="/" style={{ color: "inherit" }}>trocar módulo</a>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
