"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader, StatusPill } from "@/components/ui";
import { SelectCustom } from "@/components/SelectCustom";
import { useToast } from "@/components/Toast";
import { GrupoBadge } from "@/components/escala/GrupoBadge";
import { adicionarParticipantes, moverParticipante, removerParticipante } from "@/app/actions/escala";
import type { Candidato, ParticipanteRH, UnidadeEscala } from "@/lib/escala/rh";

const TODAS = "Todas";

function Alerta({ tom, children }: { tom: "warn" | "danger"; children: React.ReactNode }) {
  return (
    <div
      role="alert"
      style={{
        padding: "10px 14px",
        borderRadius: 10,
        fontSize: 13.5,
        background: tom === "danger" ? "var(--danger-bg)" : "var(--warn-bg)",
        color: tom === "danger" ? "var(--danger-forte)" : "var(--warn-forte)",
        border: `1px solid color-mix(in srgb, var(--${tom === "danger" ? "danger" : "warn"}-base) 30%, transparent)`,
      }}
    >
      {children}
    </div>
  );
}

export function ParticipantesClient({
  unidade,
  cidadePadrao,
  unidadePadrao,
  capacidade,
  grupoInicial,
  grupos,
  participantes,
  candidatos,
}: {
  unidade: string;
  cidadePadrao: string;
  unidadePadrao: string;
  capacidade: number;
  grupoInicial: "A" | "B";
  grupos: UnidadeEscala["grupos"];
  participantes: ParticipanteRH[];
  candidatos: Candidato[];
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [pending, start] = useTransition();
  const [cidade, setCidade] = useState(cidadePadrao);
  const [unid, setUnid] = useState(unidadePadrao);
  const [busca, setBusca] = useState("");
  const [sel, setSel] = useState<Set<string>>(new Set());
  const [destino, setDestino] = useState<"A" | "B">("A");
  const [confirmarSaida, setConfirmarSaida] = useState<string | null>(null);

  const ativos = participantes.filter((p) => p.ativo);
  const porGrupo = { A: ativos.filter((p) => p.grupo === "A"), B: ativos.filter((p) => p.grupo === "B") };
  // quem conta na capacidade: não afastados
  const presentes = (g: "A" | "B") => porGrupo[g].filter((p) => p.status !== "Afastado").length;
  const diferenca = Math.abs(porGrupo.A.length - porGrupo.B.length);

  const cidades = useMemo(() => [TODAS, ...[...new Set(candidatos.map((c) => c.cidade))].sort()], [candidatos]);
  const unidades = useMemo(
    () => [TODAS, ...[...new Set(candidatos.filter((c) => cidade === TODAS || c.cidade === cidade).map((c) => c.unidade))].sort()],
    [candidatos, cidade],
  );
  const filtrados = candidatos.filter(
    (c) =>
      (cidade === TODAS || c.cidade === cidade) &&
      (unid === TODAS || c.unidade === unid) &&
      (!busca.trim() || c.nome.toLowerCase().includes(busca.trim().toLowerCase())),
  );

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

  const coluna = (g: "A" | "B") => {
    const email = grupos.find((x) => x.letra === g)?.email_workspace;
    const lista = porGrupo[g];
    return (
      <section className="card elev-sm" style={{ gap: 10, minWidth: 0 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 8, flexWrap: "wrap" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <GrupoBadge grupo={g} rotulo />
            <span className="card-title" style={{ fontSize: 17 }}>
              {lista.length} pessoa{lista.length === 1 ? "" : "s"}
            </span>
          </div>
          {email && <span className="text-muted" style={{ fontSize: 12 }}>{email}</span>}
        </div>
        <span className="text-muted" style={{ fontSize: 12.5 }}>
          {g === grupoInicial ? "Esta semana vem na segunda; na próxima, na sexta" : "Esta semana vem na sexta; na próxima, na segunda"} ·{" "}
          {presentes(g)} de {capacidade} lugares nos dias fixos
        </span>
        {lista.length === 0 ? (
          <p className="text-muted" style={{ fontSize: 13.5, margin: 0 }}>Ninguém neste grupo ainda.</p>
        ) : (
          <div className="esc-lista">
            {lista.map((p) => (
              <div key={p.id} className="esc-linha" style={{ flexWrap: "wrap" }}>
                <div style={{ display: "flex", flexDirection: "column", gap: 3, minWidth: 0 }}>
                  <strong style={{ fontSize: 14 }}>{p.nome}</strong>
                  <span className="text-muted" style={{ fontSize: 12 }}>
                    {p.cargo} · {p.unidade}
                  </span>
                  <span style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    <StatusPill status={p.status} />
                    {p.vinculado ? (
                      <span className="tag tag-accent" style={{ fontSize: 10 }}>já entrou no portal</span>
                    ) : (
                      <span className="tag tag-neutral" style={{ fontSize: 10 }}>nunca entrou no portal</span>
                    )}
                    {!p.email && <span className="tag" style={{ fontSize: 10, background: "var(--warn-bg)", color: "var(--warn-forte)" }}>sem e-mail</span>}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 6 }}>
                  {confirmarSaida === p.id ? (
                    <>
                      <button className="btn btn-danger" disabled={pending} onClick={() => exec(() => removerParticipante(p.id), () => setConfirmarSaida(null))}>
                        Confirmar saída
                      </button>
                      <button className="btn btn-ghost" onClick={() => setConfirmarSaida(null)}>Voltar</button>
                    </>
                  ) : (
                    <>
                      <button
                        className="btn btn-secondary"
                        disabled={pending}
                        onClick={() => exec(() => moverParticipante(p.id, g === "A" ? "B" : "A"))}
                        title="Agendamentos futuros em dias do novo grupo são cancelados"
                      >
                        Mover para {g === "A" ? "B" : "A"}
                      </button>
                      <button className="btn btn-ghost" disabled={pending} onClick={() => setConfirmarSaida(p.id)} style={{ color: "var(--danger)" }}>
                        Tirar da escala
                      </button>
                    </>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader
        eyebrow="Escala de Presença"
        titulo="Participantes"
        sub={`${unidade} · ${ativos.length} participante(s) · ${capacidade} lugares`}
      />

      {diferenca > 1 && (
        <Alerta tom="warn">
          Os grupos estão desequilibrados: A tem {porGrupo.A.length} e B tem {porGrupo.B.length} (diferença de {diferenca}). O ideal é no
          máximo 1 de diferença.
        </Alerta>
      )}
      {(["A", "B"] as const).map(
        (g) =>
          presentes(g) > capacidade && (
            <Alerta key={g} tom="danger">
              O Grupo {g} tem {presentes(g)} pessoas para {capacidade} lugares — nos dias fixos dele não haverá lugar para todos.
            </Alerta>
          ),
      )}

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(340px, 1fr))", gap: "var(--space-4)" }}>
        {coluna("A")}
        {coluna("B")}
      </div>

      <section className="card elev-sm" style={{ gap: 12 }}>
        <div className="card-kicker">Incluir na escala</div>
        <div className="card-title" style={{ fontSize: 17 }}>Colaboradores cadastrados</div>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <div style={{ flex: "1 1 180px", maxWidth: 240 }}><SelectCustom className="input" value={cidade} options={cidades} onChange={(v) => { setCidade(v); setUnid(TODAS); }} /></div>
          <div style={{ flex: "1 1 180px", maxWidth: 240 }}><SelectCustom className="input" value={unid} options={unidades} onChange={setUnid} /></div>
          <input className="input" placeholder="Buscar pelo nome" value={busca} onChange={(e) => setBusca(e.target.value)} style={{ flex: 1, minWidth: 200 }} />
        </div>

        <div style={{ maxHeight: 360, overflowY: "auto", border: "1px solid var(--color-divider)", borderRadius: 10 }}>
          {filtrados.length === 0 ? (
            <p className="text-muted" style={{ fontSize: 13.5, margin: 0, padding: 14 }}>Nenhum colaborador com esses filtros.</p>
          ) : (
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: 36 }}>
                    <input
                      type="checkbox"
                      aria-label="Selecionar todos"
                      checked={filtrados.every((c) => sel.has(c.id))}
                      onChange={(e) => setSel(e.target.checked ? new Set([...sel, ...filtrados.map((c) => c.id)]) : new Set([...sel].filter((id) => !filtrados.some((c) => c.id === id))))}
                    />
                  </th>
                  <th>Nome</th>
                  <th>Cargo</th>
                  <th>Unidade</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {filtrados.map((c) => (
                  <tr key={c.id} onClick={() => { const n = new Set(sel); n.has(c.id) ? n.delete(c.id) : n.add(c.id); setSel(n); }} style={{ cursor: "pointer" }}>
                    <td><input type="checkbox" checked={sel.has(c.id)} readOnly aria-label={`Selecionar ${c.nome}`} /></td>
                    <td>{c.nome}{!c.email && <span className="text-muted" style={{ fontSize: 11 }}> · sem e-mail</span>}</td>
                    <td className="text-muted">{c.cargo}</td>
                    <td className="text-muted">{c.cidade} · {c.unidade}</td>
                    <td><StatusPill status={c.status} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
          <span className="text-muted" style={{ fontSize: 13 }}>{sel.size} selecionado(s) · incluir no</span>
          <SelectCustom className="input" style={{ minWidth: 120 }} value={`Grupo ${destino}`} options={["Grupo A", "Grupo B"]} onChange={(v) => setDestino(v.endsWith("A") ? "A" : "B")} />
          <button
            className="btn btn-primary"
            disabled={pending || sel.size === 0}
            onClick={() => exec(() => adicionarParticipantes([...sel], destino), () => setSel(new Set()))}
          >
            {pending ? "Incluindo..." : "Incluir na escala"}
          </button>
        </div>
        <p className="text-muted" style={{ fontSize: 12, margin: 0 }}>
          Quem não tem e-mail corporativo não consegue entrar no portal (o vínculo é pelo e-mail).
        </p>
      </section>
    </div>
  );
}
