"use client";

import { useState } from "react";
import { LogoGoogle } from "@/components/escala/CartaoEscala";
import type { DiaSemana } from "@/lib/escala/semana";
import s from "./login.module.css";

/**
 * Portal do colaborador (Escala e Salas) na tela de login: versão escura do
 * CartaoEscala, no visual do login. O link é só o botão do Google.
 */
export function PortalColaborador({ semana, href }: { semana: DiaSemana[] | null; href: string }) {
  // o redirecionamento para o Google demora um pouco: mostra que o clique pegou
  const [indo, setIndo] = useState(false);
  return (
    <section className={s.portal} aria-labelledby="portal-titulo">
      <div className={s.portalHead}>
        <span className={s.portalIcon} aria-hidden="true">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect width="18" height="18" x="3" y="4" rx="2" />
            <path d="M16 2v4" />
            <path d="M8 2v4" />
            <path d="M3 10h18" />
            <path d="m9 16 2 2 4-4" />
          </svg>
        </span>
        <div className={s.portalText}>
          <span className={s.portalKicker}>
            Portal do colaborador
            <span className={s.portalNovo}>Novo</span>
          </span>
          <span id="portal-titulo" className={s.portalTitle}>Escala e salas de reunião</span>
          <span className={s.portalDesc}>Veja os dias do seu grupo no escritório e agende salas.</span>
        </div>
      </div>

      {semana && (
        <div className={s.semana}>
          <span className={s.semanaLabel}>
            {semana.some((d) => d.hoje) ? "Esta semana" : "Próxima semana"} · BH Centro
          </span>
          <div className={s.dias}>
            {semana.map((d) => {
              const tipo = d.grupo ? `g${d.grupo}` : d.util ? "livre" : "off";
              return (
                <span
                  key={d.data}
                  className={s.dia}
                  data-t={tipo}
                  data-hoje={d.hoje ? "1" : undefined}
                  title={d.feriado ?? (d.grupo ? `Grupo ${d.grupo}` : d.util ? "Dia livre para agendar" : "Sem escala")}
                  aria-label={`${d.nome} ${d.data.slice(8)}: ${d.feriado ? `feriado, ${d.feriado}` : d.grupo ? `Grupo ${d.grupo}` : d.util ? "dia livre" : "sem escala"}${d.hoje ? " (hoje)" : ""}`}
                >
                  <span>{d.nome} {d.data.slice(8)}</span>
                  <strong>{d.grupo ?? (d.util ? "Livre" : "—")}</strong>
                </span>
              );
            })}
          </div>
        </div>
      )}

      <a
        href={href}
        className={s.google}
        aria-busy={indo}
        data-indo={indo ? "1" : undefined}
        onClick={(e) => {
          if (indo) return e.preventDefault();
          setIndo(true);
        }}
      >
        {/* o logo do Google fica sempre sobre o branco, como pede a marca */}
        <span className={s.googleLogo}>{indo ? <span className={s.giro} aria-hidden="true" /> : <LogoGoogle />}</span>
        <span className={s.googleTxt}>{indo ? "Abrindo o Google…" : "Entrar com Google"}</span>
        <svg className={s.googleSeta} width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          <path d="M5 12h14" />
          <path d="m12 5 7 7-7 7" />
        </svg>
      </a>
    </section>
  );
}
