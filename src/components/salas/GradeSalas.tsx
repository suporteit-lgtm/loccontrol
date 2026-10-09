"use client";

import { useMemo, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { dataLonga, maiuscula } from "@/lib/escala/formato";
import { somarDias } from "@/lib/escala/calendario";
import {
  diaPermitido, duracao, finsPossiveis, horarios, minutos, type ConfigSalas, type ReservaVista, type Sala,
} from "@/lib/salas/regras";

type Res = { ok: true } | { ok: false; erro: string };

export interface GradeProps {
  data: string;
  hoje: string;
  agoraMin: number;
  config: ConfigSalas;
  salas: Sala[];
  reservas: ReservaVista[];
  /** administrador: agenda para outras pessoas, cancela de todos, passa da antecedência */
  gestor?: boolean;
  reservar: (p: { salaId: string; data: string; ini: string; fim: string; titulo?: string; paraEmail?: string }) => Promise<Res>;
  cancelar: (id: string) => Promise<Res>;
}

type Aberto =
  | { tipo: "nova"; sala: Sala; ini: string }
  | { tipo: "ver"; sala: Sala; r: ReservaVista }
  | null;

const ALTURA = 44; // px por faixa de horário

/** Grade do dia: salas nas colunas, horários nas linhas. Usada no portal (/salas) e no LocControl. */
export function GradeSalas(props: GradeProps) {
  const { data, hoje, agoraMin, config, salas, reservas, gestor = false } = props;
  const router = useRouter();
  const path = usePathname();
  const [aberto, setAberto] = useState<Aberto>(null);

  const faixas = useMemo(() => horarios(config), [config]);
  const ini0 = minutos(config.hora_inicio);
  const linha = (h: string) => Math.round((minutos(h) - ini0) / config.intervalo_min) + 2; // linha 1 = cabeçalho
  const aberta = diaPermitido(data, config);
  const passou = (h: string) => data < hoje || (data === hoje && minutos(h) + config.intervalo_min <= agoraMin);
  const ocupada = (salaId: string, h: string) =>
    reservas.some((r) => r.salaId === salaId && minutos(r.ini) <= minutos(h) && minutos(r.fim) > minutos(h));

  const ir = (d: string) => router.push(`${path}?data=${d}`);
  const agoraNaGrade = data === hoje && agoraMin >= ini0 && agoraMin < minutos(config.hora_fim);
  const faixaAgora = agoraNaGrade ? faixas.find((h) => minutos(h) <= agoraMin && agoraMin < minutos(h) + config.intervalo_min) : undefined;
  const ocupadasAgora = faixaAgora ? salas.filter((s) => ocupada(s.id, faixaAgora)).length : 0;
  const livres = aberta ? salas.reduce((n, s) => n + faixas.filter((h) => !passou(h) && !ocupada(s.id, h)).length, 0) : 0;
  const minhas = reservas.filter((r) => r.minha).length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
      {/* navegação do dia */}
      <div className="card elev-sm sal-nav">
        <button className="btn btn-secondary" onClick={() => ir(somarDias(data, -1))} aria-label="Dia anterior">
          ‹ <span className="sal-oculta-cel">Anterior</span>
        </button>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 6, minWidth: 0 }}>
          <strong style={{ fontSize: 16, textAlign: "center" }}>
            {maiuscula(dataLonga(data))}
            {data === hoje && <span className="tag" style={{ marginLeft: 8, fontSize: 11 }}>Hoje</span>}
          </strong>
          <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
            {data !== hoje && (
              <button className="btn btn-ghost" style={{ height: 30, fontSize: 12.5 }} onClick={() => ir(hoje)}>
                Voltar para hoje
              </button>
            )}
            <input
              type="date"
              className="input"
              value={data}
              onChange={(e) => e.target.value && ir(e.target.value)}
              style={{ height: 32, fontSize: 13, width: 150 }}
              aria-label="Escolher data"
            />
          </div>
        </div>
        <button className="btn btn-secondary" onClick={() => ir(somarDias(data, 1))} aria-label="Próximo dia">
          <span className="sal-oculta-cel">Próximo</span> ›
        </button>
      </div>

      {/* resumo + legenda */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", justifyContent: "space-between" }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: 8, alignItems: "center", fontSize: 13 }}>
          {faixaAgora && (
            <span className="tag" style={{ background: "var(--warn-bg)", color: "var(--warn-forte)", fontWeight: 600 }}>
              Agora: {ocupadasAgora} de {salas.length} {salas.length === 1 ? "sala ocupada" : "salas ocupadas"}
            </span>
          )}
          <span className="text-muted">
            {aberta ? `${livres} ${livres === 1 ? "horário livre" : "horários livres"}` : "Salas fechadas neste dia"}
            {minhas > 0 && ` · ${minhas} ${minhas === 1 ? "agendamento seu" : "agendamentos seus"}`}
          </span>
        </div>
        <div className="sal-legenda">
          <span><i data-t="livre" /> Livre</span>
          <span><i data-t="ocupado" /> Ocupado</span>
          <span><i data-t="minha" /> Seu agendamento</span>
        </div>
      </div>

      {salas.length === 0 ? (
        <div className="card elev-sm" style={{ textAlign: "center", padding: "var(--space-8)" }}>
          <div className="card-title">Nenhuma sala cadastrada</div>
          <p className="card-body">{gestor ? "Cadastre as salas em Cadastro de salas." : "Assim que as salas forem cadastradas, elas aparecem aqui."}</p>
        </div>
      ) : (
        <div className="sal-grade-wrap card elev-sm">
          <div
            className="sal-grade"
            style={{
              gridTemplateColumns: `64px repeat(${salas.length}, minmax(150px, 1fr))`,
              gridTemplateRows: `auto repeat(${faixas.length}, ${ALTURA}px)`,
            }}
          >
            <div className="sal-canto">Horário</div>
            {salas.map((s, j) => (
              <div key={s.id} className="sal-cab" style={{ gridColumn: j + 2 }}>
                <strong>{s.nome}</strong>
                <span>
                  {[s.descricao, `${s.capacidade} ${s.capacidade === 1 ? "pessoa" : "pessoas"}`].filter(Boolean).join(" · ")}
                </span>
              </div>
            ))}

            {faixas.map((h) => (
              <div
                key={h}
                className="sal-hora"
                data-cheia={h.endsWith(":00") ? "1" : undefined}
                data-agora={h === faixaAgora ? "1" : undefined}
                style={{ gridRow: linha(h) }}
              >
                {h}
                {h === faixaAgora && <small>agora</small>}
              </div>
            ))}

            {/* faixas livres / encerradas */}
            {salas.map((s, j) =>
              faixas.map((h) => {
                if (ocupada(s.id, h)) return null;
                const fechada = !aberta || passou(h);
                return fechada ? (
                  <div
                    key={s.id + h}
                    className="sal-cel"
                    data-fechada="1"
                    data-cheia={h.endsWith(":00") ? "1" : undefined}
                    style={{ gridColumn: j + 2, gridRow: linha(h) }}
                  />
                ) : (
                  <button
                    key={s.id + h}
                    className="sal-cel"
                    data-cheia={h.endsWith(":00") ? "1" : undefined}
                    data-agora={h === faixaAgora ? "1" : undefined}
                    style={{ gridColumn: j + 2, gridRow: linha(h) }}
                    onClick={() => setAberto({ tipo: "nova", sala: s, ini: h })}
                    aria-label={`Agendar ${s.nome} às ${h}`}
                  >
                    <span>+ Agendar {h}</span>
                  </button>
                );
              }),
            )}

            {/* agendamentos */}
            {reservas.map((r) => {
              const j = salas.findIndex((s) => s.id === r.salaId);
              if (j < 0) return null;
              const de = Math.max(linha(r.ini), 2);
              const ate = Math.min(linha(r.fim), faixas.length + 2);
              if (ate <= de) return null;
              const curta = ate - de === 1;
              return (
                <button
                  key={r.id}
                  className="sal-res"
                  data-minha={r.minha ? "1" : undefined}
                  data-passou={data < hoje || (data === hoje && minutos(r.fim) <= agoraMin) ? "1" : undefined}
                  style={{ gridColumn: j + 2, gridRow: `${de} / ${ate}` }}
                  onClick={() => setAberto({ tipo: "ver", sala: salas[j], r })}
                  title={`${r.ini}–${r.fim} · ${r.titulo ?? "Reunião"} · ${r.nome}`}
                >
                  <strong>{r.titulo ?? (r.minha ? "Seu agendamento" : "Reservado")}</strong>
                  {!curta && <span>{r.minha ? "Você" : r.nome}</span>}
                  <span className="sal-res-hora">{r.ini}–{r.fim}</span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {aberto?.tipo === "nova" && (
        <NovaReserva
          sala={aberto.sala}
          data={data}
          ini={aberto.ini}
          config={config}
          gestor={gestor}
          ocupadas={reservas.filter((r) => r.salaId === aberto.sala.id)}
          reservar={props.reservar}
          fechar={() => setAberto(null)}
        />
      )}
      {aberto?.tipo === "ver" && (
        <VerReserva sala={aberto.sala} r={aberto.r} gestor={gestor} hoje={hoje} agoraMin={agoraMin} cancelar={props.cancelar} fechar={() => setAberto(null)} />
      )}
    </div>
  );
}

function NovaReserva(p: {
  sala: Sala;
  data: string;
  ini: string;
  config: ConfigSalas;
  gestor: boolean;
  ocupadas: ReservaVista[];
  reservar: GradeProps["reservar"];
  fechar: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const fins = finsPossiveis({ ini: p.ini, config: p.config, ocupadas: p.ocupadas, gestor: p.gestor });
  const [fim, setFim] = useState(fins[Math.min(1, fins.length - 1)] ?? "");
  const [titulo, setTitulo] = useState("");
  const [para, setPara] = useState("");
  const [erro, setErro] = useState<string | null>(null);
  const [pend, start] = useTransition();

  const enviar = (e: React.FormEvent) => {
    e.preventDefault();
    setErro(null);
    start(async () => {
      const r = await p.reservar({ salaId: p.sala.id, data: p.data, ini: p.ini, fim, titulo, paraEmail: para || undefined });
      if (!r.ok) return setErro(r.erro);
      toast(`${p.sala.nome} agendada: ${p.ini}–${fim}.`, "ok");
      p.fechar();
      router.refresh();
    });
  };

  return (
    <div className="dialog-backdrop folha" onClick={(e) => e.target === e.currentTarget && p.fechar()}>
      <form className="dialog" onSubmit={enviar}>
        <span className="dialog-title">Agendar {p.sala.nome}</span>
        <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          <span>{maiuscula(dataLonga(p.data))}</span>
          <span className="text-muted" style={{ fontSize: 12.5 }}>
            {[p.sala.descricao, `até ${p.sala.capacidade} ${p.sala.capacidade === 1 ? "pessoa" : "pessoas"}`, p.sala.local]
              .filter(Boolean)
              .join(" · ")}
            {p.sala.recursos.length > 0 && ` · ${p.sala.recursos.join(", ")}`}
          </span>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <label className="field">
            <span className="label">Início</span>
            <input className="input" value={p.ini} readOnly />
          </label>
          <label className="field">
            <span className="label">Término</span>
            <select className="input" value={fim} onChange={(e) => setFim(e.target.value)} required>
              {fins.map((f) => (
                <option key={f} value={f}>
                  {f} ({duracao(minutos(f) - minutos(p.ini))})
                </option>
              ))}
            </select>
          </label>
        </div>

        <label className="field">
          <span className="label">Assunto (opcional)</span>
          <input
            className="input"
            value={titulo}
            maxLength={120}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder="Ex.: Reunião com o time comercial"
          />
        </label>

        {p.gestor && (
          <label className="field">
            <span className="label">Agendar para outra pessoa (opcional)</span>
            <input
              className="input"
              type="email"
              value={para}
              onChange={(e) => setPara(e.target.value)}
              placeholder="nome@locgrupo.com.br — vazio = para você"
            />
          </label>
        )}

        {erro && (
          <div role="alert" style={{ fontSize: 13, color: "var(--danger-forte)", background: "var(--danger-bg)", borderRadius: 8, padding: "8px 12px" }}>
            {erro}
          </div>
        )}

        <div className="dialog-actions">
          <button type="button" className="btn btn-secondary" onClick={p.fechar}>
            Voltar
          </button>
          <button className="btn btn-primary" disabled={pend || !fim}>
            {pend ? "Agendando…" : "Agendar"}
          </button>
        </div>
      </form>
    </div>
  );
}

function VerReserva(p: {
  sala: Sala;
  r: ReservaVista;
  gestor: boolean;
  hoje: string;
  agoraMin: number;
  cancelar: GradeProps["cancelar"];
  fechar: () => void;
}) {
  const { toast } = useToast();
  const router = useRouter();
  const [pend, start] = useTransition();
  const [confirmar, setConfirmar] = useState(false);
  const terminou = p.r.data < p.hoje || (p.r.data === p.hoje && minutos(p.r.fim) <= p.agoraMin);
  const pode = (p.r.minha || p.gestor) && !terminou;

  const cancelar = () =>
    start(async () => {
      const r = await p.cancelar(p.r.id);
      if (!r.ok) return toast(r.erro, "erro");
      toast("Agendamento cancelado. O horário ficou livre.", "ok");
      p.fechar();
      router.refresh();
    });

  return (
    <div className="dialog-backdrop folha" onClick={(e) => e.target === e.currentTarget && p.fechar()}>
      <div className="dialog">
        <span className="dialog-title">{p.r.titulo ?? (p.r.minha ? "Seu agendamento" : "Sala reservada")}</span>
        <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 6 }}>
          <span>
            <strong>{p.sala.nome}</strong> · {maiuscula(dataLonga(p.r.data))}
          </span>
          <span>
            {p.r.ini}–{p.r.fim} ({duracao(minutos(p.r.fim) - minutos(p.r.ini))})
          </span>
          <span className="text-muted">
            Agendado por {p.r.minha ? "você" : p.r.nome}
            {!p.r.minha && <> · <a href={`mailto:${p.r.email}`}>{p.r.email}</a></>}
          </span>
        </div>
        {confirmar && (
          <div role="alert" style={{ fontSize: 13, color: "var(--danger-forte)", background: "var(--danger-bg)", borderRadius: 8, padding: "8px 12px" }}>
            {p.r.minha ? "Cancelar este agendamento? O horário fica livre para outras pessoas." : `Cancelar o agendamento de ${p.r.nome}?`}
          </div>
        )}
        <div className="dialog-actions">
          <button className="btn btn-secondary" onClick={p.fechar}>
            Fechar
          </button>
          {pode &&
            (confirmar ? (
              <button className="btn btn-danger" disabled={pend} onClick={cancelar}>
                {pend ? "Cancelando…" : "Sim, cancelar"}
              </button>
            ) : (
              <button className="btn btn-danger" onClick={() => setConfirmar(true)}>
                Cancelar agendamento
              </button>
            ))}
        </div>
      </div>
    </div>
  );
}
