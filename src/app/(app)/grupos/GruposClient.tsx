"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { InputMascarado } from "@/components/Mascaras";
import {
  adicionarMembroGrupo,
  excluirOuSolicitarGrupo,
  removerMembrosGrupo,
  solicitarCriacaoGrupo,
} from "@/app/actions/grupos";

export interface GrupoView {
  nome: string;
  email: string;
  membros: { nome: string; email: string }[];
  reqExclusaoId: string | null;
}

export function GruposClient({
  grupos,
  reqCriacao,
  podeExcluirDireto,
  syncHora,
}: {
  grupos: GrupoView[];
  reqCriacao: { email: string; id: string }[];
  podeExcluirDireto: boolean;
  syncHora: string;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busca, setBusca] = useState("");
  const [aberto, setAberto] = useState<string | null>(null);
  const [sel, setSel] = useState<Record<string, boolean>>({});
  const [addEmail, setAddEmail] = useState("");
  const [tipoReq, setTipoReq] = useState<"criacao" | "exclusao">("criacao");
  const [gNome, setGNome] = useState("");
  const [gEmail, setGEmail] = useState("");
  const [gExcluir, setGExcluir] = useState("");
  const [pending, start] = useTransition();

  const filtrados = useMemo(() => {
    const q = busca.toLowerCase();
    return grupos.filter((g) => !q || (g.nome + g.email).toLowerCase().includes(q));
  }, [grupos, busca]);

  const acao = (fn: () => Promise<{ ok: boolean; msg: string }>, aposOk?: () => void) =>
    start(async () => {
      const res = await fn();
      toast(res.msg);
      if (res.ok) {
        aposOk?.();
        router.refresh();
      }
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)", maxWidth: 760 }}>
      <div>
        <h6 className="text-muted" style={{ margin: 0 }}>Geral · espelho do Workspace</h6>
        <h2 style={{ margin: 0 }}>Grupos do Workspace</h2>
        <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, marginTop: 6, flexWrap: "wrap" }}>
          <span style={{ width: 8, height: 8, flex: "none", borderRadius: "50%", background: "var(--ok)" }} />
          <span className="text-muted">
            Sincronizado automaticamente com o Google Workspace · última verificação{" "}
            <span style={{ fontFamily: "var(--mono)" }}>{syncHora}</span>
          </span>
        </div>
      </div>
      <input
        className="input"
        style={{ maxWidth: 320 }}
        placeholder="Buscar grupo por nome ou e-mail"
        value={busca}
        onChange={(e) => setBusca(e.target.value)}
      />
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {filtrados.map((g) => {
          const estaAberto = aberto === g.email;
          const nSel = g.membros.filter((m) => sel[g.email + "|" + m.email]).length;
          return (
            <div key={g.email} className="card" style={{ gap: 0, padding: 0 }}>
              <button
                onClick={() => {
                  setAberto(estaAberto ? null : g.email);
                  setSel({});
                  setAddEmail("");
                }}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  padding: "13px 16px",
                  background: "none",
                  border: "none",
                  cursor: "pointer",
                  textAlign: "left",
                  width: "100%",
                  color: "inherit",
                  fontFamily: "var(--font-body)",
                }}
              >
                <span className="text-muted" style={{ fontFamily: "var(--mono)", fontSize: 12, width: 14, flex: "none" }}>
                  {estaAberto ? "▾" : "▸"}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontFamily: "var(--font-body)", fontWeight: 700 }}>{g.nome}</div>
                  <div className="text-muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                    {g.email}
                  </div>
                </div>
                {g.reqExclusaoId && (
                  <span
                    style={{
                      fontSize: 10,
                      letterSpacing: "0.06em",
                      textTransform: "uppercase",
                      padding: "2px 8px",
                      border: "1px solid var(--warn)",
                      background: "var(--warn-bg)",
                      color: "var(--warn-forte)",
                      flex: "none",
                    }}
                  >
                    exclusão solicitada · {g.reqExclusaoId}
                  </span>
                )}
                <span className="text-muted" style={{ fontFamily: "var(--mono)", fontSize: 12, flex: "none" }}>
                  {g.membros.length} membros
                </span>
              </button>
              {estaAberto && (
                <div
                  style={{
                    borderTop: "1px solid var(--color-divider)",
                    padding: "4px 16px 12px",
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  {g.membros.map((m) => {
                    const k = g.email + "|" + m.email;
                    return (
                      <label
                        key={m.email}
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 10,
                          padding: "7px 0",
                          borderBottom: "1px solid var(--color-divider)",
                          cursor: "pointer",
                        }}
                      >
                        <input
                          type="checkbox"
                          checked={!!sel[k]}
                          onChange={() => setSel((s) => ({ ...s, [k]: !s[k] }))}
                          style={{ accentColor: "var(--color-accent)", width: 15, height: 15, flex: "none" }}
                        />
                        <span
                          style={{
                            width: 26,
                            height: 26,
                            flex: "none",
                            display: "grid",
                            placeItems: "center",
                            borderRadius: "50%",
                            background: "var(--color-accent-100)",
                            color: "var(--color-accent-700)",
                            fontFamily: "var(--font-body)",
                            fontWeight: 700,
                            fontSize: 11,
                          }}
                        >
                          {m.nome[0]}
                        </span>
                        <span style={{ fontSize: 13, flex: 1, minWidth: 0 }}>{m.nome}</span>
                        <span className="text-muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                          {m.email}
                        </span>
                      </label>
                    );
                  })}
                  {g.membros.length === 0 && (
                    <span className="text-muted" style={{ fontSize: 12, padding: "8px 0" }}>
                      Nenhum membro sincronizado neste grupo
                    </span>
                  )}
                  <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center", paddingTop: 12 }}>
                    <InputMascarado
                      tipo="email"
                      style={{ maxWidth: 280, fontSize: 12 }}
                      placeholder="nome.sobrenome@locgrupo.com.br"
                      value={addEmail}
                      onChange={setAddEmail}
                    />
                    <button
                      className="btn btn-secondary"
                      disabled={pending}
                      style={{ fontSize: 12, padding: "4px 12px" }}
                      onClick={() => acao(() => adicionarMembroGrupo(g.email, addEmail), () => setAddEmail(""))}
                    >
                      Adicionar ao grupo
                    </button>
                    {nSel > 0 && (
                      <button
                        className="btn btn-danger"
                        disabled={pending}
                        style={{ fontSize: 12, padding: "4px 12px" }}
                        onClick={() =>
                          acao(
                            () =>
                              removerMembrosGrupo(
                                g.email,
                                g.membros.filter((m) => sel[g.email + "|" + m.email]).map((m) => m.email)
                              ),
                            () => setSel({})
                          )
                        }
                      >
                        Remover selecionados ({nSel})
                      </button>
                    )}
                    {!g.reqExclusaoId && (
                      <button
                        className="btn btn-ghost"
                        disabled={pending}
                        style={{ color: "var(--warn-forte)", fontSize: 12, marginLeft: "auto" }}
                        onClick={() => acao(() => excluirOuSolicitarGrupo(g.email))}
                      >
                        {podeExcluirDireto ? "Excluir grupo" : "Solicitar exclusão do grupo à TI"}
                      </button>
                    )}
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </div>
      <div className="card" style={{ gap: 12 }}>
        <span className="card-title">Criar ou excluir grupos</span>
        <span className="text-muted" style={{ fontSize: 12 }}>
          {podeExcluirDireto
            ? "Você pode excluir grupos diretamente · a criação abre um chamado"
            : "Criação e exclusão são executadas pela TI · cada solicitação abre um chamado"}
        </span>
        <div style={{ display: "flex", gap: 16, flexWrap: "wrap" }}>
          <label className="radio">
            <input type="radio" name="gtipo" checked={tipoReq === "criacao"} onChange={() => setTipoReq("criacao")} />
            <span className="dot"></span>
            <span>Criar grupo</span>
          </label>
          <label className="radio">
            <input type="radio" name="gtipo" checked={tipoReq === "exclusao"} onChange={() => setTipoReq("exclusao")} />
            <span className="dot"></span>
            <span>Excluir grupo</span>
          </label>
        </div>
        {tipoReq === "criacao" ? (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              style={{ maxWidth: 220 }}
              placeholder="Nome do grupo"
              value={gNome}
              onChange={(e) => setGNome(e.target.value)}
            />
            <InputMascarado
              tipo="email"
              style={{ maxWidth: 260 }}
              placeholder="grupo@locgrupo.com.br"
              value={gEmail}
              onChange={setGEmail}
            />
            <button
              className="btn btn-primary"
              disabled={pending}
              onClick={() =>
                acao(
                  () => solicitarCriacaoGrupo(gNome, gEmail),
                  () => {
                    setGNome("");
                    setGEmail("");
                  }
                )
              }
            >
              Solicitar criação à TI
            </button>
          </div>
        ) : (
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <select
              className="input"
              style={{ maxWidth: 280, fontFamily: "var(--mono)" }}
              value={gExcluir || grupos[0]?.email || ""}
              onChange={(e) => setGExcluir(e.target.value)}
            >
              {grupos.map((g) => (
                <option key={g.email} value={g.email}>
                  {g.email}
                </option>
              ))}
            </select>
            <button
              className="btn btn-danger"
              disabled={pending}
              onClick={() => acao(() => excluirOuSolicitarGrupo(gExcluir || grupos[0]?.email || ""))}
            >
              {podeExcluirDireto ? "Excluir grupo" : "Solicitar exclusão à TI"}
            </button>
          </div>
        )}
        {reqCriacao.length > 0 && (
          <div className="text-muted" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
            aguardando TI · {reqCriacao.map((f) => `${f.email} (${f.id})`).join(" · ")}
          </div>
        )}
      </div>
    </div>
  );
}
