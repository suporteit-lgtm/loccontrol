"use client";

import { useEffect, useState } from "react";
import type { DiaSemana } from "@/lib/escala/semana";
import { dataLonga, maiuscula } from "@/lib/escala/formato";
import s from "./login.module.css";

type Tela = "colab" | "ti";

const TROCA_MS = 6000; // o celular alterna sozinho entre as duas telas

function Ic({ d, size = 16 }: { d: string[]; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  );
}

const CAL = ["M8 2v4", "M16 2v4", "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M3 10h18"];
const PESSOAS = ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z", "M22 21v-2a4 4 0 0 0-3-3.87", "M16 3.13a4 4 0 0 1 0 7.75"];
const CAIXA = ["M21 8 12 3 3 8v8l9 5 9-5z", "M3 8l9 5 9-5", "M12 13v8"];

function Semana({ semana }: { semana: DiaSemana[] | null }) {
  return (
    <div className={s.celDias}>
      {(semana ?? []).map((d) => {
        const tipo = d.grupo ? `g${d.grupo}` : d.util ? "livre" : "off";
        return (
          <span key={d.data} className={s.celDia} data-t={tipo} data-hoje={d.hoje ? "1" : undefined}>
            <small>{d.nome}</small>
            <b>{d.data.slice(8)}</b>
            <i>{d.grupo ?? (d.util ? "Livre" : "—")}</i>
          </span>
        );
      })}
    </div>
  );
}

/** Tela do colaborador: a semana é real; lembrete e salas são ilustrativos. */
function TelaColaborador({ semana }: { semana: DiaSemana[] | null }) {
  const hoje = semana?.find((d) => d.hoje) ?? semana?.[0];
  return (
    <>
      <div className={s.celTopo}>
        <span className={s.celOla}>Olá!</span>
        <span className={s.celData}>{hoje ? maiuscula(dataLonga(hoje.data)) : "Esta semana"}</span>
      </div>
      <div className={s.celCard}>
        <div className={s.celCardTopo}>
          <span>
            <Ic d={CAL} size={14} />
            Sua semana
          </span>
          <small>BH Centro</small>
        </div>
        <Semana semana={semana} />
      </div>
      <div className={s.celAviso}>
        <span className={s.celAvisoIc}>
          <Ic d={["M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9", "M10.3 21a1.94 1.94 0 0 0 3.4 0"]} size={14} />
        </span>
        <span>
          <b>Lembrete</b>
          <small>Amanhã é dia do seu grupo no escritório.</small>
        </span>
      </div>
      <div className={s.celCard}>
        <div className={s.celCardTopo}>
          <span>
            <Ic d={["M3 21h18", "M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16", "M14 12h.01"]} size={14} />
            Salas agora
          </span>
          <small>Reservar</small>
        </div>
        <div className={s.celSala}>
          <span>
            <b>Sala 11</b>
            <small>Sala de call · 1 pessoa</small>
          </span>
          <em data-t="ok">Livre</em>
        </div>
        <div className={s.celSala}>
          <span>
            <b>Sala 12</b>
            <small>Sala de call · 1 pessoa</small>
          </span>
          <em data-t="ocupada">Até 11:30</em>
        </div>
      </div>
    </>
  );
}

/** Tela de RH e TI: ilustrativa (o login é público e não lê dados internos). */
function TelaRhTi() {
  return (
    <>
      <div className={s.celTopo}>
        <span className={s.celOla}>Painel RH e TI</span>
        <span className={s.celData}>LocControl · todas as unidades</span>
      </div>
      <div className={s.celNums}>
        <span data-t="azul">
          <b>3</b>
          <small>Admissões na fila</small>
        </span>
        <span data-t="roxo">
          <b>7</b>
          <small>Itens a separar</small>
        </span>
      </div>
      <div className={s.celCard}>
        <div className={s.celCardTopo}>
          <span>
            <Ic d={PESSOAS} size={14} />
            Etapas
          </span>
          <small>Tempo real</small>
        </div>
        {[
          { nome: "Admissão", rh: "ok", ti: "ok" },
          { nome: "Transferência", rh: "ok", ti: "and" },
          { nome: "Desligamento", rh: "pend", ti: "pend" },
        ].map((e) => (
          <div key={e.nome} className={s.celSala}>
            <span>
              <b>{e.nome}</b>
            </span>
            <span className={s.celEtapa}>
              <em data-t={e.rh}>RH</em>
              <em data-t={e.ti}>TI</em>
            </span>
          </div>
        ))}
      </div>
      <div className={s.celCard}>
        <div className={s.celCardTopo}>
          <span>
            <Ic d={CAIXA} size={14} />
            A separar
          </span>
          <small>Estoque</small>
        </div>
        <div className={s.celItens}>
          {["Notebook", "Celular", "Fone", "Mouse"].map((i) => (
            <span key={i}>{i}</span>
          ))}
        </div>
      </div>
    </>
  );
}

function Celular({ semana, tela, setTela }: { semana: DiaSemana[] | null; tela: Tela; setTela: (t: Tela) => void }) {
  return (
    <figure className={s.cel} aria-label="Prévia do sistema">
      <div className={s.celTela}>
        <span className={s.celIlha} aria-hidden="true" />
        <div className={s.celStatus} aria-hidden="true">
          <span>9:41</span>
          <span className={s.celBateria} />
        </div>
        {/* key: troca a tela com uma transição suave */}
        <div key={tela} className={s.celConteudo}>
          {tela === "colab" ? <TelaColaborador semana={semana} /> : <TelaRhTi />}
        </div>
      </div>
      <div className={s.celAbas} role="tablist" aria-label="Tela do celular">
        <button type="button" role="tab" aria-selected={tela === "colab"} onClick={() => setTela("colab")}>
          Colaborador
        </button>
        <button type="button" role="tab" aria-selected={tela === "ti"} onClick={() => setTela("ti")}>
          RH e TI
        </button>
      </div>
      <figcaption className={s.celLegenda}>Prévia do sistema · a semana do colaborador é real</figcaption>
    </figure>
  );
}

/**
 * Lado direito do login no modo portal: os dois públicos do sistema, um embaixo
 * do outro, e o celular alternando entre a tela do colaborador e a de RH/TI.
 */
export function HeroPortal({ semana, painelRhTi }: { semana: DiaSemana[] | null; painelRhTi: React.ReactNode }) {
  const [tela, setTela] = useState<Tela>("colab");
  const [pausa, setPausa] = useState(false);

  useEffect(() => {
    if (pausa) return;
    if (typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = window.setInterval(() => setTela((t) => (t === "colab" ? "ti" : "colab")), TROCA_MS);
    return () => window.clearInterval(id);
  }, [pausa]);

  // escolher uma tela (passar o mouse num cartão ou clicar na aba) pausa a troca automática
  const escolher = (t: Tela) => {
    setTela(t);
    setPausa(true);
  };

  return (
    <div className={s.hp}>
      <div className={s.hd}>
        <div className={s.hdTopo}>
          <span className={s.pill}>
            <span className={s.dot} />
            LocControl · Grupo LOC
          </span>
          <h2 className={s.heroTitle}>
            Um só lugar para quem trabalha
            <br />e para quem <span>cuida das pessoas</span>
          </h2>
        </div>

        <section
          className={s.hdCard}
          data-ativo={tela === "colab" ? "1" : undefined}
          onMouseEnter={() => escolher("colab")}
          onMouseLeave={() => setPausa(false)}
        >
          <div className={s.hdCardTopo}>
            <span className={s.hdIcone} data-t="colab">
              <Ic d={CAL} size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className={s.hdQuem}>Para colaboradores</span>
              <h3 className={s.hdTitulo}>Escala e salas de reunião</h3>
            </div>
            <span className={s.hdComo} data-t="colab">
              <Ic d={["m12 19-7-7 7-7", "M19 12H5"]} size={14} />
              Entre com o Google
            </span>
          </div>
          <ul className={s.hdLista}>
            <li>Os dias do seu grupo no escritório</li>
            <li>Reserva de lugar nos dias livres</li>
            <li>Salas de reunião em poucos cliques</li>
          </ul>
        </section>

        <section
          className={s.hdCard}
          data-ativo={tela === "ti" ? "1" : undefined}
          onMouseEnter={() => escolher("ti")}
          onMouseLeave={() => setPausa(false)}
        >
          <div className={s.hdCardTopo}>
            <span className={s.hdIcone} data-t="adm">
              <Ic d={PESSOAS} size={18} />
            </span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <span className={s.hdQuem}>Para RH e TI</span>
              <h3 className={s.hdTitulo}>Ciclo de vida do colaborador</h3>
            </div>
            <span className={s.hdComo} data-t="adm">
              <Ic d={["M7 11V7a5 5 0 0 1 10 0v4", "M5 11h14v10H5z"]} size={14} />
              Acesso administrativo
            </span>
          </div>
          {painelRhTi}
        </section>
      </div>

      <Celular semana={semana} tela={tela} setTela={escolher} />
    </div>
  );
}
