"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { SelectCustom } from "@/components/SelectCustom";
import { useToast } from "@/components/Toast";
import { criarAgendaProducaoRH, prepararAmbienteTesteRH, reiniciarEscala, rodarAgora, salvarModos, salvarParametros, type ParametrosForm } from "@/app/actions/escala";
import { horaSP } from "@/lib/escala/formato";
import type { ConfigEscala } from "@/lib/escala/servico";
import type { Modo, Modos } from "@/lib/escala/envio";
import type { UnidadeEscala } from "@/lib/escala/rh";

const DIAS = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
const MODOS: Modo[] = ["DESLIGADO", "TESTE", "PRODUCAO"];
const ROTULO_MODO: Record<Modo, string> = { DESLIGADO: "Desligado", TESTE: "Teste", PRODUCAO: "Produção" };

type Log = { id: number; tarefa: string; inicio: string; fim: string | null; status: string; itens: number; erro: string | null; disparado_por: string };
type Email = { chave: string; destinatario: string; tipo: string; status: string; modo: string; erro: string | null; criado_em: string };

function Campo({ rotulo, ajuda, children }: { rotulo: string; ajuda?: string; children: React.ReactNode }) {
  return (
    <label className="field" style={{ display: "flex", flexDirection: "column", gap: 6, minWidth: 0 }}>
      <span style={{ fontSize: 12, fontWeight: 600 }}>{rotulo}</span>
      {children}
      {ajuda && <span className="text-muted" style={{ fontSize: 11.5 }}>{ajuda}</span>}
    </label>
  );
}

function Status({ ok, sim, nao }: { ok: boolean | null; sim: string; nao: string }) {
  const cor = ok === null ? ["var(--color-neutral-100)", "var(--color-neutral-800)"] : ok ? ["var(--ok-bg)", "var(--ok-forte)"] : ["var(--warn-bg)", "var(--warn-forte)"];
  return (
    <span className="tag" style={{ background: cor[0], color: cor[1], fontWeight: 700 }}>
      {ok ? sim : nao}
    </span>
  );
}

export function ConfigEscalaClient({
  unidade,
  config,
  grupos,
  modos,
  superadmin,
  admin,
  tarefas,
  logs,
  emails,
  integracoes,
}: {
  unidade: string;
  config: ConfigEscala;
  grupos: UnidadeEscala["grupos"];
  modos: Modos;
  superadmin: boolean;
  admin: boolean;
  tarefas: Record<string, string>;
  logs: Log[];
  emails: Email[];
  integracoes: { gmail: boolean; cron: boolean };
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [p, setP] = useState<ParametrosForm>({
    habilitado: config.habilitado,
    capacidade: config.capacidade,
    data_ancora: config.data_ancora,
    grupo_inicial: config.grupo_inicial,
    limite_mensal: config.limite_mensal,
    prazo_hora: config.prazo_hora.slice(0, 5),
    oferta_validade_min: config.oferta_validade_min,
    lembrete_hora: config.lembrete_hora.slice(0, 5),
    resumo_dia_semana: config.resumo_dia_semana,
    resumo_hora: config.resumo_hora.slice(0, 5),
  });
  const [envio, setEnvio] = useState<Modo>(modos.modo_envio);
  const [google, setGoogle] = useState<Modo>(modos.modo_google);
  const [allow, setAllow] = useState(modos.allowlist.join("\n"));
  const [confirmaReinicio, setConfirmaReinicio] = useState(false);

  const exec = (fn: () => Promise<{ ok: boolean; msg: string }>, depois?: () => void) =>
    start(async () => {
      try {
        const r = await fn();
        toast(r.msg, r.ok ? "ok" : "erro");
        if (r.ok) depois?.();
        router.refresh();
      } catch (e) {
        toast((e as Error).message, "erro");
      }
    });
  const set = <K extends keyof ParametrosForm>(k: K, v: ParametrosForm[K]) => setP((x) => ({ ...x, [k]: v }));
  const num = (v: string) => (v.trim() === "" ? NaN : Number(v));

  const ultimoGoogle = logs.find((l) => l.tarefa === "google");
  const statusGoogle = modos.modo_google === "DESLIGADO" ? null : ultimoGoogle ? ultimoGoogle.status === "OK" : null;
  const textoGoogle =
    modos.modo_google === "DESLIGADO"
      ? "Desligado"
      : !ultimoGoogle
        ? "Ainda não sincronizado"
        : ultimoGoogle.status === "OK"
          ? `Sincronizado ${horaSP(ultimoGoogle.inicio)}`
          : `Erro: ${ultimoGoogle.erro ?? "falha"}`;

  const grade = { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(210px, 1fr))", gap: 14 } as const;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader eyebrow="Escala de Presença" titulo="Configurações da Escala" sub={unidade} />

      {/* ── Parâmetros ── */}
      <section className="card elev-sm" style={{ gap: 14 }}>
        <div className="card-kicker">Parâmetros da unidade</div>
        <label className="radio" style={{ gap: 10, fontWeight: 600 }}>
          <input type="checkbox" checked={p.habilitado} onChange={(e) => set("habilitado", e.target.checked)} />
          Escala liberada para os colaboradores desta unidade
        </label>
        <div style={grade}>
          <Campo rotulo="Capacidade de lugares">
            <input className="input" type="number" min={1} value={p.capacidade} onChange={(e) => set("capacidade", num(e.target.value))} />
          </Campo>
          <Campo rotulo="Data âncora (semana 1)" ajuda="A semana desta data é a semana 1 da alternância.">
            <input className="input" type="date" value={p.data_ancora ?? ""} onChange={(e) => set("data_ancora", e.target.value || null)} />
          </Campo>
          <Campo rotulo="Segunda da semana 1 é do" ajuda="Na semana 1 a sexta é do outro grupo; na semana 2 inverte.">
            <SelectCustom className="input" value={`Grupo ${p.grupo_inicial}`} options={["Grupo A", "Grupo B"]} onChange={(v) => set("grupo_inicial", v.endsWith("A") ? "A" : "B")} />
          </Campo>
          <Campo rotulo="Limite de agendamentos por mês" ajuda="Vazio = sem limite.">
            <input
              className="input"
              type="number"
              min={0}
              placeholder="Sem limite"
              value={p.limite_mensal ?? ""}
              onChange={(e) => set("limite_mensal", e.target.value === "" ? null : Number(e.target.value))}
            />
          </Campo>
          <Campo rotulo="Prazo de cancelamento" ajuda="Horário do dia útil anterior.">
            <input className="input" type="time" value={p.prazo_hora} onChange={(e) => set("prazo_hora", e.target.value)} />
          </Campo>
          <Campo rotulo="Validade da oferta da fila (min)" ajuda="Nunca passa da meia-noite do dia da vaga.">
            <input className="input" type="number" min={5} value={p.oferta_validade_min} onChange={(e) => set("oferta_validade_min", num(e.target.value))} />
          </Campo>
          <Campo rotulo="Lembrete da véspera">
            <input className="input" type="time" value={p.lembrete_hora} onChange={(e) => set("lembrete_hora", e.target.value)} />
          </Campo>
          <Campo rotulo="Resumo semanal do RH">
            <div style={{ display: "flex", gap: 6 }}>
              <SelectCustom className="input" style={{ flex: 1 }} value={DIAS[p.resumo_dia_semana]} options={DIAS} onChange={(v) => set("resumo_dia_semana", DIAS.indexOf(v))} />
              <input className="input" type="time" value={p.resumo_hora} onChange={(e) => set("resumo_hora", e.target.value)} style={{ width: 110 }} />
            </div>
          </Campo>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          <button className="btn btn-primary" disabled={pending} onClick={() => exec(() => salvarParametros(p))}>
            {pending ? "Salvando..." : "Salvar parâmetros"}
          </button>
          <span className="text-muted" style={{ fontSize: 12 }}>
            Mudar a âncora, o grupo inicial ou o prazo recalcula os dias futuros (o passado não muda).
          </span>
        </div>
      </section>

      {/* ── Modos ── */}
      <section className="card elev-sm" style={{ gap: 14 }}>
        <div className="card-kicker">Modo de envio</div>
        <div style={grade}>
          <Campo rotulo="E-mails" ajuda="Desligado: só registra. Teste: só a allowlist recebe. Produção: todos.">
            <SelectCustom className="input" value={ROTULO_MODO[envio]} options={MODOS.map((m) => ROTULO_MODO[m])} onChange={(v) => setEnvio(MODOS.find((m) => ROTULO_MODO[m] === v)!)} />
          </Campo>
          <Campo rotulo="Google Agenda e grupos" ajuda="Teste usa agenda e grupos de teste; nunca mexe nos grupos reais.">
            <SelectCustom className="input" value={ROTULO_MODO[google]} options={MODOS.map((m) => ROTULO_MODO[m])} onChange={(v) => setGoogle(MODOS.find((m) => ROTULO_MODO[m] === v)!)} />
          </Campo>
          <Campo rotulo="Allowlist do modo teste" ajuda="Um e-mail por linha.">
            <textarea className="input" rows={3} value={allow} onChange={(e) => setAllow(e.target.value)} style={{ resize: "vertical", fontSize: 13 }} />
          </Campo>
        </div>
        {!superadmin && (envio === "PRODUCAO" || google === "PRODUCAO") && (modos.modo_envio !== "PRODUCAO" || modos.modo_google !== "PRODUCAO") && (
          <p style={{ fontSize: 12.5, margin: 0, color: "var(--warn-forte)" }}>Só o Superadmin pode ativar o modo Produção.</p>
        )}
        <div>
          <button className="btn btn-primary" disabled={pending} onClick={() => exec(() => salvarModos(envio, google, allow.split(/[\n,;]/)))}>
            Salvar modos
          </button>
        </div>
      </section>

      {/* ── Integrações ── */}
      <section className="card elev-sm" style={{ gap: 10 }}>
        <div className="card-kicker">Integrações</div>
        <div className="esc-lista">
          <div className="esc-linha">
            <span>E-mail (Gmail do Workspace)</span>
            <Status ok={integracoes.gmail} sim="Conectado" nao="Sem credencial" />
          </div>
          <div className="esc-linha">
            <span>Feriados nacionais (BrasilAPI)</span>
            <Status ok={logs.find((l) => l.tarefa === "feriados")?.status === "OK" ? true : logs.some((l) => l.tarefa === "feriados") ? false : null} sim="Última importação OK" nao="Sem importação recente" />
          </div>
          <div className="esc-linha" style={{ flexWrap: "wrap" }}>
            <span>
              Grupos do Workspace{" "}
              <span className="text-muted" style={{ fontSize: 12 }}>
                ({grupos.map((g) => (modos.modo_google === "TESTE" ? g.email_teste : g.email_workspace)).filter(Boolean).join(", ")}
                {modos.modo_google === "TESTE" ? " — grupos de teste" : ""})
              </span>
            </span>
            <Status ok={statusGoogle} sim={textoGoogle} nao={textoGoogle} />
          </div>
          <div className="esc-linha" style={{ flexWrap: "wrap" }}>
            <span>
              Google Agenda “Escala de Presença — BH”{" "}
              <span className="text-muted" style={{ fontSize: 12 }}>
                {modos.modo_google === "TESTE"
                  ? modos.calendario_teste_id ? "(agenda de teste criada)" : "(agenda de teste ainda não criada)"
                  : config.calendario_id ? "(agenda de produção criada)" : "(agenda de produção ainda não criada)"}
              </span>
            </span>
            <Status ok={statusGoogle} sim={textoGoogle} nao={textoGoogle} />
          </div>
          <div className="esc-linha">
            <span>Agendador das automações (pg_cron → CRON_SECRET)</span>
            <Status ok={integracoes.cron ? (logs.some((l) => l.disparado_por === "cron") ? true : null) : false} sim="Configurado" nao={integracoes.cron ? "Aguardando o 1º disparo do pg_cron" : "Falta configurar"} />
          </div>
        </div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          <button className="btn btn-secondary" disabled={pending} onClick={() => exec(async () => {
            const rs = [await rodarAgora("eventos"), await rodarAgora("materializar")];
            if (modos.modo_google !== "DESLIGADO") rs.push(await rodarAgora("google"));
            const ok = rs.every((r) => r.ok);
            return { ok, msg: ok ? `Sincronizado (eventos, escala${modos.modo_google !== "DESLIGADO" ? " e Google" : ""}).` : rs.filter((r) => !r.ok).map((r) => r.msg).join(" ") };
          })}>
            Sincronizar agora
          </button>
          {admin && (
            <button className="btn btn-ghost" disabled={pending} onClick={() => exec(prepararAmbienteTesteRH)}>
              Preparar ambiente de teste do Google
            </button>
          )}
          {superadmin && !config.calendario_id && (
            <button className="btn btn-ghost" disabled={pending} onClick={() => exec(criarAgendaProducaoRH)}>
              Criar agenda de produção
            </button>
          )}
        </div>
        <span className="text-muted" style={{ fontSize: 12 }}>
          “Preparar ambiente de teste” cria só a agenda de teste e os grupos escala-teste-a@/b@ — nada real é alterado. No modo Teste, só
          e-mails da allowlist entram como convidados e membros.
        </span>
      </section>

      {/* ── Automações ── */}
      <section className="card elev-sm" style={{ gap: 10 }}>
        <div className="card-kicker">Automações</div>
        <div className="esc-lista">
          {Object.entries(tarefas).map(([t, rotulo]) => {
            const ultimo = logs.find((l) => l.tarefa === t);
            return (
              <div key={t} className="esc-linha" style={{ flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                  <strong style={{ fontSize: 13.5 }}>{rotulo}</strong>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {ultimo
                      ? `Última: ${horaSP(ultimo.inicio)} · ${ultimo.status}${ultimo.status === "OK" ? ` · ${ultimo.itens} item(ns)` : ultimo.erro ? ` · ${ultimo.erro}` : ""} · por ${ultimo.disparado_por}`
                      : "Nunca executada"}
                  </span>
                </div>
                <button className="btn btn-secondary" disabled={pending} onClick={() => exec(() => rodarAgora(t))}>
                  Rodar agora
                </button>
              </div>
            );
          })}
        </div>
        <details>
          <summary className="text-muted" style={{ fontSize: 12.5, cursor: "pointer" }}>Histórico de execuções ({logs.length})</summary>
          <table className="table" style={{ marginTop: 8, fontSize: 12.5 }}>
            <thead>
              <tr><th>Tarefa</th><th>Início</th><th>Status</th><th>Itens</th><th>Por</th><th>Erro</th></tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id}>
                  <td>{tarefas[l.tarefa] ?? l.tarefa}</td>
                  <td style={{ whiteSpace: "nowrap" }}>{horaSP(l.inicio)}</td>
                  <td>{l.status}</td>
                  <td>{l.itens}</td>
                  <td>{l.disparado_por}</td>
                  <td className="text-muted">{l.erro ?? ""}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </details>
      </section>

      {/* ── E-mails registrados ── */}
      <section className="card elev-sm" style={{ gap: 8 }}>
        <div className="card-kicker">E-mails</div>
        <div className="card-title" style={{ fontSize: 17 }}>Últimos registros</div>
        {emails.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13.5, margin: 0 }}>Nenhum e-mail gerado ainda.</p>
        ) : (
          <table className="table" style={{ fontSize: 12.5 }}>
            <thead>
              <tr><th>Quando</th><th>Para</th><th>Tipo</th><th>Situação</th></tr>
            </thead>
            <tbody>
              {emails.map((e) => (
                <tr key={e.chave}>
                  <td style={{ whiteSpace: "nowrap" }}>{horaSP(e.criado_em)}</td>
                  <td>{e.destinatario}</td>
                  <td>{e.tipo}</td>
                  <td>{e.status === "BLOQUEADO_MODO" ? `Não enviado (modo ${e.modo.toLowerCase()})` : e.status === "ENVIADO" ? "Enviado" : `Erro: ${e.erro}`}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* ── Reinício (antes da liberação) ── */}
      {admin && !config.habilitado && (
        <section className="card elev-sm" style={{ gap: 8, borderColor: "color-mix(in srgb, var(--danger-base) 30%, transparent)" }}>
          <div className="card-kicker" style={{ color: "var(--danger)" }}>Antes da liberação</div>
          <div className="card-title" style={{ fontSize: 17 }}>Reiniciar a escala</div>
          <p className="text-muted" style={{ fontSize: 13, margin: 0 }}>
            Apaga os dias, reservas, filas e ausências de teste e recalcula a partir da data âncora. Participantes e feriados continuam.
            Só aparece enquanto a escala não está liberada.
          </p>
          <div style={{ display: "flex", gap: 8 }}>
            {confirmaReinicio ? (
              <>
                <button className="btn btn-danger" disabled={pending} onClick={() => exec(reiniciarEscala, () => setConfirmaReinicio(false))}>
                  Confirmar reinício
                </button>
                <button className="btn btn-ghost" onClick={() => setConfirmaReinicio(false)}>Voltar</button>
              </>
            ) : (
              <button className="btn btn-secondary" style={{ color: "var(--danger)" }} onClick={() => setConfirmaReinicio(true)}>
                Reiniciar escala
              </button>
            )}
          </div>
        </section>
      )}
    </div>
  );
}
