"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import {
  alternarMatriz,
  alternarObrigatorio,
  adicionarCargo,
  adicionarAcesso,
  renomearCargo,
  renomearAcesso,
  excluirCargo,
  excluirAcesso,
} from "@/app/actions/matriz";

interface Props {
  acessos: string[];
  cargos: string[];
  grid: Record<string, Record<string, { on: boolean; obrig: boolean }>>;
}

interface Renomeando {
  tipo: "cargo" | "acesso";
  atual: string;
  novo: string;
}

interface Excluindo {
  tipo: "cargo" | "acesso";
  nome: string;
}

export function MatrizClient({ acessos, cargos, grid: gridInicial }: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [grid, setGrid] = useState(gridInicial);
  const [novoCargo, setNovoCargo] = useState("");
  const [novoAcesso, setNovoAcesso] = useState("");
  const [gerenciar, setGerenciar] = useState(false);
  const [renomeando, setRenomeando] = useState<Renomeando | null>(null);
  const [excluindo, setExcluindo] = useState<Excluindo | null>(null);
  const [busca, setBusca] = useState("");
  const [pagina, setPagina] = useState(0);
  const [pending, start] = useTransition();

  // 59 cargos numa tela só é ilegível: mostra 10 por vez, com busca e setas
  const POR_PAGINA = 10;
  const filtrados = cargos.filter((c) => c.toLowerCase().includes(busca.trim().toLowerCase()));
  const totalPaginas = Math.max(1, Math.ceil(filtrados.length / POR_PAGINA));
  const paginaAtual = Math.min(pagina, totalPaginas - 1);
  const visiveis = filtrados.slice(paginaAtual * POR_PAGINA, paginaAtual * POR_PAGINA + POR_PAGINA);

  const acao = (fn: () => Promise<{ ok: boolean; msg: string }>) =>
    start(async () => {
      const res = await fn();
      toast(res.msg);
      if (res.ok) router.refresh();
    });

  const toggle = (cargo: string, acesso: string) => {
    // sem linha na matriz ainda: trata como desligada e opcional, senão a
    // célula fica inerte para todo cargo que nunca foi configurado
    const atual = grid[cargo]?.[acesso] ?? { on: false, obrig: false };
    if (atual.obrig) return;
    const on = !atual.on;
    setGrid((g) => ({ ...g, [cargo]: { ...g[cargo], [acesso]: { ...atual, on } } }));
    start(async () => {
      const res = await alternarMatriz(cargo, acesso, on);
      if (!res.ok) {
        toast(res.msg);
        setGrid((g) => ({ ...g, [cargo]: { ...g[cargo], [acesso]: atual } }));
      }
    });
  };

  const botaoMini: React.CSSProperties = {
    background: "none",
    border: "none",
    cursor: "pointer",
    padding: "0 2px",
    fontSize: 11,
    lineHeight: 1,
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader
        eyebrow="Visão RH"
        titulo="Matriz de cargos e acessos"
        sub={
          gerenciar
            ? "Modo de gerenciamento: renomeie (✎) ou exclua (✕) cargos e acessos · clique no cadeado para tornar um acesso obrigatório"
            : "O que está marcado aqui vem pré-selecionado no passo 2 da pré-admissão. 🔒 = obrigatório para o cargo"
        }
        acoes={
          <button
            className={gerenciar ? "btn btn-primary" : "btn btn-secondary"}
            onClick={() => setGerenciar((v) => !v)}
          >
            {gerenciar ? "Concluir gerenciamento" : "Gerenciar cargos e acessos"}
          </button>
        }
      />
      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ maxWidth: 260, fontSize: 13 }}
          placeholder="Buscar cargo"
          value={busca}
          onChange={(e) => {
            setBusca(e.target.value);
            setPagina(0);
          }}
        />
        <div style={{ display: "flex", alignItems: "center", gap: 6, marginLeft: "auto" }}>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 13, padding: "4px 12px" }}
            disabled={paginaAtual === 0}
            onClick={() => setPagina((p) => Math.max(0, p - 1))}
            title="Cargos anteriores"
          >
            ‹
          </button>
          <span className="text-muted" style={{ fontFamily: "var(--mono)", fontSize: 12, whiteSpace: "nowrap" }}>
            {filtrados.length === 0
              ? "nenhum cargo"
              : `${paginaAtual * POR_PAGINA + 1}–${paginaAtual * POR_PAGINA + visiveis.length} de ${filtrados.length}`}
          </span>
          <button
            className="btn btn-secondary"
            style={{ fontSize: 13, padding: "4px 12px" }}
            disabled={paginaAtual >= totalPaginas - 1}
            onClick={() => setPagina((p) => Math.min(totalPaginas - 1, p + 1))}
            title="Próximos cargos"
          >
            ›
          </button>
        </div>
      </div>
      <div
        style={{
          overflowX: "auto",
          border: "1px solid var(--color-divider)",
          borderRadius: 10,
          background: "var(--color-surface)",
        }}
      >
        <table className="table" style={{ minWidth: 720 }}>
          <thead>
            <tr>
              <th style={{ minWidth: 170 }}>Cargo</th>
              {acessos.map((a) => (
                <th key={a} style={{ fontSize: 10 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4 }}>
                    {a}
                    {gerenciar && (
                      <span style={{ display: "inline-flex", gap: 2 }}>
                        <button
                          title={`Renomear ${a}`}
                          style={{ ...botaoMini, color: "var(--color-accent-700)" }}
                          onClick={() => setRenomeando({ tipo: "acesso", atual: a, novo: a })}
                        >
                          ✎
                        </button>
                        {a !== "E-mail corporativo" && (
                          <button
                            title={`Excluir ${a}`}
                            style={{ ...botaoMini, color: "var(--danger-forte)" }}
                            onClick={() => setExcluindo({ tipo: "acesso", nome: a })}
                          >
                            ✕
                          </button>
                        )}
                      </span>
                    )}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {visiveis.map((cargo) => (
              <tr key={cargo} style={{ height: 36 }}>
                <td style={{ fontSize: 13 }}>
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 6 }}>
                    {cargo}
                    {gerenciar && (
                      <span style={{ display: "inline-flex", gap: 2 }}>
                        <button
                          title={`Renomear ${cargo}`}
                          style={{ ...botaoMini, color: "var(--color-accent-700)" }}
                          onClick={() => setRenomeando({ tipo: "cargo", atual: cargo, novo: cargo })}
                        >
                          ✎
                        </button>
                        <button
                          title={`Excluir ${cargo}`}
                          style={{ ...botaoMini, color: "var(--danger-forte)" }}
                          onClick={() => setExcluindo({ tipo: "cargo", nome: cargo })}
                        >
                          ✕
                        </button>
                      </span>
                    )}
                  </span>
                </td>
                {acessos.map((a) => {
                  const cel = grid[cargo]?.[a];
                  return (
                    <td key={a}>
                      {gerenciar ? (
                        <button
                          title={
                            cel?.obrig
                              ? "Obrigatório — clique para tornar opcional"
                              : "Opcional — clique para tornar obrigatório"
                          }
                          style={{ ...botaoMini, fontSize: 14, opacity: cel?.obrig ? 1 : 0.35 }}
                          disabled={pending}
                          onClick={() => acao(() => alternarObrigatorio(cargo, a))}
                        >
                          {cel?.obrig ? "🔒" : "🔓"}
                        </button>
                      ) : cel?.obrig ? (
                        <span title="Obrigatório" style={{ fontSize: 13 }}>
                          🔒
                        </span>
                      ) : (
                        <input
                          type="checkbox"
                          checked={!!cel?.on}
                          onChange={() => toggle(cargo, a)}
                          style={{ accentColor: "var(--color-accent)", width: 15, height: 15 }}
                        />
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Novo cargo (ex.: Auxiliar administrativo)"
          value={novoCargo}
          onChange={(e) => setNovoCargo(e.target.value)}
        />
        <button
          className="btn btn-primary"
          disabled={pending}
          onClick={() =>
            acao(async () => {
              const r = await adicionarCargo(novoCargo);
              if (r.ok) setNovoCargo("");
              return r;
            })
          }
        >
          Adicionar cargo
        </button>
        <span style={{ width: 16 }} />
        <input
          className="input"
          style={{ maxWidth: 280 }}
          placeholder="Novo acesso (ex.: Sistema de frotas)"
          value={novoAcesso}
          onChange={(e) => setNovoAcesso(e.target.value)}
        />
        <button
          className="btn btn-secondary"
          disabled={pending}
          onClick={() =>
            acao(async () => {
              const r = await adicionarAcesso(novoAcesso);
              if (r.ok) setNovoAcesso("");
              return r;
            })
          }
        >
          Adicionar acesso
        </button>
      </div>

      {renomeando && (
        <div className="dialog-backdrop">
          <div className="dialog">
            <span className="dialog-title">
              Renomear {renomeando.tipo === "cargo" ? "cargo" : "acesso"}
            </span>
            <div className="dialog-body" style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span>
                <strong>{renomeando.atual}</strong> passa a se chamar:
              </span>
              <input
                className="input"
                autoFocus
                value={renomeando.novo}
                onChange={(e) => setRenomeando({ ...renomeando, novo: e.target.value })}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && renomeando.novo.trim()) {
                    const r = renomeando;
                    setRenomeando(null);
                    acao(() =>
                      r.tipo === "cargo" ? renomearCargo(r.atual, r.novo) : renomearAcesso(r.atual, r.novo)
                    );
                  }
                }}
              />
              {renomeando.tipo === "cargo" && (
                <span className="text-muted" style={{ fontSize: 12 }}>
                  Os colaboradores que têm este cargo são atualizados junto.
                </span>
              )}
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setRenomeando(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-primary"
                disabled={pending || !renomeando.novo.trim()}
                onClick={() => {
                  const r = renomeando;
                  setRenomeando(null);
                  acao(() =>
                    r.tipo === "cargo" ? renomearCargo(r.atual, r.novo) : renomearAcesso(r.atual, r.novo)
                  );
                }}
              >
                Renomear
              </button>
            </div>
          </div>
        </div>
      )}

      {excluindo && (
        <div className="dialog-backdrop">
          <div className="dialog">
            <span className="dialog-title" style={{ color: "var(--danger-forte)" }}>
              Excluir {excluindo.tipo === "cargo" ? "cargo" : "acesso"}
            </span>
            <div className="dialog-body">
              {excluindo.tipo === "cargo" ? (
                <span>
                  Excluir <strong>{excluindo.nome}</strong> remove a linha da matriz. Se algum colaborador ainda
                  tiver este cargo, a exclusão é bloqueada.
                </span>
              ) : (
                <span>
                  Excluir <strong>{excluindo.nome}</strong> remove a coluna da matriz de todos os cargos. Isso não
                  revoga o acesso de quem já o tem — só deixa de sugerir em novas admissões.
                </span>
              )}
            </div>
            <div className="dialog-actions">
              <button className="btn btn-secondary" onClick={() => setExcluindo(null)}>
                Cancelar
              </button>
              <button
                className="btn btn-danger"
                disabled={pending}
                onClick={() => {
                  const e = excluindo;
                  setExcluindo(null);
                  acao(() => (e.tipo === "cargo" ? excluirCargo(e.nome) : excluirAcesso(e.nome)));
                }}
              >
                Excluir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
