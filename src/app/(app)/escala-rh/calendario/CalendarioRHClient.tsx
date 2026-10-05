"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { GrupoBadge } from "@/components/escala/GrupoBadge";
import { Folha, LivreBadge, StatusTag } from "@/components/escala/AcoesDia";
import { cancelarReservaRH, detalheDia, registrarAusenciaRH, type DetalheDia } from "@/app/actions/escala";
import { dataLonga, horaSP, maiuscula, nomeMes } from "@/lib/escala/formato";

export interface DiaRH {
  data: string;
  util: boolean;
  grupo: "A" | "B" | null;
  feriado: string | null;
  capacidade: number;
  escalados: number;
  afastados: number;
  ausencias: number;
  reservas: number;
  presentes: number;
  fila: number;
  passado: boolean;
  hoje: boolean;
}

const SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

function mesVizinho(ref: string, delta: number): string {
  const [a, m] = ref.split("-").map(Number);
  return new Date(Date.UTC(a, m - 1 + delta, 1)).toISOString().slice(0, 7);
}

const SITUACAO = {
  presente: ["ok", "vai"],
  ausente: ["neutro", "avisou que não vai"],
  ausente_em_cima: ["warn", "não vai (em cima da hora)"],
  afastado: ["warn", "afastado"],
} as const;

export function CalendarioRHClient({ unidade, refMes, dias }: { unidade: string; refMes: string; dias: DiaRH[] }) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [aberto, setAberto] = useState<string | null>(null);
  const [det, setDet] = useState<DetalheDia | null>(null);
  const [ano, mes] = refMes.split("-").map(Number);
  const primeiroSem = new Date(Date.UTC(ano, mes - 1, 1)).getUTCDay();
  const dia = dias.find((d) => d.data === aberto) ?? null;

  const carregar = (data: string) => start(async () => setDet(await detalheDia(data)));
  useEffect(() => {
    setDet(null);
    if (aberto) carregar(aberto);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aberto]);

  const exec = (fn: () => Promise<{ ok: boolean; msg: string }>) =>
    start(async () => {
      const r = await fn();
      toast(r.msg, r.ok ? "ok" : "erro");
      if (aberto) setDet(await detalheDia(aberto));
      router.refresh();
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader
        eyebrow="Escala de Presença"
        titulo="Calendário da Escala"
        sub={unidade}
        acoes={
          <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
            <Link className="btn btn-secondary btn-icon" href={`/escala-rh/calendario?mes=${mesVizinho(refMes, -1)}`} aria-label="Mês anterior">‹</Link>
            <strong style={{ minWidth: 150, textAlign: "center" }}>{maiuscula(nomeMes(mes))} de {ano}</strong>
            <Link className="btn btn-secondary btn-icon" href={`/escala-rh/calendario?mes=${mesVizinho(refMes, 1)}`} aria-label="Próximo mês">›</Link>
          </div>
        }
      />

      <section className="card elev-sm" style={{ gap: 12 }}>
        <div style={{ display: "flex", gap: "6px 16px", flexWrap: "wrap", alignItems: "center", fontSize: 12 }} className="text-muted">
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><GrupoBadge grupo="A" /> Grupo A</span>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><GrupoBadge grupo="B" /> Grupo B</span>
          <span style={{ display: "inline-flex", gap: 6, alignItems: "center" }}><LivreBadge /> Ter a qui: livre</span>
          <span>“vão” = escalados presentes + reservas · clique no dia para ver nomes e agir</span>
        </div>

        <div className="esc-cal" role="grid" aria-label={`Escala de ${nomeMes(mes)}`} style={{ "--linhas": Math.ceil((primeiroSem + dias.length) / 7) } as React.CSSProperties}>
          {SEMANA.map((s) => <div key={s} className="esc-cal-sem">{s}</div>)}
          {Array.from({ length: primeiroSem }, (_, i) => <div key={`v${i}`} className="esc-dia" data-fora="1" />)}
          {dias.map((d) => (
            <button
              key={d.data}
              className="esc-dia"
              data-grupo={d.grupo ?? (d.util ? "livre" : undefined)}
              data-cinza={!d.util ? "1" : undefined}
              data-passado={d.passado ? "1" : undefined}
              data-hoje={d.hoje ? "1" : undefined}
              disabled={!d.util}
              onClick={() => setAberto(d.data)}
              title={d.feriado ?? undefined}
              aria-label={`${dataLonga(d.data)}${d.util ? `, ${d.presentes} de ${d.capacidade} vão` : ""}`}
            >
              <span className="esc-dia-num">
                {Number(d.data.slice(8))}
                {d.grupo ? <GrupoBadge grupo={d.grupo} /> : d.util && <LivreBadge />}
              </span>
              {!d.util ? (
                d.feriado && <span className="esc-dia-info">{d.feriado}</span>
              ) : (
                <span className="esc-dia-info">
                  <strong>{d.presentes}/{d.capacidade}</strong> vão
                  {d.ausencias + d.afastados > 0 && ` · ${d.ausencias + d.afastados} fora`}
                  {d.fila > 0 && ` · fila ${d.fila}`}
                </span>
              )}
            </button>
          ))}
        </div>
      </section>

      {dia && (
        <Folha titulo={maiuscula(dataLonga(dia.data))} onFechar={() => setAberto(null)}>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
            {dia.grupo ? <GrupoBadge grupo={dia.grupo} rotulo /> : <LivreBadge rotulo />}
            <StatusTag tipo="neutro">{dia.presentes} de {dia.capacidade} vão</StatusTag>
            {dia.fila > 0 && <StatusTag tipo="accent">{dia.fila} na fila</StatusTag>}
          </div>
          {!det ? (
            <p className="text-muted" style={{ fontSize: 13 }}>Carregando...</p>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 14, maxHeight: "60vh", overflowY: "auto" }}>
              {det.grupo && (
                <div>
                  <h6 className="text-muted" style={{ margin: "0 0 6px" }}>Escalados do Grupo {det.grupo} ({det.escalados.length})</h6>
                  {det.escalados.length === 0 ? (
                    <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Ninguém no grupo.</p>
                  ) : (
                    <div className="esc-lista">
                      {det.escalados.map((p) => (
                        <div key={p.participanteId} className="esc-linha" style={{ padding: "8px 0" }}>
                          <span style={{ fontSize: 13.5 }}>{p.nome}</span>
                          <span style={{ display: "flex", gap: 6, alignItems: "center" }}>
                            <StatusTag tipo={SITUACAO[p.situacao][0]}>{SITUACAO[p.situacao][1]}</StatusTag>
                            {p.situacao === "presente" && !dia.passado && (
                              <button className="btn btn-ghost" style={{ fontSize: 12 }} disabled={pending} onClick={() => exec(() => registrarAusenciaRH(p.participanteId, dia.data))}>
                                Registrar ausência
                              </button>
                            )}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
              <div>
                <h6 className="text-muted" style={{ margin: "0 0 6px" }}>Agendamentos ({det.reservas.length})</h6>
                {det.reservas.length === 0 ? (
                  <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>Nenhum agendamento.</p>
                ) : (
                  <div className="esc-lista">
                    {det.reservas.map((r) => (
                      <div key={r.id} className="esc-linha" style={{ padding: "8px 0" }}>
                        <span style={{ fontSize: 13.5, display: "flex", gap: 6, alignItems: "center" }}>
                          {r.nome} <GrupoBadge grupo={r.grupo} />
                          {r.origem === "FILA" && <span className="text-muted" style={{ fontSize: 11 }}>via fila</span>}
                        </span>
                        {r.status === "CONFIRMADA" && !dia.passado ? (
                          <button className="btn btn-ghost" style={{ fontSize: 12, color: "var(--danger)" }} disabled={pending} onClick={() => exec(() => cancelarReservaRH(r.id))}>
                            Cancelar
                          </button>
                        ) : (
                          <StatusTag tipo="neutro">{r.status === "UTILIZADA" ? "utilizada" : "confirmada"}</StatusTag>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
              {det.fila.length > 0 && (
                <div>
                  <h6 className="text-muted" style={{ margin: "0 0 6px" }}>Lista de espera ({det.fila.length})</h6>
                  <div className="esc-lista">
                    {det.fila.map((f, i) => (
                      <div key={f.id} className="esc-linha" style={{ padding: "8px 0" }}>
                        <span style={{ fontSize: 13.5 }}>{i + 1}º · {f.nome}</span>
                        {f.status === "OFERECIDA" && f.expira ? (
                          <StatusTag tipo="warn">oferta até {horaSP(f.expira)}</StatusTag>
                        ) : (
                          <StatusTag tipo="accent">aguardando</StatusTag>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </Folha>
      )}
    </div>
  );
}
