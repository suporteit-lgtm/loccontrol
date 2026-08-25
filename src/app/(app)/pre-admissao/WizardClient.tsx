"use client";

import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { SelectCustom } from "@/components/SelectCustom";
import { useToast } from "@/components/Toast";
import { EQUIPAMENTOS, KIT_PADRAO } from "@/lib/types";
import { InputMascarado, mascaraCpf, type TipoMascara } from "@/components/Mascaras";
import {
  abrirChamadoWizard,
  buscarQuark,
  limparDraft,
  salvarDraft,
  type DraftWizard,
  type OpcaoQuark,
} from "@/app/actions/wizard";

interface Props {
  draftInicial: DraftWizard;
  draftPadrao: DraftWizard;
  matriz: Record<string, Record<string, { on: boolean; obrig: boolean }>>;
  acessos: string[];
  cargos: string[];
  unidadesMap: Record<string, string[]>;
  grupos: { nome: string; email: string }[];
  analistas: { nome: string; fila: number }[];
  equipCatalogo: { nome: string; kit: boolean }[];
  /** "Cidade|Unidade" → grupo do Workspace daquela base (null = ainda não definido) */
  grupoDaUnidade: Record<string, string | null>;
}

/** Grupo que todo colaborador entra, independente da base. */
const GRUPO_GERAL = "comunicado@locgrupo.com.br";

export function WizardClient({
  draftInicial,
  draftPadrao,
  matriz,
  acessos,
  cargos,
  unidadesMap,
  grupos,
  analistas,
  equipCatalogo,
  grupoDaUnidade,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  // catálogo editável em Configurações; se vazio, usa o padrão do código
  const catalogo = equipCatalogo.length
    ? equipCatalogo
    : EQUIPAMENTOS.map((nome) => ({ nome, kit: KIT_PADRAO.includes(nome) }));
  const listaEquip = catalogo.map((e) => e.nome);
  const kitPadrao = () => Object.fromEntries(catalogo.map((e) => [e.nome, e.kit]));
  const [d, setD] = useState<DraftWizard>(() => ({
    ...draftInicial,
    equip: Object.keys(draftInicial.equip ?? {}).length ? draftInicial.equip : kitPadrao(),
  }));
  const [loading, setLoading] = useState(false);
  const [opcoes, setOpcoes] = useState<OpcaoQuark[] | null>(null);
  const [gruposAberto, setGruposAberto] = useState(false);
  const [gruposBusca, setGruposBusca] = useState("");
  const [pending, start] = useTransition();
  const salvarT = useRef<ReturnType<typeof setTimeout> | null>(null);

  // persiste o rascunho (debounce) — os dados sobrevivem à navegação
  const persistir = useCallback((novo: DraftWizard) => {
    if (salvarT.current) clearTimeout(salvarT.current);
    salvarT.current = setTimeout(() => void salvarDraft(novo), 600);
  }, []);

  const upd = useCallback(
    (patch: Partial<DraftWizard>) => {
      setD((prev) => {
        const novo = { ...prev, ...patch };
        persistir(novo);
        return novo;
      });
    },
    [persistir]
  );

  useEffect(() => () => {
    if (salvarT.current) clearTimeout(salvarT.current);
  }, []);

  const montarAcc = (cargo: string) => {
    const o: DraftWizard["acc"] = {};
    for (const a of acessos) {
      const m = matriz[cargo]?.[a];
      if (m) o[a] = { on: m.on, obrig: m.obrig, just: "" };
    }
    return o;
  };

  const acc = d.acc ?? montarAcc(d.cargo);
  const listaAcessos = acessos.filter((a) => matriz[d.cargo]?.[a]?.on || acc[a]?.on);
  const marcados = listaAcessos.filter((a) => acc[a]?.on).length;
  const totalDoCargo = acessos.filter((a) => matriz[d.cargo]?.[a]?.on).length;
  const campo = (k: string) => d.campos?.find((c) => c.k === k)?.v ?? "";
  const equipSel = listaEquip.filter((e) => d.equip[e]);

  const reiniciar = () => {
    const novo = {
      ...draftPadrao,
      equip: kitPadrao(),
    };
    setD(novo);
    void salvarDraft(novo);
  };

  const buscar = () => {
    setLoading(true);
    setOpcoes(null);
    start(async () => {
      const r = await buscarQuark(d.busca);
      setLoading(false);
      if (!r.ok) {
        toast(r.msg ?? "Nada encontrado no QuarkRH");
        return;
      }
      if (r.opcoes.length === 1) {
        upd({ campos: r.opcoes[0].campos });
        return;
      }
      setOpcoes(r.opcoes); // mais de um candidato: quem escolhe é o RH
      toast(`${r.opcoes.length} pessoas encontradas — escolha na lista`);
    });
  };

  const avancar3 = () => {
    const t = d.grupoLivre.trim().toLowerCase();
    if (t) {
      if (!grupos.some((g) => g.email === t)) {
        toast(`O grupo ${t} não existe no Workspace · solicite a criação à TI em Grupos do Workspace`);
        return;
      }
      upd({ step: 3, grupos: d.grupos.includes(t) ? d.grupos : [...d.grupos, t], grupoLivre: "" });
      return;
    }
    upd({ step: 3 });
  };

  const abrir = () =>
    start(async () => {
      const res = await abrirChamadoWizard(d);
      toast(res.msg);
      if (res.ok) {
        setD((prev) => ({ ...prev, step: 4, ticket: res.chamadoId }));
        router.refresh();
      }
    });

  /** Todos os grupos de unidade conhecidos — usados para trocar o antigo pelo novo. */
  const gruposDeUnidade = Object.values(grupoDaUnidade).filter(Boolean) as string[];

  /**
   * Ao definir a base, os grupos padrão passam a ser
   * comunicado@ + o grupo daquela unidade. O que o RH tiver marcado à mão
   * continua; só o grupo da unidade anterior é substituído.
   */
  const gruposPara = (cidade: string, unidade: string, atuais: string[]): string[] => {
    const daUnidade = grupoDaUnidade[`${cidade}|${unidade}`] ?? null;
    // comunicado@ saiu dos padrões: o Workspace já inclui toda conta nova nele
    const semAntigos = atuais.filter((g) => g !== GRUPO_GERAL && !gruposDeUnidade.includes(g));
    return [...(daUnidade ? [daUnidade] : []), ...semAntigos];
  };

  const setCidade = (cidade: string) => {
    const unidade = unidadesMap[cidade]?.[0] ?? "";
    upd({ cidade, unidade, grupos: gruposPara(cidade, unidade, d.grupos) });
  };

  const setUnidade = (unidade: string) =>
    upd({ unidade, grupos: gruposPara(d.cidade, unidade, d.grupos) });

  const grupoDaBase = grupoDaUnidade[`${d.cidade}|${d.unidade}`] ?? null;

  const passos = ["1 · Importar", "2 · Acessos e grupos", "3 · Chamado"];

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-6)", width: "100%" }}>
      <PageHeader
        eyebrow="Visão RH"
        titulo="Nova pré-admissão"
        sub="O que você digitar fica salvo ao navegar entre telas"
        acoes={
          <button
            className="btn btn-ghost"
            onClick={() => {
              reiniciar();
              void limparDraft();
              toast("Campos da pré-admissão limpos");
            }}
            style={{ fontSize: 13, color: "var(--danger-forte)" }}
          >
            Limpar campos
          </button>
        }
      />
      <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4 }}>
        {passos.map((label, i) => {
          const isAtivo = d.step === i + 1;
          const isConcluido = d.step > i + 1;
          return (
            <div
              key={label}
              style={{
                flex: 1,
                minWidth: 200,
                padding: "10px 16px",
                fontSize: 14,
                fontFamily: "var(--font-body)",
                fontWeight: 700,
                letterSpacing: "0.02em",
                borderRadius: 14,
                display: "flex",
                alignItems: "center",
                gap: 10,
                transition: "all 0.2s ease",
                background: isAtivo 
                  ? "var(--color-accent)" 
                  : isConcluido 
                    ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" 
                    : "color-mix(in srgb, var(--color-text) 4%, transparent)",
                color: isAtivo 
                  ? "#fff" 
                  : isConcluido 
                    ? "var(--color-accent-700)" 
                    : "var(--color-neutral-500)",
                boxShadow: isAtivo ? "0 6px 20px color-mix(in srgb, var(--color-accent) 40%, transparent), inset 0 1px 1px rgb(255 255 255 / 0.2)" : "none",
                border: isAtivo ? "none" : `1px solid color-mix(in srgb, ${isConcluido ? 'var(--color-accent)' : 'var(--color-text)'} 10%, transparent)`
              }}
            >
              <div style={{
                width: 26, height: 26, borderRadius: "50%", display: "grid", placeItems: "center", fontSize: 13, flex: "none",
                background: isAtivo ? "rgba(255,255,255,0.25)" : isConcluido ? "var(--color-accent)" : "color-mix(in srgb, var(--color-text) 10%, transparent)",
                color: isConcluido ? "#fff" : "inherit"
              }}>
                {isConcluido ? "✓" : (i + 1)}
              </div>
              <span>{label.replace(/^\d\s*·\s*/, "")}</span>
            </div>
          );
        })}
      </div>

      {d.step === 1 && (
        <div className="card" style={{ gap: "var(--space-3)" }}>
          <span className="card-title">Importar do QuarkRH</span>
          <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
            <input
              className="input"
              style={{ maxWidth: 280, fontFamily: "var(--mono)" }}
              placeholder="CPF ou nome"
              value={d.busca}
              onChange={(e) => {
                const v = e.target.value;
                // se só tem dígitos (e pontuação de CPF), aplica a máscara sozinho
                const semPontuacao = v.replace(/[.\-\s]/g, "");
                upd({ busca: /^\d+$/.test(semPontuacao) && semPontuacao.length > 0 ? mascaraCpf(v) : v });
              }}
            />
            <button className="btn btn-primary" onClick={buscar} disabled={loading}>
              Buscar no QuarkRH
            </button>
            {!d.campos && !loading && (
              <button
                className="btn btn-ghost"
                onClick={() =>
                  upd({
                    campos: [
                      { k: "Nome completo", v: "", selo: false },
                      { k: "CPF", v: "", selo: false, mono: true },
                      { k: "Data de admissão", v: "", selo: false, mono: true },
                      { k: "Cargo", v: "", selo: false },
                      { k: "Departamento", v: "", selo: false },
                      { k: "Telefone", v: "", selo: false, mono: true },
                    ],
                  })
                }
              >
                Preencher manualmente
              </button>
            )}
          </div>
          {loading && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 12 }}>
              {[0, 0.15, 0.3, 0.45].map((delay, i) => (
                <div
                  key={i}
                  style={{
                    height: 52,
                    background: "var(--color-neutral-200)",
                    animation: `skel 1.1s infinite ${delay}s`,
                    borderRadius: 8,
                  }}
                />
              ))}
            </div>
          )}

          {opcoes && !loading && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              <span className="text-muted" style={{ fontSize: 12 }}>
                {opcoes.length} pessoas encontradas no QuarkRH — clique para usar os dados
              </span>
              <div style={{ maxHeight: 300, overflowY: "auto", display: "flex", flexDirection: "column", gap: 6 }}>
                {opcoes.map((o) => (
                  <button
                    key={o.quarkId}
                    onClick={() => {
                      upd({ campos: o.campos });
                      setOpcoes(null);
                    }}
                    style={{
                      textAlign: "left",
                      cursor: "pointer",
                      border: "1px solid var(--color-divider)",
                      background: "var(--color-bg)",
                      borderRadius: 8,
                      padding: "8px 12px",
                      color: "inherit",
                      fontFamily: "var(--font-body)",
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      flexWrap: "wrap",
                    }}
                  >
                    <span style={{ fontWeight: 600, fontSize: 14 }}>{o.nome}</span>
                    <span className="text-muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                      {o.cpf}
                    </span>
                    <span className="text-muted" style={{ fontSize: 12, flex: 1, minWidth: 120 }}>
                      {o.cargo} · {o.unidadeQuark}
                    </span>
                    {o.desligado && (
                      <span
                        style={{
                          fontSize: 10,
                          textTransform: "uppercase",
                          letterSpacing: "0.06em",
                          padding: "2px 8px",
                          borderRadius: 999,
                          background: "var(--color-neutral-300)",
                          color: "var(--color-neutral-800)",
                        }}
                      >
                        desligado
                      </span>
                    )}
                  </button>
                ))}
              </div>
            </div>
          )}
          {d.campos && !loading && (
            <>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))", gap: 12 }}>
                {d.campos.map((f, i) => {
                  const tipo: TipoMascara =
                    f.k === "CPF"
                      ? "cpf"
                      : f.k === "Telefone"
                        ? "telefone"
                        : f.k === "Data de admissão"
                          ? "data"
                          : "nenhuma";
                  return (
                    <div className="field" key={f.k}>
                      <label style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        {f.k}
                        {f.selo && (
                          <span
                            style={{
                              fontFamily: "var(--mono)",
                              fontSize: 9,
                              letterSpacing: "0.05em",
                              padding: "1px 6px",
                              border: "1px solid var(--color-accent-300)",
                              color: "var(--color-accent-700)",
                              background: "var(--color-accent-100)",
                            }}
                          >
                            QuarkRH
                          </span>
                        )}
                      </label>
                      <InputMascarado
                        tipo={tipo}
                        value={f.v}
                        onChange={(v) =>
                          upd({
                            campos: d.campos!.map((x, j) => (j === i ? { ...x, v } : x)),
                          })
                        }
                      />
                    </div>
                  );
                })}
              </div>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <div className="field" style={{ flex: 1, minWidth: 200 }}>
                  <label>Cidade</label>
                  <SelectCustom 
                    className="input" 
                    value={d.cidade} 
                    onChange={setCidade}
                    options={Object.keys(unidadesMap).sort((a, b) => a.localeCompare(b))}
                  />
                </div>
                <div className="field" style={{ flex: 1, minWidth: 200 }}>
                  <label>Unidade</label>
                  <SelectCustom 
                    className="input" 
                    value={d.unidade} 
                    onChange={setUnidade}
                    options={unidadesMap[d.cidade] ?? []}
                  />
                </div>
              </div>
              <div style={{ display: "flex", justifyContent: "flex-end" }}>
                <button className="btn btn-primary" onClick={() => upd({ step: 2, acc: d.acc ?? montarAcc(d.cargo) })}>
                  Continuar para acessos
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {d.step === 2 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--space-4)" }}>
          <div className="card" style={{ gap: "var(--space-3)" }}>
            <span className="card-title">Acessos do cargo</span>
            <div className="field">
              <label>Cargo</label>
              <SelectCustom
                className="input"
                value={d.cargo}
                onChange={(v) => upd({ cargo: v, acc: montarAcc(v) })}
                options={cargos}
              />
            </div>
            <span className="text-muted" style={{ fontSize: 12, fontFamily: "var(--mono)" }}>
              {marcados} de {totalDoCargo} acessos
            </span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {listaAcessos.map((a) => {
                const e = acc[a];
                if (!e) return null;
                return (
                  <div key={a} style={{ borderBottom: "1px solid var(--color-divider)", padding: "7px 0" }}>
                    <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, cursor: "pointer" }}>
                      <input
                        type="checkbox"
                        checked={e.on}
                        onChange={() => upd({ acc: { ...acc, [a]: { ...e, on: !e.on } } })}
                        style={{ accentColor: "var(--color-accent)", width: 15, height: 15 }}
                      />
                      <span style={{ flex: 1 }}>{a}</span>
                      {e.obrig && (
                        <span title="Obrigatório para o cargo" style={{ fontSize: 12, color: "var(--color-neutral-600)" }}>
                          🔒
                        </span>
                      )}
                    </label>
                    {e.obrig && !e.on && (
                      <input
                        className="input"
                        style={{ marginTop: 6, fontSize: 13, borderColor: "var(--warn)" }}
                        placeholder="Justificativa para remover acesso obrigatório"
                        value={e.just}
                        onChange={(ev) => upd({ acc: { ...acc, [a]: { ...e, just: ev.target.value } } })}
                      />
                    )}
                  </div>
                );
              })}
            </div>
          </div>
          <div className="card" style={{ gap: "var(--space-3)" }}>
            <span className="card-title">Grupos e observações</span>
            {grupoDaBase ? (
              <div
                style={{
                  fontSize: 12,
                  border: "1px solid var(--color-accent-300)",
                  background: "var(--color-accent-100)",
                  color: "var(--color-accent-700)",
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
              >
                Base <strong>{d.cidade} · {d.unidade}</strong> — grupo padrão já aplicado:{" "}
                <span style={{ fontFamily: "var(--mono)" }}>{grupoDaBase}</span>
              </div>
            ) : (
              <div
                style={{
                  fontSize: 12,
                  border: "1px solid var(--warn)",
                  background: "var(--warn-bg)",
                  color: "var(--warn-forte)",
                  borderRadius: 8,
                  padding: "8px 10px",
                }}
              >
                A unidade <strong>{d.cidade} · {d.unidade}</strong> ainda não tem grupo de e-mail definido — nenhum
                grupo foi aplicado automaticamente. Defina o grupo da unidade na tela Unidades ou escolha manualmente
                abaixo.
              </div>
            )}
            <div className="field" style={{ position: "relative" }}>
              <label>Grupos de e-mail</label>
              <button
                className="input"
                onClick={() => setGruposAberto((v) => !v)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  gap: 8,
                  cursor: "pointer",
                  textAlign: "left",
                  fontFamily: "var(--font-body)",
                }}
              >
                <span className={d.grupos.length ? "" : "text-muted"} style={{ fontSize: 14 }}>
                  {d.grupos.length
                    ? `${d.grupos.length} grupo(s) selecionado(s)`
                    : "Selecionar grupos"}
                </span>
                <span className="text-muted" style={{ fontSize: 11 }}>{gruposAberto ? "▲" : "▼"}</span>
              </button>
              {gruposAberto && (
                <div
                  className="elev-lg"
                  style={{
                    position: "absolute",
                    top: "calc(100% + 4px)",
                    left: 0,
                    right: 0,
                    zIndex: 30,
                    background: "var(--color-surface)",
                    border: "1px solid var(--color-divider)",
                    borderRadius: 10,
                    overflow: "hidden",
                  }}
                >
                  <input
                    className="input"
                    autoFocus
                    placeholder="Filtrar grupos..."
                    value={gruposBusca}
                    onChange={(e) => setGruposBusca(e.target.value)}
                    style={{ border: "none", borderBottom: "1px solid var(--color-divider)", borderRadius: 0, fontSize: 13 }}
                  />
                  {/* ~5 linhas visíveis; o resto por rolagem */}
                  <div style={{ maxHeight: 5 * 37, overflowY: "auto" }}>
                    {grupos
                      .slice()
                      .sort((a, b) => a.email.localeCompare(b.email))
                      .filter(
                        (g) =>
                          !gruposBusca ||
                          (g.nome + g.email).toLowerCase().includes(gruposBusca.toLowerCase())
                      )
                      .map((g) => {
                        const sel = d.grupos.includes(g.email);
                        return (
                          <label
                            key={g.email}
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: 10,
                              padding: "8px 12px",
                              cursor: "pointer",
                              fontSize: 13,
                              fontFamily: "var(--mono)",
                              borderBottom: "1px solid var(--color-divider)",
                              background: sel ? "var(--color-accent-100)" : "transparent",
                            }}
                          >
                            <input
                              type="checkbox"
                              checked={sel}
                              onChange={() =>
                                upd({
                                  grupos: sel
                                    ? d.grupos.filter((x) => x !== g.email)
                                    : [...d.grupos, g.email],
                                })
                              }
                              style={{ accentColor: "var(--color-accent)", width: 15, height: 15, flex: "none" }}
                            />
                            <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                              {g.email}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                  <div style={{ display: "flex", justifyContent: "flex-end", padding: 6 }}>
                    <button className="btn btn-ghost" style={{ fontSize: 12 }} onClick={() => setGruposAberto(false)}>
                      Fechar
                    </button>
                  </div>
                </div>
              )}
              {d.grupos.length > 0 && (
                <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 8 }}>
                  {d.grupos.map((email) => (
                    <span
                      key={email}
                      style={{
                        display: "inline-flex",
                        alignItems: "center",
                        gap: 6,
                        fontSize: 11,
                        fontFamily: "var(--mono)",
                        border: "1px solid var(--color-accent-300)",
                        background: "var(--color-accent-100)",
                        color: "var(--color-accent-700)",
                        borderRadius: 999,
                        padding: "2px 9px",
                      }}
                    >
                      {email}
                      <button
                        onClick={() => upd({ grupos: d.grupos.filter((x) => x !== email) })}
                        title="Remover"
                        style={{ background: "none", border: "none", cursor: "pointer", color: "inherit", padding: 0, lineHeight: 1 }}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                </div>
              )}
            </div>
            <div className="field">
              <label>Grupo específico · opcional</label>
              <InputMascarado
                tipo="email"
                style={{ fontSize: 13 }}
                placeholder="ex.: mecanicos@locgrupo.com.br"
                value={d.grupoLivre}
                onChange={(v) => upd({ grupoLivre: v })}
              />
              <span className="text-muted" style={{ fontSize: 11 }}>
                Se o grupo não existir no Workspace, avisamos ao avançar
              </span>
            </div>
            <div className="field">
              <label>Observação técnica para a TI</label>
              <textarea
                className="input"
                placeholder="ex.: precisa de acesso ao repositório de dados até o dia 1"
                value={d.obs}
                onChange={(e) => upd({ obs: e.target.value })}
              />
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto" }}>
              <button className="btn btn-secondary" onClick={() => upd({ step: 1 })}>
                Voltar
              </button>
              <button className="btn btn-primary" onClick={avancar3}>
                Continuar para o chamado
              </button>
            </div>
          </div>
          <div className="card" style={{ gap: "var(--space-2)" }}>
            <span className="card-title">Equipamentos</span>
            <span className="text-muted" style={{ fontSize: 12 }}>
              O que a TI deve separar para o primeiro dia
            </span>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {listaEquip.map((q) => (
                <label
                  key={q}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    fontSize: 14,
                    padding: "6px 0",
                    borderBottom: "1px solid var(--color-divider)",
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={!!d.equip[q]}
                    onChange={() => upd({ equip: { ...d.equip, [q]: !d.equip[q] } })}
                    style={{ accentColor: "var(--color-accent)", width: 15, height: 15 }}
                  />
                  <span>{q}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      )}

      {d.step === 3 && (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))", gap: "var(--space-4)" }}>
          <div 
            className="card" 
            style={{ 
              gap: "var(--space-3)",
              transform: pending ? "translateX(20%) scale(0.9)" : "none",
              opacity: pending ? 0 : 1,
              filter: pending ? "blur(4px)" : "none",
              transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)"
            }}
          >
            <span className="card-title">Analista responsável</span>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {analistas.map((an) => (
                <label 
                  key={an.nome} 
                  style={{
                    display: "flex", alignItems: "center", gap: 12, 
                    padding: "12px 16px",
                    borderRadius: 12,
                    cursor: "pointer",
                    border: d.analista === an.nome ? "1px solid var(--color-accent-600)" : "1px solid var(--color-divider)",
                    background: d.analista === an.nome ? "color-mix(in srgb, var(--color-accent) 12%, transparent)" : "var(--color-bg)",
                    transition: "all 0.2s ease"
                  }}
                >
                  <input
                    type="radio"
                    name="analista"
                    checked={d.analista === an.nome}
                    onChange={() => upd({ analista: an.nome })}
                    style={{ accentColor: "var(--color-accent)", width: 18, height: 18, margin: 0 }}
                  />
                  <div style={{ display: "flex", flexDirection: "column" }}>
                    <span style={{ fontWeight: d.analista === an.nome ? 600 : 400, color: d.analista === an.nome ? "var(--color-accent-700)" : "inherit" }}>
                      {an.nome}
                    </span>
                    <span className="text-muted" style={{ fontFamily: "var(--mono)", fontSize: 12 }}>
                      {an.fila} na fila
                    </span>
                  </div>
                </label>
              ))}
            </div>
            <div style={{ display: "flex", justifyContent: "space-between", marginTop: "auto" }}>
              <button className="btn btn-secondary" onClick={() => upd({ step: 2 })}>
                Voltar
              </button>
              <button className="btn btn-primary" onClick={abrir} disabled={pending}>
                {pending ? "Abrindo..." : "Abrir chamado"}
              </button>
            </div>
          </div>
          <div 
            className="blueprint" 
            style={{ 
              padding: "var(--space-4)", display: "flex", flexDirection: "column", gap: 10,
              transform: pending ? "translateX(-20%) scale(0.9)" : "none",
              opacity: pending ? 0 : 1,
              filter: pending ? "blur(4px)" : "none",
              transition: "all 0.5s cubic-bezier(0.4, 0, 0.2, 1)",
              transitionDelay: "0.05s"
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 4 }}>
              <h6 className="text-muted" style={{ margin: 0, textTransform: "uppercase", letterSpacing: "0.06em", fontSize: 11, fontWeight: 700 }}>
                Revisão · isto vira o chamado
              </h6>
            </div>
            
            <div style={{ padding: "16px", background: "color-mix(in srgb, var(--color-bg) 50%, transparent)", borderRadius: 12, border: "1px solid var(--color-divider)", display: "flex", flexDirection: "column", gap: 14 }}>
              <div>
                <div style={{ fontFamily: "var(--font-heading)", fontWeight: 700, fontSize: 19, color: campo("Nome completo") ? "var(--color-text)" : "var(--color-neutral-400)" }}>
                  {campo("Nome completo") || "Nome não informado"}
                </div>
                <div className="text-muted" style={{ fontSize: 13, marginTop: 4 }}>
                  {d.cargo} · {d.cidade} · {d.unidade} {campo("Data de admissão") ? `· admissão ${campo("Data de admissão")}` : ""}
                </div>
              </div>
              
              <div style={{ height: 1, background: "var(--color-divider)" }} />

              <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                <div style={{ display: "flex", gap: 12 }}>
                  <span className="text-muted" style={{ fontSize: 12, minWidth: 80, paddingTop: 1 }}>Acessos</span>
                  <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
                    {listaAcessos.filter((a) => acc[a]?.on).join(", ") || "Nenhum acesso marcado"}
                  </span>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span className="text-muted" style={{ fontSize: 12, minWidth: 80, paddingTop: 2 }}>Grupos</span>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    {d.grupos.length > 0 ? d.grupos.map(g => (
                      <span key={g} style={{ fontFamily: "var(--mono)", fontSize: 11, background: "var(--color-neutral-200)", color: "var(--color-neutral-800)", padding: "2px 8px", borderRadius: 6 }}>{g}</span>
                    )) : <span style={{ fontSize: 13, fontWeight: 500 }}>Nenhum grupo selecionado</span>}
                  </div>
                </div>
                <div style={{ display: "flex", gap: 12 }}>
                  <span className="text-muted" style={{ fontSize: 12, minWidth: 80, paddingTop: 1 }}>Equip.</span>
                  <span style={{ fontSize: 13, fontWeight: 500, lineHeight: 1.4 }}>
                    {equipSel.join(", ") || "Nenhum equipamento"}
                  </span>
                </div>
              </div>
              
              {d.obs.trim() && (
                <div style={{ 
                  fontSize: 13, 
                  borderLeft: "3px solid var(--color-accent)", 
                  padding: "10px 14px",
                  background: "color-mix(in srgb, var(--color-accent) 8%, transparent)",
                  borderRadius: "0 8px 8px 0",
                  marginTop: 2,
                  lineHeight: 1.5
                }}>
                  <strong style={{ display: "block", fontSize: 11, color: "var(--color-accent-700)", textTransform: "uppercase", letterSpacing: "0.04em", marginBottom: 4 }}>Observação da TI</strong>
                  {d.obs}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {d.step === 4 && (
        <div 
          className="card" 
          style={{ 
            gap: "var(--space-3)", 
            borderColor: "var(--ok)", 
            background: "var(--ok-bg)",
            animation: "splashSuccess 0.6s cubic-bezier(0.175, 0.885, 0.32, 1.275) both"
          }}
        >
          <span className="card-title" style={{ color: "var(--ok-forte)" }}>
            Chamado aberto
          </span>
          <div style={{ fontSize: 14 }}>
            Chamado{" "}
            <a
              href="#"
              onClick={(e) => {
                e.preventDefault();
                if (d.ticket) router.push(`/chamados/${d.ticket}`);
              }}
              style={{ fontFamily: "var(--mono)" }}
            >
              {d.ticket}
            </a>{" "}
            criado para {d.analista} · TI notificada
          </div>
          <div style={{ display: "flex", gap: 10 }}>
            <button className="btn btn-secondary" onClick={() => router.push("/dash")}>
              Voltar ao dashboard
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                reiniciar();
              }}
            >
              Nova pré-admissão
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
