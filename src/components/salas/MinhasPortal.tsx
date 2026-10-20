"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { dataLonga, maiuscula } from "@/lib/escala/formato";
import { diaDaSemana, segundaDaSemana, somarDias } from "@/lib/escala/calendario";
import { duracao, minutos, type ConfigSalas, type ReservaVista, type Sala } from "@/lib/salas/regras";
import type { ItemReserva } from "./ListaReservas";
import { IC, Icone } from "./AgendaPortal";
import s from "./portal.module.css";

type Res = { ok: true } | { ok: false; erro: string };

const CURTO = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

/** "Meus agendamentos" do portal: próximos e anteriores, cancelar com desfazer e um resumo ao lado. */
export function MinhasPortal(p: {
  itens: ItemReserva[];
  hoje: string;
  agoraMin: number;
  config: ConfigSalas;
  salas: Sala[];
  /** reservas de hoje de todas as salas ("livres agora") */
  reservasHoje: ReservaVista[];
  reservar: (r: { salaId: string; data: string; ini: string; fim: string; titulo?: string }) => Promise<Res>;
  cancelar: (id: string) => Promise<Res>;
}) {
  const { itens, hoje, agoraMin, config, salas, reservasHoje } = p;
  const router = useRouter();
  const { toast } = useToast();
  const [aba, setAba] = useState<"prox" | "ant">("prox");
  const [confirma, setConfirma] = useState<string | null>(null);
  const [pend, start] = useTransition();

  const proximos = itens.filter((i) => !i.passou);
  const anteriores = itens.filter((i) => i.passou).reverse();
  const lista = aba === "prox" ? proximos : anteriores;
  const dias = [...new Set(lista.map((i) => i.data))];
  const tempoTotal = proximos.reduce((n, i) => n + minutos(i.fim) - minutos(i.ini), 0);

  const cancelar = (i: ItemReserva) =>
    start(async () => {
      const r = await p.cancelar(i.id);
      setConfirma(null);
      if (!r.ok) return toast(r.erro, "erro");
      router.refresh();
      // desfazer = reservar de novo o mesmo horário (se ninguém pegou nesse meio-tempo)
      toast(
        `Reserva "${i.titulo ?? i.sala}" cancelada. O horário ficou livre.`,
        async () => {
          const v = await p.reservar({ salaId: i.salaId, data: i.data, ini: i.ini, fim: i.fim, titulo: i.titulo ?? undefined });
          if (!v.ok) return toast(v.erro, "erro");
          toast("Reserva recuperada.", "ok");
          router.refresh();
        },
        "ok",
      );
    });

  // resumo ao lado
  const seg = segundaDaSemana(hoje);
  const semana = [0, 1, 2, 3, 4].map((k) => somarDias(seg, k));
  const porSala = new Map<string, number>();
  proximos.forEach((i) => porSala.set(i.sala, (porSala.get(i.sala) ?? 0) + 1));
  const topo = [...porSala.entries()].sort((a, b) => b[1] - a[1])[0];
  const agoraNaGrade = agoraMin >= minutos(config.hora_inicio) && agoraMin < minutos(config.hora_fim);
  const livresAgora = salas.map((sl) => {
    const rs = reservasHoje.filter((r) => r.salaId === sl.id);
    const atual = rs.find((r) => minutos(r.ini) <= agoraMin && minutos(r.fim) > agoraMin);
    const proxima = rs.filter((r) => minutos(r.ini) > agoraMin).sort((a, b) => minutos(a.ini) - minutos(b.ini))[0];
    return { sala: sl, atual, ate: proxima?.ini ?? config.hora_fim.slice(0, 5) };
  });

  const status = (i: ItemReserva) => {
    if (i.passou) return { txt: "Concluída", cls: s.chipNeutro };
    if (i.data === hoje && minutos(i.ini) <= agoraMin) return { txt: "Acontecendo agora", cls: s.chipWarn };
    if (i.data === hoje) return { txt: "Hoje", cls: s.chipWarn };
    return { txt: "Confirmada", cls: s.chipOk };
  };
  const tituloDia = (d: string) =>
    d === hoje ? "Hoje" : d === somarDias(hoje, 1) ? "Amanhã" : d === somarDias(hoje, -1) ? "Ontem" : maiuscula(dataLonga(d).split(",")[0]);

  return (
    <div className={s.root}>
      <div className={s.head}>
        <div>
          <h1 className={s.titulo}>Meus agendamentos</h1>
          <p className={s.sub}>Suas reservas de sala. Cancele com antecedência para liberar o horário para outra pessoa.</p>
        </div>
        <Link href="/salas" className={s.cta}>
          <Icone d={IC.mais} largura={2.4} />
          Nova reserva
        </Link>
      </div>

      <div className={s.barraTopo}>
        <div className={s.seg} role="tablist" aria-label="Período">
          <button type="button" role="tab" aria-selected={aba === "prox"} onClick={() => { setAba("prox"); setConfirma(null); }}>
            Próximos · {proximos.length}
          </button>
          <button type="button" role="tab" aria-selected={aba === "ant"} onClick={() => { setAba("ant"); setConfirma(null); }}>
            Anteriores · {anteriores.length}
          </button>
        </div>
        <span className={s.resumo}>
          {aba === "prox"
            ? `${proximos.length} ${proximos.length === 1 ? "reserva" : "reservas"} · ${duracao(tempoTotal)} no total`
            : "Últimos 30 dias"}
        </span>
      </div>

      <div className={s.corpo}>
        <div className={s.lista2}>
          {lista.length === 0 && (
            <div className={`${s.card} ${s.vazio}`}>
              <span className={s.iconeBloco} style={{ width: 46, height: 46 }}>
                <Icone d={IC.cal} size={22} />
              </span>
              <strong>{aba === "prox" ? "Nenhuma reserva marcada" : "Nada por aqui ainda"}</strong>
              <p>
                {aba === "prox"
                  ? "Quando você reservar uma sala, ela aparece aqui com dia, horário e opção de cancelar."
                  : "As reservas que já aconteceram aparecem aqui."}
              </p>
              <Link href="/salas" className={s.cta}>
                Ver horários livres
              </Link>
            </div>
          )}

          {dias.map((d) => (
            <section key={d} className={s.grupo}>
              <h2 className={s.grupoTitulo}>
                {tituloDia(d)}
                <span>{dataLonga(d)}</span>
              </h2>
              {lista
                .filter((i) => i.data === d)
                .map((i) => {
                  const st = status(i);
                  return (
                    <article
                      key={i.id}
                      className={`${s.card} ${s.reserva}`}
                      data-passou={i.passou ? "1" : undefined}
                      data-confirma={confirma === i.id ? "1" : undefined}
                    >
                      <div className={s.horaBloco}>
                        <strong>{i.ini}</strong>
                        <span>até {i.fim}</span>
                      </div>
                      <div className={s.reservaTxt}>
                        <div className={s.reservaLinha}>
                          <strong>{i.titulo ?? "Reunião"}</strong>
                          <span className={`${s.chip} ${st.cls}`}>{st.txt}</span>
                        </div>
                        <div className={s.meta}>
                          <span>
                            <Icone d={IC.porta} size={14} />
                            {[i.sala, i.local].filter(Boolean).join(" · ")}
                          </span>
                          <span>
                            <Icone d={IC.relogio} size={14} />
                            {duracao(minutos(i.fim) - minutos(i.ini))}
                          </span>
                        </div>
                      </div>
                      {i.passou ? (
                        <Link href={`/salas?data=${hoje}`} className={s.btn}>
                          Reservar de novo
                        </Link>
                      ) : confirma === i.id ? (
                        <div className={s.confirma} role="alertdialog" aria-label="Confirmar cancelamento">
                          Cancelar esta reserva?
                          <button type="button" className={`${s.btn} ${s.btnPequeno}`} onClick={() => setConfirma(null)} disabled={pend}>
                            Manter
                          </button>
                          <button type="button" className={s.btnPerigoCheio} onClick={() => cancelar(i)} disabled={pend}>
                            {pend ? "Cancelando…" : "Sim, cancelar"}
                          </button>
                        </div>
                      ) : (
                        <div className={s.acoes}>
                          <Link href={`/salas?data=${i.data}`} className={s.btn}>
                            <Icone d={IC.cal} size={14} />
                            Ver na agenda
                          </Link>
                          <button type="button" className={`${s.btn} ${s.btnPerigo}`} onClick={() => setConfirma(i.id)} aria-label={`Cancelar ${i.titulo ?? "reserva"}`}>
                            Cancelar
                          </button>
                        </div>
                      )}
                    </article>
                  );
                })}
            </section>
          ))}
        </div>

        <aside className={s.lado} aria-label="Resumo">
          <section className={`${s.card} ${s.painel}`}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8 }}>
              <h2 className={s.listaTitulo}>Esta semana</h2>
              <span className={s.nota} style={{ fontSize: 12 }}>
                {Number(semana[0].slice(8))} a {Number(semana[4].slice(8))}/{semana[4].slice(5, 7)}
              </span>
            </div>
            <div className={s.semanaMini}>
              {semana.map((d) => {
                const n = itens.filter((i) => i.data === d).length;
                return (
                  <div key={d} data-tem={n ? "1" : undefined} data-hoje={d === hoje ? "1" : undefined} title={n ? `${n} ${n === 1 ? "reserva" : "reservas"}` : "Sem reservas"}>
                    <small>{CURTO[diaDaSemana(d)]}</small>
                    <strong>{d.slice(8)}</strong>
                    <span className={s.pontos}>
                      {Array.from({ length: Math.min(n, 4) }, (_, k) => (
                        <i key={k} />
                      ))}
                    </span>
                  </div>
                );
              })}
            </div>
            <span className={s.nota} style={{ fontSize: 12 }}>Os pontos são as suas reservas em cada dia.</span>
          </section>

          <div className={s.duplo}>
            <div className={`${s.card} ${s.mini}`}>
              <small>Tempo reservado</small>
              <strong>{tempoTotal ? duracao(tempoTotal) : "—"}</strong>
              <small>nos próximos dias</small>
            </div>
            <div className={`${s.card} ${s.mini}`}>
              <small>Sala mais usada</small>
              <strong>{topo ? topo[0] : "—"}</strong>
              <small>{topo ? `${topo[1]} ${topo[1] === 1 ? "reserva sua" : "reservas suas"}` : "sem reservas"}</small>
            </div>
          </div>

          {agoraNaGrade && salas.length > 0 && (
            <section className={`${s.card} ${s.lista}`}>
              <h2 className={s.listaTitulo}>Livres agora</h2>
              {livresAgora.map(({ sala, atual, ate }) => (
                <div key={sala.id} className={s.item}>
                  <span className={s.statIcone} style={atual ? { background: "var(--warn-bg)", color: "var(--warn-forte)" } : { background: "var(--ok-bg)", color: "var(--ok-forte)" }}>
                    <Icone d={IC.porta} />
                  </span>
                  <span className={s.itemTxt}>
                    <strong>{sala.nome}</strong>
                    <span>{atual ? `Ocupada até ${atual.fim}` : `Livre até ${ate}`}</span>
                  </span>
                  {!atual && (
                    <Link href={`/salas?data=${hoje}`} className={`${s.btn} ${s.btnPequeno}`}>
                      Reservar
                    </Link>
                  )}
                </div>
              ))}
            </section>
          )}
        </aside>
      </div>
    </div>
  );
}
