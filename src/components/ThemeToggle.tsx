"use client";

import { useEffect, useState } from "react";
import { Icone } from "./Icone";

export function useTema() {
  const [escuro, setEscuro] = useState(false);
  useEffect(() => {
    setEscuro(document.documentElement.getAttribute("data-tema") === "escuro");
  }, []);
  const alternar = () => {
    const novo = !escuro;
    setEscuro(novo);
    document.documentElement.setAttribute("data-tema", novo ? "escuro" : "claro");
    try {
      localStorage.setItem("ciclo-tema", novo ? "escuro" : "claro");
    } catch {}
  };
  return { escuro, alternar };
}

export function ThemeToggleButton({ style }: { style?: React.CSSProperties }) {
  const { escuro, alternar } = useTema();
  return (
    <button className="btn btn-secondary btn-icon" onClick={alternar} aria-label="Alternar tema" style={style}>
      <Icone nome={escuro ? "sol" : "lua"} />
    </button>
  );
}
