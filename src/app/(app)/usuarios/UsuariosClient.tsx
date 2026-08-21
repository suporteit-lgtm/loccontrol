"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { quandoBR } from "@/lib/format";
import { CampoSenha } from "@/components/CampoSenha";
import {
  aprovarUsuario,
  criarUsuario,
  definirSenha,
  mudarPapel,
  removerUsuario,
  salvarUnidadesAcesso,
} from "@/app/actions/usuarios";
import type { Papel, UnidadesMap, Usuario } from "@/lib/types";

const AV_CORES = ["var(--color-accent)", "var(--ok)", "#8a5cd6", "#c2543a", "#2e7d8a"];

type UsuarioLista = Usuario & { temSenha: boolean };

const PAPEIS_FILTRO = ["Todos", "Superadmin", "Admin RH", "Admin T.I", "Usuário T.I", "Usuário RH"];

export function UsuariosClient({
  usuarios,
  admin,
  podeSenha,
  unidadesMap,
}: {
  usuarios: UsuarioLista[];
  admin: boolean;
  podeSenha: boolean;
  unidadesMap: UnidadesMap;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [busca, setBusca] = useState("");
  const [editando, setEditando] = useState<Usuario | null>(null);
  const [selecao, setSelecao] = useState<Record<string, boolean>>({});
  const [criando, setCriando] = useState(false);
  const [novo, setNovo] = useState({ nome: "", email: "", papel: "Usuário RH" as Papel, senha: "" });
  const [novoUnidades, setNovoUnidades] = useState<Record<string, boolean>>({});
  const [fPapel, setFPapel] = useState("Todos");
  const [senhaDe, setSenhaDe] = useState<UsuarioLista | null>(null);
  const [novaSenha, setNovaSenha] = useState("");
  const [pending, start] = useTransition();

  const lista = useMemo(() => {
    const q = busca.toLowerCase();
    return usuarios
      .filter(
        (u) =>
          (!q || (u.nome + u.email).toLowerCase().includes(q)) &&
          (fPapel === "Todos" || u.papel === fPapel)
      )
      .slice()
      .sort((a, b) => (a.status === "pendente" ? 0 : 1) - (b.status === "pendente" ? 0 : 1));
  }, [usuarios, busca, fPapel]);

  const pendentes = usuarios.filter((u) => u.status === "pendente").length;

  const acao = (fn: () => Promise<{ ok: boolean; msg: string }>) =>
    start(async () => {
      const res = await fn();
      toast(res.msg);
      router.refresh();
    });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <div style={{ display: "flex", alignItems: "flex-end", justifyContent: "space-between", gap: 16, flexWrap: "wrap" }}>
        <div>
          <h6 className="text-muted" style={{ margin: 0 }}>Visão TI</h6>
          <h2 style={{ margin: 0 }}>Usuários</h2>
          <div className="text-muted" style={{ fontSize: 13 }}>
            {admin
              ? "Quem entra com o Google só acessa depois da aprovação de um admin · clique em Pendente para aprovar"
              : "Visualização — somente admins (T.I, RH ou Superadmin) alteram papéis, aprovam ou removem usuários"}
          </div>
          <div className="text-muted" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
            suporte.it@locgrupo.com.br é o superadmin permanente — se um admin for excluído, entre com ele e recrie
          </div>
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
          {admin && (
            <button
              className="btn btn-primary"
              onClick={() => {
                setNovo({ nome: "", email: "", papel: "Usuário RH", senha: "" });
                setNovoUnidades({});
                setCriando(true);
              }}
            >
              + Novo usuário
            </button>
          )}
          {pendentes > 0 && (
            <span
              style={{
                fontSize: 11,
                letterSpacing: "0.06em",
                textTransform: "uppercase",
                padding: "4px 10px",
                border: "1px solid var(--warn)",
                background: "var(--warn-bg)",
                color: "var(--warn-forte)",
              }}
            >
              {pendentes} aguardando aprovação
            </span>
          )}
          <span className="text-muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
            {usuarios.length} usuários registrados
          </span>
        </div>
      </div>
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
        <input
          className="input"
          style={{ maxWidth: 340 }}
          placeholder="Pesquisar por nome ou e-mail"
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
        />
        {PAPEIS_FILTRO.map((p) => {
          const sel = fPapel === p;
          return (
            <button
              key={p}
              onClick={() => setFPapel(p)}
              className="btn"
              style={{
                fontSize: 12,
                padding: "4px 12px",
                fontFamily: "var(--font-body)",
                border: `1px solid ${sel ? "var(--color-accent)" : "var(--color-divider)"}`,
                color: sel ? "var(--color-accent-700)" : "inherit",
                background: sel ? "var(--color-accent-100)" : "transparent",
              }}
            >
              {p}
            </button>
          );
        })}
      </div>
      <div
        style={{
          overflowX: "auto",
          border: "1px solid var(--color-divider)",
          borderRadius: 10,
          background: "var(--color-surface)",
        }}
      >
        <table className="table" style={{ minWidth: 820 }}>
          <thead>
            <tr>
              <th>Usuário</th>
              <th>E-mail</th>
              <th>Status</th>
              <th>Papel</th>
              <th>Unidades</th>
              <th>Último acesso</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {lista.map((u) => (
              <tr key={u.id} style={{ height: 46 }}>
                <td>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span
                      style={{
                        width: 28,
                        height: 28,
                        flex: "none",
                        display: "grid",
                        placeItems: "center",
                        borderRadius: "50%",
                        background: AV_CORES[u.nome.length % AV_CORES.length],
                        color: "#fff",
                        fontFamily: "var(--font-body)",
                        fontWeight: 700,
                        fontSize: 12,
                      }}
                    >
                      {u.nome[0]}
                    </span>
                    <span style={{ fontSize: 14, whiteSpace: "nowrap" }}>{u.nome}</span>
                  </div>
                </td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 12 }} className="text-muted">
                  {u.email}
                </td>
                <td>
                  {u.status === "pendente" ? (
                    admin ? (
                      <button
                        onClick={() => acao(() => aprovarUsuario(u.id))}
                        disabled={pending}
                        title="Clique para aprovar o acesso"
                        style={{
                          cursor: "pointer",
                          fontSize: 10,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          padding: "3px 10px",
                          borderRadius: 999,
                          border: "1px solid var(--warn)",
                          background: "var(--warn-bg)",
                          color: "var(--warn-forte)",
                          fontFamily: "var(--font-body)",
                        }}
                      >
                        Pendente
                      </button>
                    ) : (
                      <span
                        style={{
                          display: "inline-block",
                          fontSize: 10,
                          letterSpacing: "0.06em",
                          textTransform: "uppercase",
                          padding: "3px 10px",
                          borderRadius: 999,
                          border: "1px solid var(--warn)",
                          background: "var(--warn-bg)",
                          color: "var(--warn-forte)",
                        }}
                      >
                        Pendente
                      </span>
                    )
                  ) : (
                    <span
                      style={{
                        display: "inline-block",
                        fontSize: 10,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        padding: "3px 10px",
                        border: "1px solid transparent",
                        background: "var(--ok-bg)",
                        color: "var(--ok-forte)",
                      }}
                    >
                      ✓ Aprovado
                    </span>
                  )}
                </td>
                <td>
                  {u.superadmin ? (
                    <span
                      title="Superadmin permanente · nunca perde o acesso"
                      style={{
                        display: "inline-block",
                        fontSize: 10,
                        letterSpacing: "0.06em",
                        textTransform: "uppercase",
                        padding: "3px 10px",
                        border: "1px solid var(--danger)",
                        background: "var(--danger-bg)",
                        color: "var(--danger-forte)",
                      }}
                    >
                      Superadmin
                    </span>
                  ) : admin ? (
                    <select
                      className="input"
                      style={{ fontSize: 12, padding: "3px 6px", width: "auto", minHeight: 28 }}
                      value={u.papel}
                      onChange={(e) => acao(() => mudarPapel(u.id, e.target.value as Papel))}
                    >
                      <option value="Admin RH">Admin RH</option>
                      <option value="Admin T.I">Admin T.I</option>
                      <option value="Usuário T.I">Usuário T.I</option>
                      <option value="Usuário RH">Usuário RH</option>
                    </select>
                  ) : (
                    <span style={{ fontSize: 13 }}>{u.papel}</span>
                  )}
                </td>
                <td>
                  {u.superadmin ? (
                    <span className="text-muted" style={{ fontSize: 12 }}>
                      Todas
                    </span>
                  ) : admin ? (
                    <button
                      className="btn btn-secondary"
                      style={{ fontSize: 12, padding: "3px 10px" }}
                      onClick={() => {
                        setEditando(u);
                        setSelecao(
                          Object.fromEntries((u.unidades_acesso ?? []).map((k) => [k, true]))
                        );
                      }}
                    >
                      {(u.unidades_acesso ?? []).length
                        ? `${u.unidades_acesso.length} unidade(s)`
                        : "Todas"}
                    </button>
                  ) : (
                    <span style={{ fontSize: 12 }}>
                      {(u.unidades_acesso ?? []).length
                        ? `${u.unidades_acesso.length} unidade(s)`
                        : "Todas"}
                    </span>
                  )}
                </td>
                <td style={{ fontFamily: "var(--mono)", fontSize: 12 }} className="text-muted">
                  {u.status === "pendente"
                    ? `solicitou em ${quandoBR(u.solicitado_em)}`
                    : quandoBR(u.ultimo_acesso)}
                </td>
                <td>
                  <div style={{ display: "flex", gap: 4, whiteSpace: "nowrap" }}>
                    {podeSenha && !u.superadmin && (
                      <button
                        className="btn btn-ghost"
                        title={u.temSenha ? "Redefinir a senha" : "Este usuário ainda não tem senha"}
                        onClick={() => {
                          setSenhaDe(u);
                          setNovaSenha("");
                        }}
                        style={{
                          fontSize: 12,
                          padding: "2px 8px",
                          color: u.temSenha ? undefined : "var(--warn-forte)",
                        }}
                      >
                        {u.temSenha ? "Senha" : "Definir senha!"}
                      </button>
                    )}
                    {admin && !u.superadmin && (
                      <button
                        className="btn btn-ghost"
                        disabled={pending}
                        onClick={() => acao(() => removerUsuario(u.id))}
                        style={{ fontSize: 12, color: "var(--danger-forte)", padding: "2px 8px" }}
                      >
                        Remover
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {criando && (
        <div className="dialog-backdrop">
          <div className="dialog" style={{ width: "min(560px, 100%)" }}>
            <span className="dialog-title">Novo usuário</span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                <div className="field">
                  <label>Nome completo</label>
                  <input
                    className="input"
                    autoFocus
                    value={novo.nome}
                    onChange={(e) => setNovo((n) => ({ ...n, nome: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>E-mail corporativo</label>
                  <input
                    className="input"
                    style={{ fontFamily: "var(--mono)" }}
                    placeholder="nome.sobrenome@locgrupo.com.br"
                    value={novo.email}
                    onChange={(e) => setNovo((n) => ({ ...n, email: e.target.value }))}
                  />
                </div>
                <div className="field">
                  <label>Papel</label>
                  <select
                    className="input"
                    value={novo.papel}
                    onChange={(e) => setNovo((n) => ({ ...n, papel: e.target.value as Papel }))}
                  >
                    <option value="Admin RH">Admin RH</option>
                    <option value="Admin T.I">Admin T.I</option>
                    <option value="Usuário T.I">Usuário T.I</option>
                    <option value="Usuário RH">Usuário RH</option>
                  </select>
                </div>
                <div className="field">
                  <label>Senha inicial · mínimo 8 caracteres</label>
                  <CampoSenha value={novo.senha} onChange={(v) => setNovo((n) => ({ ...n, senha: v }))} />
                </div>
              </div>
              <div>
                <h6 className="text-muted" style={{ margin: "0 0 6px" }}>
                  Unidades que pode acessar · nenhuma marcada = todas
                </h6>
                <div style={{ maxHeight: "34vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                  {Object.keys(unidadesMap)
                    .sort((a, b) => a.localeCompare(b))
                    .map((cidade) => (
                      <div key={cidade}>
                        <h6 className="text-muted" style={{ margin: "0 0 4px" }}>
                          {cidade}
                        </h6>
                        <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                          {(unidadesMap[cidade] ?? []).map((un) => {
                            const chave = `${cidade}|${un}`;
                            const sel = !!novoUnidades[chave];
                            return (
                              <button
                                key={chave}
                                onClick={() => setNovoUnidades((s) => ({ ...s, [chave]: !s[chave] }))}
                                className="btn"
                                style={{
                                  fontSize: 12,
                                  padding: "4px 12px",
                                  fontFamily: "var(--font-body)",
                                  border: `1px solid ${sel ? "var(--color-accent)" : "var(--color-divider)"}`,
                                  color: sel ? "var(--color-accent-700)" : "inherit",
                                  background: sel ? "var(--color-accent-100)" : "transparent",
                                  borderRadius: 999,
                                }}
                              >
                                {sel ? "✓ " : ""}
                                {un}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                </div>
              </div>
              <span className="text-muted" style={{ fontSize: 12 }}>
                O usuário já entra aprovado. Enquanto o login for por papel (demonstração), ele acessa
                escolhendo o papel dele na tela de entrada; com o SSO Google, o acesso passa a ser pelo
                e-mail cadastrado aqui.
              </span>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setCriando(false)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={pending || !novo.nome.trim() || !novo.email.includes("@") || novo.senha.length < 8}
                onClick={() =>
                  start(async () => {
                    const res = await criarUsuario({
                      ...novo,
                      unidades: Object.keys(novoUnidades).filter((k) => novoUnidades[k]),
                    });
                    toast(res.msg);
                    if (res.ok) {
                      setCriando(false);
                      router.refresh();
                    }
                  })
                }
              >
                {pending ? "Criando..." : "Criar usuário"}
              </button>
            </div>
          </div>
        </div>
      )}

      {senhaDe && (
        <div className="dialog-backdrop">
          <div className="dialog">
            <span className="dialog-title">
              {senhaDe.temSenha ? "Redefinir" : "Definir"} senha de {senhaDe.nome}
            </span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div className="field">
                <label>Nova senha · mínimo 8 caracteres</label>
                <CampoSenha value={novaSenha} onChange={setNovaSenha} autoFocus />
              </div>
              <span className="text-muted" style={{ fontSize: 12 }}>
                Informe a nova senha ao usuário por um canal seguro. Ele usa o e-mail{" "}
                <span style={{ fontFamily: "var(--mono)" }}>{senhaDe.email}</span> para entrar.
              </span>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setSenhaDe(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={pending || novaSenha.length < 8}
                onClick={() =>
                  start(async () => {
                    const res = await definirSenha(senhaDe.id, novaSenha);
                    toast(res.msg);
                    if (res.ok) {
                      setSenhaDe(null);
                      router.refresh();
                    }
                  })
                }
              >
                {pending ? "Salvando..." : "Salvar senha"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editando && (
        <div className="dialog-backdrop">
          <div className="dialog" style={{ width: "min(520px, 100%)" }}>
            <span className="dialog-title">Unidades de {editando.nome}</span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <span>
                Marque as unidades que {editando.nome.split(" ")[0]} pode acessar.{" "}
                <strong>Nenhuma marcada = acesso a todas.</strong>
              </span>
              <div style={{ maxHeight: "46vh", overflowY: "auto", display: "flex", flexDirection: "column", gap: 10 }}>
                {Object.keys(unidadesMap)
                  .sort((a, b) => a.localeCompare(b))
                  .map((cidade) => (
                    <div key={cidade}>
                      <h6 className="text-muted" style={{ margin: "0 0 4px" }}>
                        {cidade}
                      </h6>
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {(unidadesMap[cidade] ?? []).map((un) => {
                          const chave = `${cidade}|${un}`;
                          const sel = !!selecao[chave];
                          return (
                            <button
                              key={chave}
                              onClick={() => setSelecao((s) => ({ ...s, [chave]: !s[chave] }))}
                              className="btn"
                              style={{
                                fontSize: 12,
                                padding: "4px 12px",
                                fontFamily: "var(--font-body)",
                                border: `1px solid ${sel ? "var(--color-accent)" : "var(--color-divider)"}`,
                                color: sel ? "var(--color-accent-700)" : "inherit",
                                background: sel ? "var(--color-accent-100)" : "transparent",
                                borderRadius: 999,
                              }}
                            >
                              {sel ? "✓ " : ""}
                              {un}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  ))}
              </div>
            </div>
            <div className="dialog-actions">
              <button className="btn btn-ghost" onClick={() => setSelecao({})} style={{ marginRight: "auto", fontSize: 13 }}>
                Limpar (todas)
              </button>
              <button className="btn btn-secondary" onClick={() => setEditando(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={pending}
                onClick={() => {
                  const lista = Object.keys(selecao).filter((k) => selecao[k]);
                  acao(() => salvarUnidadesAcesso(editando.id, lista));
                  setEditando(null);
                }}
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
