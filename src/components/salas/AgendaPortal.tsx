"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { dataLonga, maiuscula, nomeMes } from "@/lib/escala/formato";
import { diaDaSemana, segundaDaSemana, somarDias } from "@/lib/escala/calendario";
import {
  diaPermitido, duracao, finsPossiveis, hhmm, horarios, minutos, type ConfigSalas, type ReservaVista, type Sala,
} from "@/lib/salas/regras";
import type { ItemReserva } from "./ListaReservas";
import s from "./portal.module.css";

type Res = { ok: true } | { ok: false; erro: string };

const ROW = 32; // px por faixa de horário
const CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Aberto = { tipo: "nova"; sala: Sala; ini: string } | { tipo: "ver"; r: ReservaVista } | null;

export function Icone({ d, size = 16, cor = "currentColor", largura = 2 }: { d: string[]; size?: number; cor?: string; largura?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={cor} strokeWidth={largura} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {d.map((p) => (
        <path key={p} d={p} />
      ))}
    </svg>
  );
}

export const IC = {
  cal: ["M8 2v4", "M16 2v4", "M3 6a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z", "M3 10h18"],
  porta: ["M3 21h18", "M5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v16", "M14 12h.01"],
  relogio: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 6v6l4 2"],
  seta: ["M5 12h14", "m12 5 7 7-7 7"],
  esq: ["m15 18-6-6 6-6"],
  dir: ["m9 18 6-6-6-6"],
  baixo: ["m6 9 6 6 6-6"],
  mais: ["M5 12h14", "M12 5v14"],
  x: ["M18 6 6 18", "m6 6 12 12"],
  ok: ["M20 6 9 17l-5-5"],
  pessoa: ["M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2", "M12 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z"],
  alvo: ["M12 22a10 10 0 1 0 0-20 10 10 0 0 0 0 20z", "M12 13a1 1 0 1 0 0-2 1 1 0 0 0 0 2z"],
};

export interface AgendaPortalProps {
  data: string;
  hoje: string;
  agoraMin: number;
  config: ConfigSalas;
  salas: Sala[];
  /** reservas do dia escolhido */
  reservas: ReservaVista[];
  /** reservas de segunda a sexta da semana do dia escolhido (barra de dias) */
  semana: ReservaVista[];
  /** próximas reservas da pessoa */
  minhas: ItemReserva[];
  reservar: (p: { salaId: string; data: string; ini: string; fim: string; titulo?: string }) => Promise<Res>;
  cancelar: (id: string) => Promise<Res>;
}

/** Agenda do portal (/salas): escolha do dia, grade do dia e painel de reserva ao lado. */
export function AgendaPortal(props: AgendaPortalProps) {
  const { data, hoje, agoraMin, config, salas, reservas, semana, minhas } = props;
  const router = useRouter();
  const path = usePathname();
  const { toast } = useToast();
  const [aberto, setAberto] = useState<Aberto>(null);
  const [fim, setFim] = useState("");
  const [titulo, setTitulo] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [confirma, setConfirma] = useState<string | null>(null);
  const [mesAberto, setMesAberto] = useState(false);
  const [mesVisto, setMesVisto] = useState(data.slice(0, 7));
  const [pend, start] = useTransition();
  const popRef = useRef<HTMLDivElement>(null);

  const int = config.intervalo_min;
  const faixas = useMemo(() => horarios(config), [config]);
  const ini0 = minutos(config.hora_inicio);
  const fimDia = minutos(config.hora_fim);
  const idx = (h: string) => Math.round((minutos(h) - ini0) / int);
  const limiteData = somarDias(hoje, config.dias_antecedencia);
  const passou = (d: string, h: string) => d < hoje || (d === hoje && minutos(h) + int <= agoraMin);
  const ocupadaEm = (rs: ReservaVista[], salaId: string, h: string) =>
    rs.some((r) => r.salaId === salaId && minutos(r.ini) <= minutos(h) && minutos(r.fim) > minutos(h));
  const reservavel = (d: string) => diaPermitido(d, config) && d >= hoje && d <= limiteData;
  const livresNoDia = (d: string, rs: ReservaVista[]) =>
    salas.reduce((n, sl) => n + faixas.filter((h) => !passou(d, h) && !ocupadaEm(rs, sl.id, h)).length, 0);

  // fecha o calendário do mês com clique fora ou Esc
  useEffect(() => {
    if (!mesAberto) return;
    const fora = (e: MouseEvent) => popRef.current && !popRef.current.contains(e.target as Node) && setMesAberto(false);
    const esc = (e: KeyboardEvent) => e.key === "Escape" && setMesAberto(false);
    document.addEventListener("mousedown", fora);
    document.addEventListener("keydown", esc);
    return () => {
      document.removeEventListener("mousedown", fora);
      document.removeEventListener("keydown", esc);
    };
  }, [mesAberto]);

  const ir = (d: string) => {
    setAberto(null);
    setMesAberto(false);
    router.push(`${path}?data=${d}`);
  };

  // ── barra da semana ──
  const seg = segundaDaSemana(data);
  const diasSemana = [0, 1, 2, 3, 4].map((k) => somarDias(seg, k));
  const capDia = (d: string) => salas.length * faixas.filter((h) => !passou(d, h)).length;
  const semanaAnterior = somarDias(seg, -7);
  const proximaSemana = somarDias(seg, 7);

  // ── calendário do mês ──
  const [ano, mes] = mesVisto.split("-").map(Number);
  const primeiro = `${mesVisto}-01`;
  const vazios = (diaDaSemana(primeiro) + 6) % 7;
  const nDias = new Date(Date.UTC(ano, mes, 0)).getUTCDate();
  const datasMinhas = new Set(minhas.map((m) => m.data));
  const mudarMes = (n: number) => {
    const d = new Date(Date.UTC(ano, mes - 1 + n, 1));
    setMesVisto(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  };

  // ── números do dia ──
  const aberta = diaPermitido(data, config);
  const ehHoje = data === hoje;
  const agoraNaGrade = ehHoje && agoraMin >= ini0 && agoraMin < fimDia;
  const faixaAgora = agoraNaGrade ? faixas.find((h) => minutos(h) <= agoraMin && agoraMin < minutos(h) + int) : undefined;
  const livresAgora = faixaAgora ? salas.filter((sl) => !ocupadaEm(reservas, sl.id, faixaAgora)).length : 0;
  const livres = aberta ? livresNoDia(data, reservas) : 0;
  let proxLivre: { h: string; sala: string } | null = null;
  if (aberta)
    for (const h of faixas) {
      if (passou(data, h)) continue;
      const sl = salas.find((x) => !ocupadaEm(reservas, x.id, h));
      if (sl) {
        proxLivre = { h, sala: sl.nome };
        break;
      }
    }
  const minhasNoDia = reservas.filter((r) => r.minha).length;

  // ── seleção ──
  const nova = aberto?.tipo === "nova" ? aberto : null;
  const fins = nova
    ? finsPossiveis({ ini: nova.ini, config, ocupadas: reservas.filter((r) => r.salaId === nova.sala.id) })
    : [];
  const escolher = (sala: Sala, h: string) => {
    const opcoes = finsPossiveis({ ini: h, config, ocupadas: reservas.filter((r) => r.salaId === sala.id) });
    setAberto({ tipo: "nova", sala, ini: h });
    setFim(opcoes[1] ?? opcoes[0] ?? "");
    setTitulo("");
    setErro(null);
    setConfirma(null);
  };
  const naSelecao = (salaId: string, h: string) =>
    !!nova && nova.sala.id === salaId && minutos(h) >= minutos(nova.ini) && minutos(h) < minutos(fim || nova.ini);

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    if (!nova || !fim) return;
    setErro(null);
    start(async () => {
      const r = await props.reservar({ salaId: nova.sala.id, data, ini: nova.ini, fim, titulo: titulo.trim() || undefined });
      if (!r.ok) return setErro(r.erro);
      toast(`${nova.sala.nome} reservada: ${nova.ini}–${fim}.`, "ok");
      setAberto(null);
      router.refresh();
    });
  };

  const cancelar = (id: string) =>
    start(async () => {
      const r = await props.cancelar(id);
      setConfirma(null);
      if (!r.ok) return toast(r.erro, "erro");
      toast("Reserva cancelada. O horário ficou livre.", "ok");
      if (aberto?.tipo === "ver" && aberto.r.id === id) setAberto(null);
      router.refresh();
    });

  const proximas = minhas.filter((m) => !m.passou).slice(0, 5);
  const colunas = `64px repeat(${salas.length}, minmax(170px, 1fr))`;
  const linhasHora = Math.max(1, Math.round(60 / int));
  const nPassadas = ehHoje ? faixas.filter((h) => passou(data, h)).length : data < hoje ? faixas.length : 0;
  const verSala = aberto?.tipo === "ver" ? salas.find((x) => x.id === aberto.r.salaId) : undefined;

  return (
    <div className={s.root}>
      <div className={s.head}>
        <div>
          <h1 className={s.titulo}>Agenda de salas</h1>
          <p className={s.sub}>Escolha o dia e um horário livre para reservar. Para cancelar, abra o seu agendamento.</p>
        </div>
      </div>

      {/* escolha do dia */}
      <section className={`${s.card} ${s.picker}`} aria-label="Escolher dia">
        <div ref={popRef} style={{ position: "static" }}>
          <button
            type="button"
            className={s.mesBtn}
            aria-expanded={mesAberto}
            aria-haspopup="dialog"
            onClick={() => {
              setMesVisto(data.slice(0, 7));
              setMesAberto((v) => !v);
            }}
          >
            <span className={s.mesIcone}>
              <Icone d={IC.cal} size={18} />
            </span>
            <span className={s.mesTxt}>
              <span className={s.mesAno}>{data.slice(0, 4)}</span>
              <span className={s.mesNome}>
                {nomeMes(Number(data.slice(5, 7)))}
                <Icone d={IC.baixo} />
              </span>
            </span>
          </button>

          {mesAberto && (
            <div className={s.pop} role="dialog" aria-label="Calendário do mês">
              <div className={s.popHead}>
                <button type="button" className={`${s.btn} ${s.btnIcone}`} style={{ height: 34, width: 34 }} onClick={() => mudarMes(-1)} disabled={primeiro <= `${hoje.slice(0, 7)}-01`} aria-label="Mês anterior">
                  <Icone d={IC.esq} />
                </button>
                <span className={s.popTitulo}>
                  {maiuscula(nomeMes(mes))} de {ano}
                </span>
                <button type="button" className={`${s.btn} ${s.btnIcone}`} style={{ height: 34, width: 34 }} onClick={() => mudarMes(1)} disabled={`${mesVisto}-01` > limiteData} aria-label="Próximo mês">
                  <Icone d={IC.dir} />
                </button>
              </div>
              <div className={s.mes}>
                {["S", "T", "Q", "Q", "S", "S", "D"].map((l, i) => (
                  <span key={i} className={s.mesSem}>
                    {l}
                  </span>
                ))}
                {Array.from({ length: vazios }, (_, i) => (
                  <span key={`v${i}`} />
                ))}
                {Array.from({ length: nDias }, (_, i) => {
                  const d = `${mesVisto}-${String(i + 1).padStart(2, "0")}`;
                  const meu = datasMinhas.has(d);
                  return (
                    <button
                      key={d}
                      type="button"
                      className={s.mdia}
                      disabled={!reservavel(d)}
                      aria-pressed={d === data}
                      data-hoje={d === hoje ? "1" : undefined}
                      data-meu={meu ? "1" : undefined}
                      aria-label={`${maiuscula(dataLonga(d))}${meu ? ", você tem reserva" : ""}`}
                      onClick={() => ir(d)}
                    >
                      <span>{i + 1}</span>
                      <i />
                    </button>
                  );
                })}
              </div>
              <div className={s.popLegenda}>
                <span>
                  <i style={{ width: 6, height: 6, borderRadius: 999, background: "var(--color-accent)", display: "inline-block" }} /> Você tem reserva
                </span>
                <span>
                  <i style={{ width: 10, height: 10, borderRadius: 3, border: "1px solid var(--ok)", display: "inline-block" }} /> Hoje
                </span>
                <span>Até {config.dias_antecedencia} dias à frente</span>
              </div>
            </div>
          )}
        </div>

        <div className={s.semana}>
          <button
            type="button"
            className={`${s.btn} ${s.seta}`}
            onClick={() => ir(semanaAnterior < hoje ? hoje : semanaAnterior)}
            disabled={seg <= segundaDaSemana(hoje)}
            aria-label="Semana anterior"
          >
            <Icone d={IC.esq} size={18} />
          </button>
          <div className={s.dias}>
            {diasSemana.map((d) => {
              const ok = reservavel(d);
              const rs = semana.filter((r) => r.data === d);
              const n = ok ? livresNoDia(d, rs) : 0;
              const cap = capDia(d) || 1;
              const pct = ok ? Math.round((n / cap) * 100) : 0;
              const cor = n === 0 ? "var(--danger)" : pct < 35 ? "var(--warn)" : "var(--ok)";
              const rotulo = d < hoje ? "Encerrado" : !diaPermitido(d, config) ? "Fechado" : d > limiteData ? "Indisponível" : n === 0 ? "Lotado" : `${n} livres`;
              return (
                <button
                  key={d}
                  type="button"
                  className={s.dia}
                  disabled={!ok}
                  aria-pressed={d === data}
                  data-hoje={d === hoje ? "1" : undefined}
                  aria-label={`${maiuscula(dataLonga(d))}: ${rotulo}`}
                  onClick={() => ir(d)}
                >
                  <span className={s.diaSem}>
                    {CURTO[diaDaSemana(d)]}
                    {d === hoje && <i />}
                  </span>
                  <span className={s.diaNum}>{d.slice(8)}</span>
                  <span className={s.barra}>
                    <span style={{ width: `${pct}%`, background: cor }} />
                  </span>
                  <span className={s.diaLivres}>{rotulo}</span>
                </button>
              );
            })}
          </div>
          <button type="button" className={`${s.btn} ${s.seta}`} onClick={() => ir(proximaSemana)} disabled={proximaSemana > limiteData} aria-label="Próxima semana">
            <Icone d={IC.dir} size={18} />
          </button>
        </div>

        <button type="button" className={s.btn} onClick={() => ir(hoje)} disabled={ehHoje}>
          <Icone d={IC.alvo} />
          Hoje
        </button>
      </section>

      {/* números do dia */}
      <div className={s.stats}>
        <div className={`${s.card} ${s.stat}`}>
          <span className={s.statIcone} style={{ background: "var(--ok-bg)", color: "var(--ok-forte)" }}>
            <Icone d={IC.porta} size={17} />
          </span>
          <span className={s.statTxt}>
            {faixaAgora ? (
              <>
                <span className={s.statRotulo}>Salas livres agora</span>
                <span className={s.statValor}>
                  {livresAgora} de {salas.length}
                </span>
              </>
            ) : (
              <>
                <span className={s.statRotulo}>Seus agendamentos no dia</span>
                <span className={s.statValor}>{minhasNoDia}</span>
              </>
            )}
          </span>
        </div>
        <div className={`${s.card} ${s.stat}`}>
          <span className={s.statIcone} style={{ background: "color-mix(in srgb, var(--color-accent) 14%, var(--color-surface))", color: "var(--color-accent)" }}>
            <Icone d={IC.relogio} size={17} />
          </span>
          <span className={s.statTxt}>
            <span className={s.statRotulo}>Horários livres no dia</span>
            <span className={s.statValor}>{aberta ? livres : "Fechado"}</span>
          </span>
        </div>
        <div className={`${s.card} ${s.stat}`}>
          <span className={s.statIcone} style={{ background: "var(--warn-bg)", color: "var(--warn-forte)" }}>
            <Icone d={IC.seta} size={17} />
          </span>
          <span className={s.statTxt}>
            <span className={s.statRotulo}>Próximo horário livre</span>
            <span className={s.statValor}>{proxLivre ? `${proxLivre.h} · ${proxLivre.sala}` : "—"}</span>
          </span>
        </div>
      </div>

      <div className={s.corpo}>
        {/* grade do dia */}
        <section className={`${s.card} ${s.gradeCard}`} aria-label="Grade de horários">
          <div className={s.gradeTopo}>
            <span>
              <strong>{maiuscula(dataLonga(data))}</strong> · {hhmm(ini0)} às {hhmm(fimDia)}
            </span>
            <div className={s.legenda}>
              <span><i data-t="livre" /> Livre</span>
              <span><i data-t="ocupado" /> Ocupado</span>
              <span><i data-t="minha" /> Seu agendamento</span>
              {agoraNaGrade && <span><i data-t="agora" /> Agora</span>}
            </div>
          </div>

          {salas.length === 0 ? (
            <div style={{ padding: 32, textAlign: "center" }} className={s.nota}>
              Assim que as salas forem cadastradas, elas aparecem aqui.
            </div>
          ) : (
            <div className={s.rolagem}>
              <div className={s.grade}>
                <div className={s.cabecas} style={{ gridTemplateColumns: colunas }}>
                  <div />
                  {salas.map((sl) => {
                    const livresSala = aberta ? faixas.filter((h) => !passou(data, h) && !ocupadaEm(reservas, sl.id, h)).length : 0;
                    const atual = faixaAgora ? reservas.find((r) => r.salaId === sl.id && ocupadaEm([r], sl.id, faixaAgora)) : undefined;
                    return (
                      <div key={sl.id} className={s.cab}>
                        <span className={s.cabNome}>
                          <strong>{sl.nome}</strong>
                          <span>
                            {[sl.descricao, `${sl.capacidade} ${sl.capacidade === 1 ? "pessoa" : "pessoas"}`].filter(Boolean).join(" · ")}
                          </span>
                        </span>
                        {faixaAgora ? (
                          <span className={`${s.chip} ${atual ? s.chipWarn : s.chipOk}`}>{atual ? `Ocupada até ${atual.fim}` : "Livre agora"}</span>
                        ) : (
                          aberta && (
                            <span className={`${s.chip} ${livresSala ? s.chipOk : s.chipNeutro}`}>
                              {livresSala} {livresSala === 1 ? "livre" : "livres"}
                            </span>
                          )
                        )}
                      </div>
                    );
                  })}
                </div>

                <div className={s.linhas} style={{ gridTemplateColumns: colunas }}>
                  <div className={s.horas} style={{ gridTemplateRows: `repeat(${faixas.length}, ${ROW}px)` }}>
                    {faixas.map((h) => (
                      <div key={h} className={s.hora} data-cheia={h.endsWith(":00") ? "1" : undefined} data-passou={passou(data, h) ? "1" : undefined}>
                        {h}
                      </div>
                    ))}
                  </div>

                  {salas.map((sl) => (
                    <div
                      key={sl.id}
                      className={s.coluna}
                      style={{
                        gridTemplateRows: `repeat(${faixas.length}, ${ROW}px)`,
                        backgroundSize: `100% ${ROW * linhasHora}px, 100% ${ROW}px`,
                      }}
                    >
                      {!aberta ? (
                        <div className={s.fechado}>Fechada neste dia</div>
                      ) : (
                        <>
                          {nPassadas > 0 && <div className={s.passado} aria-hidden="true" style={{ gridRow: `1 / span ${nPassadas}` }} />}
                          {faixas.map((h) => {
                            if (passou(data, h) || ocupadaEm(reservas, sl.id, h) || !reservavel(data)) return null;
                            const dentro = naSelecao(sl.id, h);
                            const inicio = nova?.sala.id === sl.id && nova.ini === h;
                            return (
                              <button
                                key={h}
                                type="button"
                                className={s.slot}
                                style={{ gridRow: idx(h) + 1 }}
                                data-sel={dentro ? "1" : undefined}
                                aria-pressed={dentro}
                                aria-label={`Reservar ${sl.nome} às ${h}`}
                                onClick={() => (nova?.sala.id === sl.id && dentro ? setAberto(null) : escolher(sl, h))}
                              >
                                <span>
                                  {inicio ? `${nova.ini}–${fim}` : dentro ? "" : (
                                    <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                                      <Icone d={IC.mais} size={13} largura={2.4} /> Reservar {h}
                                    </span>
                                  )}
                                </span>
                              </button>
                            );
                          })}
                        </>
                      )}
                      {reservas
                        .filter((r) => r.salaId === sl.id)
                        .map((r) => {
                          const de = Math.max(idx(r.ini), 0) + 1;
                          const ate = Math.min(idx(r.fim), faixas.length) + 1;
                          if (ate <= de) return null;
                          const terminou = data < hoje || (ehHoje && minutos(r.fim) <= agoraMin);
                          return (
                            <button
                              key={r.id}
                              type="button"
                              className={s.res}
                              style={{ gridRow: `${de} / ${ate}` }}
                              data-minha={r.minha ? "1" : undefined}
                              data-passou={terminou ? "1" : undefined}
                              data-aberta={aberto?.tipo === "ver" && aberto.r.id === r.id ? "1" : undefined}
                              onClick={() => {
                                setAberto({ tipo: "ver", r });
                                setConfirma(null);
                              }}
                              title={`${r.ini}–${r.fim} · ${r.titulo ?? "Reunião"} · ${r.nome}`}
                            >
                              <strong>{r.titulo ?? (r.minha ? "Seu agendamento" : "Reservado")}</strong>
                              <span>
                                {r.minha ? "Você" : r.nome} · {r.ini}–{r.fim}
                              </span>
                            </button>
                          );
                        })}
                    </div>
                  ))}

                  {agoraNaGrade && (
                    <div className={s.agora} aria-hidden="true" style={{ left: 64, top: ((agoraMin - ini0) / int) * ROW }}>
                      <span>{hhmm(agoraMin)}</span>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </section>

        {/* painel ao lado */}
        <aside className={s.lado} aria-label="Reserva">
          {nova ? (
            <form className={`${s.card} ${s.painel} ${s.painelAtivo}`} onSubmit={enviar}>
              <div className={s.painelTopo}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                  <span className={s.kicker}>Nova reserva</span>
                  <span className={s.painelNome}>{nova.sala.nome}</span>
                  <span className={s.painelData}>{maiuscula(dataLonga(data))}</span>
                </div>
                <button type="button" className={`${s.btn} ${s.btnIcone}`} style={{ height: 34, width: 34 }} onClick={() => setAberto(null)} aria-label="Fechar reserva">
                  <Icone d={IC.x} />
                </button>
              </div>
              <div className={s.campos}>
                <div className={s.campo}>
                  <span>Início</span>
                  <span className={s.valor}>{nova.ini}</span>
                </div>
                <div className={s.campo}>
                  <label htmlFor="sp-fim">Término</label>
                  <select id="sp-fim" className={s.entrada} value={fim} onChange={(e) => setFim(e.target.value)} required>
                    {fins.map((f) => (
                      <option key={f} value={f}>
                        {f}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              <div className={s.campo}>
                <label htmlFor="sp-assunto">Assunto (opcional)</label>
                <input
                  id="sp-assunto"
                  className={s.entrada}
                  value={titulo}
                  maxLength={120}
                  onChange={(e) => setTitulo(e.target.value)}
                  placeholder="Ex.: Alinhamento semanal"
                />
              </div>
              {fim && (
                <span className={s.nota}>
                  Duração: <strong>{duracao(minutos(fim) - minutos(nova.ini))}</strong> · máx. {duracao(config.duracao_max_min)}
                </span>
              )}
              {erro && (
                <div role="alert" className={s.erro}>
                  {erro}
                </div>
              )}
              <button className={s.cta} disabled={pend || !fim}>
                {pend ? "Reservando…" : "Confirmar reserva"}
                {!pend && <Icone d={IC.ok} size={17} largura={2.4} />}
              </button>
            </form>
          ) : aberto?.tipo === "ver" ? (
            <div className={`${s.card} ${s.painel} ${s.painelAtivo}`}>
              <div className={s.painelTopo}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <span className={s.kicker}>{aberto.r.minha ? "Seu agendamento" : "Sala reservada"}</span>
                  <span className={s.painelNome}>{aberto.r.titulo ?? "Reunião"}</span>
                  <span className={s.painelData}>
                    {verSala?.nome} · {maiuscula(dataLonga(aberto.r.data))}
                  </span>
                </div>
                <button type="button" className={`${s.btn} ${s.btnIcone}`} style={{ height: 34, width: 34 }} onClick={() => setAberto(null)} aria-label="Fechar">
                  <Icone d={IC.x} />
                </button>
              </div>
              <div className={s.campos}>
                <div className={s.campo}>
                  <span>Horário</span>
                  <span className={s.valor}>
                    {aberto.r.ini}–{aberto.r.fim}
                  </span>
                </div>
                <div className={s.campo}>
                  <span>Duração</span>
                  <span className={s.valor}>{duracao(minutos(aberto.r.fim) - minutos(aberto.r.ini))}</span>
                </div>
              </div>
              <span className={s.nota}>
                Agendado por <strong>{aberto.r.minha ? "você" : aberto.r.nome}</strong>
                {!aberto.r.minha && (
                  <>
                    {" · "}
                    <a href={`mailto:${aberto.r.email}`}>{aberto.r.email}</a>
                  </>
                )}
              </span>
              {aberto.r.minha && !(data < hoje || (ehHoje && minutos(aberto.r.fim) <= agoraMin)) &&
                (confirma === aberto.r.id ? (
                  <div className={s.confirma} role="alertdialog" aria-label="Confirmar cancelamento">
                    <span style={{ flex: 1 }}>Cancelar esta reserva?</span>
                    <button type="button" className={`${s.btn} ${s.btnPequeno}`} onClick={() => setConfirma(null)} disabled={pend}>
                      Manter
                    </button>
                    <button type="button" className={s.btnPerigoCheio} onClick={() => cancelar(aberto.r.id)} disabled={pend}>
                      {pend ? "Cancelando…" : "Sim, cancelar"}
                    </button>
                  </div>
                ) : (
                  <button type="button" className={`${s.btn} ${s.btnPerigo}`} onClick={() => setConfirma(aberto.r.id)}>
                    Cancelar reserva
                  </button>
                ))}
            </div>
          ) : (
            <div className={`${s.card} ${s.painel} ${s.painelVazio}`}>
              <span className={s.iconeBloco}>
                <Icone d={IC.mais} size={18} />
              </span>
              <strong style={{ fontSize: 15 }}>Reservar uma sala</strong>
              <span className={s.nota} style={{ lineHeight: 1.55 }}>
                Escolha o dia no calendário e clique em um horário livre na grade. Você escolhe o término e o assunto aqui.
              </span>
            </div>
          )}

          <div className={`${s.card} ${s.lista}`}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h2 className={s.listaTitulo}>Seus próximos agendamentos</h2>
              <Link href="/salas/minhas" style={{ fontSize: 12.5, fontWeight: 600 }}>
                Ver todos
              </Link>
            </div>
            {proximas.length === 0 && <span className={s.nota}>Nenhum agendamento marcado.</span>}
            {proximas.map((m) => (
              <div key={m.id} className={s.item}>
                <span className={s.itemMarca} />
                <button
                  type="button"
                  className={s.itemTxt}
                  style={{ background: "none", border: 0, padding: 0, font: "inherit", color: "inherit", textAlign: "left", cursor: "pointer" }}
                  onClick={() => m.data !== data && ir(m.data)}
                  aria-label={`Ir para ${m.titulo ?? "reserva"} em ${dataLonga(m.data)}`}
                >
                  <strong>{m.titulo ?? "Reunião"}</strong>
                  <span>
                    {m.data === hoje ? "Hoje" : m.data === somarDias(hoje, 1) ? "Amanhã" : `${CURTO[diaDaSemana(m.data)]} ${m.data.slice(8)}/${m.data.slice(5, 7)}`} · {m.sala} · {m.ini}–{m.fim}
                  </span>
                </button>
                {confirma === m.id ? (
                  <span style={{ display: "flex", gap: 6 }}>
                    <button type="button" className={`${s.btn} ${s.btnPequeno}`} onClick={() => setConfirma(null)} disabled={pend}>
                      Manter
                    </button>
                    <button type="button" className={s.btnPerigoCheio} style={{ height: 32 }} onClick={() => cancelar(m.id)} disabled={pend}>
                      Cancelar
                    </button>
                  </span>
                ) : (
                  <button type="button" className={`${s.btn} ${s.btnPequeno} ${s.btnPerigo}`} onClick={() => setConfirma(m.id)} aria-label={`Cancelar ${m.titulo ?? "reserva"}`}>
                    Cancelar
                  </button>
                )}
              </div>
            ))}
          </div>
        </aside>
      </div>
    </div>
  );
}
