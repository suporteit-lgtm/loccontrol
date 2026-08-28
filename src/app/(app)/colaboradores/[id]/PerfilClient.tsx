"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useToast } from "@/components/Toast";
import { AvatarCircle, StatusPill, useNow } from "@/components/ui";
import { SelectCustom } from "@/components/SelectCustom";
import { InputMascarado } from "@/components/Mascaras";
import { dataBR, quandoBR, sla } from "@/lib/format";
import {
  desligarColaborador,
  tentarNovamenteSync,
  salvarDadosColaborador,
  type DadosColaborador,
  type OpcaoContaGoogle,
} from "@/app/actions/colaboradores";
import { emailValido } from "@/components/Mascaras";
import type { Auditoria, Chamado, Colaborador, Documento, Evento, Papel, UnidadesMap } from "@/lib/types";

interface Props {
  colab: Colaborador;
  unidade: string;
  docs: Documento[];
  eventos: Evento[];
  chamado: Chamado | null;
  hist: Auditoria[];
  acessosDoCargo: string[];
  papel: Papel;
  unidadesMap: UnidadesMap;
  cargos: string[];
  analistas: string[];
}

const FASES = [
  { key: "pre", label: "Pré-admissão", status: "Pré-admissão" },
  { key: "ativo", label: "Ativo", status: "Ativo" },
  { key: "afastado", label: "Afastado", status: "Afastado" },
  { key: "desligado", label: "Desligado", status: "Desligado" },
] as const;

export function PerfilClient({
  colab,
  unidade,
  docs,
  eventos,
  chamado,
  hist,
  acessosDoCargo,
  papel,
  unidadesMap,
  cargos,
  analistas,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const now = useNow();
  const [tab, setTab] = useState<"dados" | "acessos" | "docs" | "chamados" | "hist">("dados");
  const [pop, setPop] = useState<number | null>(null);
  const [modal, setModal] = useState(false);
  const [dData, setDData] = useState("");
  const [dMotivo, setDMotivo] = useState("Pedido de demissão");
  const [dNome, setDNome] = useState("");
  const [dAnalista, setDAnalista] = useState(analistas[0] ?? "");
  const [dConta, setDConta] = useState<OpcaoContaGoogle>("suspender");
  const [dBackup, setDBackup] = useState(false);
  const [dBackupPara, setDBackupPara] = useState("");
  const [editando, setEditando] = useState(false);
  const [form, setForm] = useState<DadosColaborador>({
    nome: colab.nome ?? "",
    cpf: colab.cpf ?? "",
    cargo: colab.cargo ?? "",
    dept: colab.dept ?? "",
    admissao: colab.admissao ?? "",
    status: colab.status ?? "",
    cidade: colab.cidade ?? "",
    unidade: colab.unidade ?? "",
    telefone: colab.telefone ?? "",
    email: colab.email ?? "",
    email_pessoal: colab.email_pessoal ?? "",
  });
  const [pending, start] = useTransition();

  const idx = FASES.findIndex((f) => f.status === colab.status);
  const slaSel = sla(chamado?.sla_alvo ?? null, now);
  const afastadoDesde = eventos.find((e) => e.fase === "afastado")?.quando;
  const veRH = papel === "Superadmin" || papel.startsWith("Admin") || papel === "Usuário RH";

  const stCores = [
    { bg: "var(--color-neutral-200)", cor: "var(--color-text)", borda: "var(--color-neutral-400)" },
    { bg: "var(--ok-bg)", cor: "var(--ok-forte)", borda: "var(--ok)" },
    { bg: "var(--warn-bg)", cor: "var(--warn-forte)", borda: "var(--warn)" },
    { bg: "var(--color-neutral-800)", cor: "var(--color-neutral-100)", borda: "var(--color-neutral-800)" },
  ];

  const trilho = FASES.map((f, i) => {
    const atual = i === idx;
    const passado = i < idx;
    const c = atual
      ? stCores[i]
      : passado
        ? { bg: "var(--color-neutral-100)", cor: "var(--color-neutral-600)", borda: "var(--color-divider)" }
        : { bg: "transparent", cor: "var(--color-neutral-500)", borda: "var(--color-divider)" };
    let prazo = "";
    if (atual && colab.status === "Pré-admissão" && slaSel) prazo = `faltam ${slaSel.txt} para a admissão`;
    if (atual && colab.status === "Ativo") prazo = `desde ${dataBR(colab.admissao)}`;
    if (atual && colab.status === "Desligado") prazo = `em ${dataBR(colab.desligamento)}`;
    if (atual && colab.status === "Afastado" && afastadoDesde) prazo = `desde ${dataBR(afastadoDesde)}`;
    const evs = eventos.filter((e) => e.fase === f.key);
    return { ...f, num: `0${i + 1}`, ...c, prazo, evs, atual };
  });

  // "a preencher" deixa explícito o que veio em branco do Workspace
  const vazio = "a preencher";
  const pGrupos = useMemo(
    () => [
      {
        titulo: "Identificação",
        campos: [
          { k: "Nome completo", v: colab.nome || vazio },
          { k: "CPF", v: colab.cpf || vazio, mono: true },
          { k: "Telefone", v: colab.telefone || vazio, mono: true },
        ],
      },
      {
        titulo: "Cargo e lotação",
        campos: [
          { k: "Cargo", v: colab.cargo || vazio },
          { k: "Departamento", v: colab.dept || vazio },
          { k: "Unidade", v: colab.unidade ? unidade : vazio },
          { k: "Data de admissão", v: colab.admissao ? dataBR(colab.admissao) : vazio, mono: true },
        ],
      },
      {
        titulo: "Acesso",
        campos: [
          { k: "E-mail corporativo", v: colab.email || vazio, mono: true },
          { k: "E-mail pessoal", v: colab.email_pessoal || vazio, mono: true },
          { k: "Status", v: colab.status || vazio },
        ],
      },
    ],
    [colab, unidade]
  );

  const salvar = () =>
    start(async () => {
      const res = await salvarDadosColaborador(colab.id, form);
      toast(res.msg);
      if (res.ok) {
        setEditando(false);
        router.refresh();
      }
    });

  const acessoSt =
    colab.status === "Ativo"
      ? { st: "concedido", bg: "var(--ok-bg)", cor: "var(--ok-forte)", borda: "transparent" }
      : colab.status === "Desligado"
        ? { st: "revogado", bg: "var(--color-neutral-200)", cor: "var(--color-neutral-600)", borda: "transparent" }
        : { st: "pendente", bg: "transparent", cor: "var(--color-neutral-600)", borda: "var(--color-neutral-400)" };

  const backupInvalido = dBackup && !emailValido(dBackupPara);
  const dOff =
    !(dData && dMotivo.trim() && dNome.trim().toUpperCase() === colab.nome.toUpperCase()) || backupInvalido;

  const confirmarDeslig = () =>
    start(async () => {
      const res = await desligarColaborador(
        colab.id,
        dData,
        dMotivo,
        colab.email ? dConta : "manter",
        dBackup ? dBackupPara : undefined,
        dAnalista || undefined
      );
      toast(res.msg);
      setModal(false);
      if (res.ok) router.push(`/offboarding/${colab.id}`);
    });

  const tabs = [
    ["dados", "Dados"],
    ["acessos", "Acessos e grupos"],
    ["docs", "Documentos"],
    ["chamados", "Chamados"],
    ["hist", "Histórico"],
  ] as const;

  const semLink = (e: React.MouseEvent) => {
    e.preventDefault();
    toast("Arquivos reais chegam com a integração de documentos");
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          <AvatarCircle nome={colab.nome} tamanho={52} />
          <div>
            <h6 className="text-muted" style={{ margin: 0 }}>Colaborador</h6>
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <h2 style={{ margin: 0 }}>{colab.nome}</h2>
              <StatusPill status={colab.status ?? "—"} />
            </div>
            <div className="text-muted" style={{ fontSize: 13 }}>
              {colab.cargo} · {colab.dept ?? "—"} · {unidade} ·{" "}
              <span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{colab.cpf}</span>
            </div>
          </div>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          {colab.status === "Ativo" && veRH && (
            <button
              className="btn btn-secondary"
              onClick={() => {
                setModal(true);
                setDData("");
                setDMotivo("Pedido de demissão");
                setDNome("");
              }}
              style={{ color: "var(--danger)", borderColor: "var(--danger)" }}
            >
              Desligar
            </button>
          )}
          <Link href={`/restrita?alvo=${colab.id}`} className="btn btn-ghost" style={{ fontSize: 12 }}>
            Ações de segurança
          </Link>
        </div>
      </div>

      {colab.bloqueado && (
        <div
          style={{
            border: "1px solid var(--danger)",
            background: "var(--danger-bg)",
            padding: "12px 16px",
            fontSize: 13,
            color: "var(--danger-forte)",
            borderRadius: 10,
          }}
        >
          <strong>Acesso bloqueado</strong> em {colab.bloqueado.quando} por {colab.bloqueado.por}. Motivo:{" "}
          {colab.bloqueado.motivo}. O desbloqueio é feito no console do Workspace por um administrador.
        </div>
      )}
      {colab.sync_falha && (
        <div
          style={{
            border: "1px solid var(--warn)",
            background: "var(--warn-bg)",
            padding: "12px 16px",
            fontSize: 13,
            color: "var(--warn-forte)",
            display: "flex",
            alignItems: "center",
            gap: 12,
            flexWrap: "wrap",
            borderRadius: 10,
          }}
        >
          <span style={{ flex: 1 }}>
            O grupo <span style={{ fontFamily: "var(--mono)" }}>{colab.sync_falha}</span> não foi aplicado. Os demais
            grupos estão sincronizados.
          </span>
          <button
            className="btn btn-secondary"
            disabled={pending}
            onClick={() =>
              start(async () => {
                const res = await tentarNovamenteSync(colab.id);
                toast(res.msg);
                router.refresh();
              })
            }
            style={{ borderColor: "var(--warn)", color: "var(--warn-forte)" }}
          >
            Tentar novamente
          </button>
        </div>
      )}

      <div className="blueprint" style={{ padding: "var(--space-3)" }}>
        <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
          {trilho.map((t, i) => (
            <div key={t.key} style={{ flex: 1, minWidth: 130, position: "relative" }}>
              <button
                onClick={() => setPop(pop === i ? null : i)}
                style={{
                  width: "100%",
                  textAlign: "left",
                  cursor: "pointer",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: 14,
                  letterSpacing: "0.02em",
                  padding: "10px 12px",
                  border: `1px solid ${t.borda}`,
                  background: t.bg,
                  color: t.cor,
                  borderRadius: 8,
                  position: "relative",
                  overflow: "hidden",
                  boxShadow: t.atual ? `0 0 0 1px ${t.borda}, 0 4px 14px color-mix(in srgb, ${t.borda} 30%, transparent)` : "none",
                }}
              >
                {t.atual && (
                  <span
                    aria-hidden
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      right: 0,
                      height: 3,
                      background: t.cor,
                      opacity: 0.8,
                    }}
                  />
                )}
                <span
                  style={{
                    display: "block",
                    fontSize: 10,
                    letterSpacing: "0.1em",
                    textTransform: "uppercase",
                    opacity: 0.75,
                    fontFamily: "var(--font-body)",
                  }}
                >
                  {t.num}
                </span>
                {t.label}
                {t.prazo && (
                  <span style={{ display: "block", fontFamily: "var(--mono)", fontSize: 11, fontWeight: 400, marginTop: 2 }}>
                    {t.prazo}
                  </span>
                )}
              </button>
              {pop === i && (
                <div
                  className="elev-lg"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 8px)",
                    left: 0,
                    zIndex: 40,
                    width: 290,
                    maxWidth: "82vw",
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-divider)",
                    padding: 12,
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                    borderRadius: 10,
                  }}
                >
                  <h6 className="text-muted" style={{ margin: 0 }}>Eventos · {t.label}</h6>
                  {t.evs.length > 0 ? (
                    t.evs.map((e) => (
                      <div
                        key={e.id}
                        style={{ fontSize: 12, borderLeft: "2px solid var(--color-accent-300)", paddingLeft: 8 }}
                      >
                        <div>{e.descricao}</div>
                        <div className="text-muted" style={{ fontFamily: "var(--mono)", fontSize: 11 }}>
                          {quandoBR(e.quando)} · {e.ator}
                        </div>
                      </div>
                    ))
                  ) : (
                    <span className="text-muted" style={{ fontSize: 12 }}>
                      Nenhum evento nesta etapa ainda
                    </span>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      <div style={{ display: "flex", gap: 0, borderBottom: "1px solid var(--color-divider)", overflowX: "auto" }}>
        {tabs.map(([k, label]) => (
          <button
            key={k}
            onClick={() => setTab(k)}
            style={{
              cursor: "pointer",
              background: "none",
              border: "none",
              borderBottom: `2px solid ${tab === k ? "var(--color-accent)" : "transparent"}`,
              color: tab === k ? "var(--color-accent-700)" : "var(--color-neutral-600)",
              fontFamily: "var(--font-body)",
              fontWeight: 700,
              fontSize: 14,
              padding: "9px 14px",
              whiteSpace: "nowrap",
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "dados" && !editando && (
        <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-3)" }}>
          {veRH && (
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button className="btn btn-secondary" onClick={() => setEditando(true)}>
                Editar dados
              </button>
            </div>
          )}
          {pGrupos.map((g) => (
            <div key={g.titulo} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <h6
                className="text-muted"
                style={{ margin: 0, fontSize: 11, fontWeight: 800, letterSpacing: "0.08em", textTransform: "uppercase", opacity: 0.7 }}
              >
                {g.titulo}
              </h6>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: "var(--space-3)" }}>
                {g.campos.map((f) => {
                  const pendente = f.v === vazio;
                  return (
                    <div
                      key={f.k}
                      style={{
                        border: `1px solid ${pendente ? "var(--warn)" : "var(--color-divider)"}`,
                        background: pendente ? "var(--warn-bg)" : "var(--color-surface)",
                        padding: "10px 12px",
                        borderRadius: 10,
                      }}
                    >
                      <div className="text-muted" style={{ fontSize: 10, letterSpacing: "0.08em", textTransform: "uppercase" }}>
                        {f.k}
                      </div>
                      <div
                        style={{
                          fontSize: 14,
                          fontFamily: pendente ? "inherit" : f.mono ? "var(--mono)" : "inherit",
                          color: pendente ? "var(--warn-forte)" : "inherit",
                          fontStyle: pendente ? "italic" : "normal",
                        }}
                      >
                        {f.v}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {tab === "dados" && editando && (
        <div className="card" style={{ gap: "var(--space-3)" }}>
          <span className="card-title">Editar dados</span>
          <span className="text-muted" style={{ fontSize: 12 }}>
            O Google Workspace só informa nome, e-mail e situação da conta. O que ficar em branco continua em
            branco — preencha só o que souber.
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
            <div className="field">
              <label>Nome completo</label>
              <input className="input" value={form.nome} onChange={(e) => setForm({ ...form, nome: e.target.value })} />
            </div>
            <div className="field">
              <label>CPF</label>
              <InputMascarado
                tipo="cpf"
                placeholder="000.000.000-00"
                value={form.cpf}
                onChange={(v) => setForm({ ...form, cpf: v })}
              />
            </div>
            <div className="field">
              <label>Cargo</label>
              <input
                className="input"
                list="lista-cargos"
                placeholder="—"
                value={form.cargo}
                onChange={(e) => setForm({ ...form, cargo: e.target.value })}
              />
              <datalist id="lista-cargos">
                {cargos.map((c) => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="field">
              <label>Departamento</label>
              <input className="input" value={form.dept} onChange={(e) => setForm({ ...form, dept: e.target.value })} />
            </div>
            <div className="field">
              <label>Data de admissão</label>
              <input
                className="input"
                type="date"
                value={form.admissao}
                onChange={(e) => setForm({ ...form, admissao: e.target.value })}
              />
            </div>
            <div className="field">
              <label>Status</label>
              <SelectCustom
                className="input"
                value={form.status || "— a definir —"}
                options={["— a definir —", "Pré-admissão", "Ativo", "Afastado", "Desligado"]}
                onChange={(v) => setForm({ ...form, status: v === "— a definir —" ? "" : v })}
              />
            </div>
            <div className="field">
              <label>Cidade</label>
              <SelectCustom
                className="input"
                value={form.cidade || "— a definir —"}
                options={["— a definir —", ...Object.keys(unidadesMap).sort((a, b) => a.localeCompare(b))]}
                onChange={(v) => setForm({ ...form, cidade: v === "— a definir —" ? "" : v, unidade: "" })}
              />
            </div>
            <div className="field">
              <label>Unidade</label>
              <SelectCustom
                className="input"
                value={form.unidade || "— a definir —"}
                options={["— a definir —", ...(unidadesMap[form.cidade] ?? [])]}
                disabled={!form.cidade}
                onChange={(v) => setForm({ ...form, unidade: v === "— a definir —" ? "" : v })}
              />
            </div>
            <div className="field">
              <label>E-mail corporativo</label>
              <InputMascarado
                tipo="email"
                placeholder="nome.sobrenome@locgrupo.com.br"
                value={form.email}
                onChange={(v) => setForm({ ...form, email: v })}
              />
            </div>
            <div className="field">
              <label>Telefone</label>
              <InputMascarado
                tipo="telefone"
                placeholder="(00) 00000-0000"
                value={form.telefone}
                onChange={(v) => setForm({ ...form, telefone: v })}
              />
            </div>
            <div className="field">
              <label>E-mail pessoal</label>
              <InputMascarado
                tipo="email"
                placeholder="nome@gmail.com"
                value={form.email_pessoal}
                onChange={(v) => setForm({ ...form, email_pessoal: v })}
              />
            </div>
          </div>
          <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
            <button
              className="btn btn-secondary"
              onClick={() => {
                setEditando(false);
                setForm({
                  nome: colab.nome ?? "",
                  cpf: colab.cpf ?? "",
                  cargo: colab.cargo ?? "",
                  dept: colab.dept ?? "",
                  admissao: colab.admissao ?? "",
                  status: colab.status ?? "",
                  cidade: colab.cidade ?? "",
                  unidade: colab.unidade ?? "",
                  telefone: colab.telefone ?? "",
                  email: colab.email ?? "",
                  email_pessoal: colab.email_pessoal ?? "",
                });
              }}
            >
              Cancelar
            </button>
            <button className="btn btn-primary" onClick={salvar} disabled={pending}>
              {pending ? "Salvando..." : "Salvar dados"}
            </button>
          </div>
        </div>
      )}

      {tab === "acessos" && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "var(--space-4)" }}>
          <div className="card">
            <span className="card-title">Acessos</span>
            {acessosDoCargo.map((a) => (
              <div
                key={a}
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  padding: "7px 0",
                  borderBottom: "1px solid var(--color-divider)",
                  fontSize: 13,
                }}
              >
                <span>{a}</span>
                <span
                  style={{
                    fontSize: 10,
                    letterSpacing: "0.06em",
                    textTransform: "uppercase",
                    padding: "2px 8px",
                    border: `1px solid ${acessoSt.borda}`,
                    background: acessoSt.bg,
                    color: acessoSt.cor,
                    borderRadius: 999,
                  }}
                >
                  {acessoSt.st}
                </span>
              </div>
            ))}
          </div>
          <div className="card">
            <span className="card-title">Grupos do Workspace</span>
            {colab.grupos.map((g) => (
              <div
                key={g}
                style={{
                  padding: "7px 0",
                  borderBottom: "1px solid var(--color-divider)",
                  fontFamily: "var(--mono)",
                  fontSize: 12,
                }}
              >
                {g}
              </div>
            ))}
          </div>
        </div>
      )}

      {tab === "docs" &&
        (docs.length > 0 ? (
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(260px, 1fr))", gap: "var(--space-3)" }}>
            {docs.map((d) => (
              <div key={d.id} className="card" style={{ flexDirection: "row", alignItems: "center", gap: 12 }}>
                <span
                  style={{
                    width: 38,
                    height: 46,
                    flex: "none",
                    display: "grid",
                    placeItems: "center",
                    border: "1px solid var(--color-divider)",
                    fontFamily: "var(--mono)",
                    fontSize: 10,
                    color: "var(--color-neutral-600)",
                  }}
                >
                  PDF
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontFamily: "var(--mono)",
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {d.arquivo}
                  </div>
                  <div className="text-muted" style={{ fontSize: 12 }}>
                    assinado em {dataBR(d.assinado_em)}
                  </div>
                </div>
                <a href="#" onClick={semLink} style={{ fontSize: 13, whiteSpace: "nowrap" }}>
                  Abrir arquivo ↗
                </a>
              </div>
            ))}
          </div>
        ) : (
          <div className="card" style={{ alignItems: "center", padding: "var(--space-6)" }}>
            <span className="text-muted" style={{ fontSize: 13 }}>
              Nenhum documento anexado. Os termos assinados aparecem aqui
            </span>
          </div>
        ))}

      {tab === "chamados" &&
        (chamado ? (
          <div className="card" style={{ flexDirection: "row", alignItems: "center", gap: 14, flexWrap: "wrap" }}>
            <span style={{ fontFamily: "var(--mono)", fontSize: 13, color: "var(--color-accent-700)" }}>
              {chamado.id}
            </span>
            <span style={{ fontSize: 13, flex: 1 }}>
              {chamado.tipo} · analista {chamado.analista ?? colab.analista ?? "—"}
            </span>
            <button
              className="btn btn-secondary"
              onClick={() =>
                router.push(chamado.tipo === "Admissão" ? `/chamados/${chamado.id}` : `/offboarding/${colab.id}`)
              }
            >
              Abrir chamado
            </button>
          </div>
        ) : (
          <div className="card" style={{ alignItems: "center", padding: "var(--space-6)" }}>
            <span className="text-muted" style={{ fontSize: 13 }}>
              Nenhum chamado aberto para esta pessoa
            </span>
          </div>
        ))}

      {tab === "hist" && (
        <div style={{ display: "flex", flexDirection: "column" }}>
          {hist.length === 0 && (
            <span className="text-muted" style={{ fontSize: 13, padding: "10px 0" }}>
              Nenhuma alteração registrada
            </span>
          )}
          {hist.map((h) => (
            <div
              key={h.id}
              style={{
                display: "flex",
                alignItems: "baseline",
                gap: 10,
                padding: "9px 0",
                borderBottom: "1px solid var(--color-divider)",
                fontSize: 13,
                flexWrap: "wrap",
              }}
            >
              <span style={{ fontFamily: "var(--mono)", fontSize: 12, color: "var(--color-accent-700)" }}>{h.campo}</span>
              <span className="text-muted" style={{ textDecoration: "line-through" }}>
                {h.antes}
              </span>
              <span>→</span>
              <span>{h.depois}</span>
              <span className="text-muted" style={{ marginLeft: "auto", fontFamily: "var(--mono)", fontSize: 11 }}>
                {quandoBR(h.quando)} · {h.ator}
              </span>
            </div>
          ))}
        </div>
      )}

      {modal && (
        <div className="dialog-backdrop">
          <div className="dialog">
            <span className="dialog-title" style={{ color: "var(--danger-forte)" }}>
              Desligar {colab.nome}
            </span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span>
                Isto gera o checklist de offboarding para RH e TI. A conta só é desativada quando a TI concluir os
                itens dela.
              </span>
              <div className="field">
                <label>Data do desligamento</label>
                <input className="input" type="date" value={dData} onChange={(e) => setDData(e.target.value)} />
              </div>
              <div className="field">
                <label>Motivo</label>
                <SelectCustom
                  className="input"
                  value={dMotivo}
                  options={["Pedido de demissão", "Demitido", "Justa causa"]}
                  onChange={setDMotivo}
                />
              </div>
              <div className="field">
                <label>Responsável T.I · o chamado cai direto na fila dele</label>
                <SelectCustom className="input" value={dAnalista} options={analistas} onChange={setDAnalista} />
              </div>
              {colab.email && (
                <div
                  style={{
                    border: "1px solid var(--color-divider)",
                    borderRadius: 10,
                    padding: "10px 12px",
                    display: "flex",
                    flexDirection: "column",
                    gap: 8,
                  }}
                >
                  <span style={{ fontSize: 13, fontWeight: 700 }}>
                    Conta Google (<span style={{ fontFamily: "var(--mono)", fontSize: 12 }}>{colab.email}</span>)
                  </span>
                  {(
                    [
                      ["suspender", "Suspender — bloqueia o login, preserva e-mails e arquivos"],
                      ["excluir", "Excluir do Workspace — some do domínio (recuperável por 20 dias)"],
                      ["manter", "Manter ativa por enquanto"],
                    ] as [OpcaoContaGoogle, string][]
                  ).map(([valor, rotulo]) => (
                    <label key={valor} className="radio" style={{ fontSize: 13 }}>
                      <input
                        type="radio"
                        name="conta-google"
                        checked={dConta === valor}
                        onChange={() => setDConta(valor)}
                      />
                      <span className="dot"></span>
                      <span>{rotulo}</span>
                    </label>
                  ))}
                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      fontSize: 13,
                      cursor: "pointer",
                      borderTop: "1px solid var(--color-divider)",
                      paddingTop: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={dBackup}
                      onChange={() => setDBackup((v) => !v)}
                      style={{ accentColor: "var(--color-accent)", width: 15, height: 15 }}
                    />
                    <span>Fazer backup: transferir os arquivos do Drive para outro usuário antes</span>
                  </label>
                  {dBackup && (
                    <input
                      className="input"
                      style={{ fontFamily: "var(--mono)", fontSize: 13, ...(backupInvalido ? { borderColor: "var(--warn)" } : {}) }}
                      placeholder="quem recebe os arquivos (ex.: suporte.it@locgrupo.com.br)"
                      value={dBackupPara}
                      onChange={(e) => setDBackupPara(e.target.value.toLowerCase().replace(/\s/g, ""))}
                    />
                  )}
                </div>
              )}
              <div className="field">
                <label>Digite {colab.nome.toUpperCase()} para confirmar</label>
                <input
                  className="input"
                  style={{ fontFamily: "var(--mono)" }}
                  value={dNome}
                  onChange={(e) => setDNome(e.target.value)}
                />
              </div>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setModal(false)}>
                Cancelar
              </button>
              <button className="btn btn-danger" onClick={confirmarDeslig} disabled={dOff || pending}>
                {pending ? "Registrando..." : "Desligar e gerar checklist"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
