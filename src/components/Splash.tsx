"use client";

import { useEffect, useState } from "react";

/** Caminho da foto real da moto (opcional). Se não existir em /public, cai no SVG desenhado. */
const MOTO_PHOTO_SRC = "/moto.png";

/** Tela de carregamento — logo com arcos girando, moto na pista e progresso. */
export function Splash() {
  const [pct, setPct] = useState(7);
  const [motoPhotoOk, setMotoPhotoOk] = useState(true);

  useEffect(() => {
    const t = setInterval(() => {
      setPct((p) => (p >= 97 ? 97 : p + Math.floor(Math.random() * 7) + 2));
    }, 220);
    return () => clearInterval(t);
  }, []);

  return (
    <div
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 100,
        display: "grid",
        placeItems: "center",
        background:
          "radial-gradient(900px 480px at 50% -8%, color-mix(in srgb, var(--color-accent) 10%, transparent), transparent 70%), var(--color-bg)",
      }}
    >
      <div
        className="splash-in"
        style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 28, width: "min(380px, 86vw)" }}
      >
        {/* logo com arcos orbitando + glow */}
        <div style={{ position: "relative", width: 190, height: 190, display: "grid", placeItems: "center" }}>
          <span className="splash-glow" />
          <span className="splash-arco splash-arco-1" />
          <span className="splash-arco splash-arco-2" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Locagora" data-logo="1" style={{ width: 120, position: "relative" }} />
        </div>

        <div style={{ textAlign: "center" }}>
          <div
            style={{
              fontFamily: "var(--font-heading)",
              fontWeight: 800,
              fontSize: 30,
              letterSpacing: "0.08em",
            }}
          >
            LOC<span style={{ color: "var(--color-accent)" }}>CONTROL</span>
          </div>
          <div
            className="text-muted"
            style={{ fontSize: 11.5, letterSpacing: "0.34em", textTransform: "uppercase", marginTop: 6 }}
          >
            Ciclo de vida de colaboradores
          </div>
        </div>

        {/* pista com a moto */}
        <div style={{ width: "100%", position: "relative", height: 54 }}>
          <div className="splash-moto">
            <span className="splash-moto-rastro" />
            {motoPhotoOk ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={MOTO_PHOTO_SRC}
                alt="Moto"
                className="splash-moto-foto"
                onError={() => setMotoPhotoOk(false)}
              />
            ) : (
              <MotoSvg />
            )}
          </div>
          <div className="splash-pista" />
        </div>

        {/* barra de progresso */}
        <div style={{ width: "100%" }}>
          <div className="splash-bar-track">
            <div className="splash-bar-fill" style={{ width: `${pct}%` }} />
          </div>
          <div
            style={{
              width: "100%",
              display: "flex",
              justifyContent: "space-between",
              fontFamily: "var(--mono)",
              fontSize: 11,
              letterSpacing: "0.18em",
              color: "var(--color-neutral-600)",
              marginTop: 8,
            }}
          >
            <span>INICIALIZANDO</span>
            <span>{pct}%</span>
          </div>
        </div>
      </div>
    </div>
  );
}

function MotoSvg() {
  return (
    <svg width="52" height="34" viewBox="0 0 52 34" fill="none">
      {/* rodas */}
      <g className="splash-roda" style={{ transformOrigin: "11px 25px" }}>
        <circle cx="11" cy="25" r="7" stroke="var(--color-text)" strokeWidth="2.2" />
        <path d="M11 19v12M5 25h12" stroke="var(--color-text)" strokeWidth="1.1" />
      </g>
      <g className="splash-roda" style={{ transformOrigin: "41px 25px" }}>
        <circle cx="41" cy="25" r="7" stroke="var(--color-text)" strokeWidth="2.2" />
        <path d="M41 19v12M35 25h12" stroke="var(--color-text)" strokeWidth="1.1" />
      </g>
      {/* chassi */}
      <path
        d="M11 25 L20 13 L31 13 L36 19 L41 25"
        stroke="var(--color-accent)"
        strokeWidth="2.6"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      {/* tanque e banco */}
      <path d="M18 13 h12 l-2 -4 h-7 z" fill="var(--warn)" />
      {/* guidão */}
      <path d="M31 13 L37 5 M34.5 5.5 L39 7" stroke="var(--color-text)" strokeWidth="2" strokeLinecap="round" />
      {/* farol */}
      <circle cx="39.5" cy="12.5" r="2" fill="var(--warn)" />
    </svg>
  );
}
