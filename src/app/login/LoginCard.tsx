"use client";

import { useState, useTransition } from "react";
import { entrarComEmail } from "@/app/actions/sessao";
import { ThemeToggleButton } from "@/components/ThemeToggle";
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
          {pending ? "Entrando..." : "Entrar"}
        </button>
        <div className="text-muted" style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
          acesso restrito · @locgrupo.com.br
        </div>
      </div>
    </div>
  );
}
