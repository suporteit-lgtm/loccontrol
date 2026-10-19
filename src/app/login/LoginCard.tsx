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
      {/* form de verdade: o navegador oferece salvar a senha */}
      <form
        className="blueprint"
        onSubmit={(e) => {
          e.preventDefault();
          if (email.includes("@") && senha && !pending) entrar();
        }}
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
          />
        </div>
        <div className="field" ref={senhaRef} style={{ width: "100%", textAlign: "left" }}>
          <label>Senha</label>
          <CampoSenha
            value={senha}
            autoComplete="current-password"
            onChange={(v) => {
              setSenha(v);
              setErro("");
            }}
          />
        </div>
        <label
          style={{ display: "flex", alignItems: "center", gap: 8, width: "100%", fontSize: 13, cursor: "pointer" }}
          title="Mantém você conectado por 30 dias e guarda o seu e-mail neste navegador"
        >
          <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
          Lembrar de mim
        </label>
        {erro && (
          <div role="alert" style={{ fontSize: 12, color: "var(--danger-forte)", width: "100%", textAlign: "left" }}>
            {erro}
          </div>
        )}
        <button
          type="submit"
          className="btn btn-primary btn-block"
          disabled={pending || !email.includes("@") || !senha}
          style={{ height: 44, fontSize: 15 }}
        >
          {pending ? "Entrando..." : "Entrar"}
        </button>
        <div className="text-muted" style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
          acesso restrito · @locgrupo.com.br
          {trocarModulo && (
            <>
              {" · "}
              <a href="/" style={{ color: "inherit" }}>trocar módulo</a>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
