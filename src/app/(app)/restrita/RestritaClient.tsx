"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { useToast } from "@/components/Toast";
import { concluirBloqueio, executarPasso, removerBloqueio } from "@/app/actions/restrita";
import type { PassoPanico } from "@/services/googleWorkspace";

interface Alvo {
  id: string;
  nome: string;
  bloqueado: { quando: string; por: string; motivo: string } | null;
}

type StPasso = "espera" | "run" | "ok" | "erro";

const PASSOS: { key: PassoPanico; l: string }[] = [
  { key: "senha", l: "Substituir a senha por uma sequência aleatória" },
  { key: "recuperacao", l: "Remover e-mail e telefone de recuperação" },
  { key: "sessoes", l: "Encerrar todas as sessões em todos os dispositivos" },
];

export function RestritaClient({
  ativos,
  alvoInicial,
  grupoTI,
}: {
  ativos: Alvo[];
  alvoInicial: string;
  grupoTI: boolean;
}) {
  const router = useRouter();
  const { toast } = useToast();
  const [alvoId, setAlvoId] = useState(alvoInicial);
  const [fase, setFase] = useState<"card" | "modal" | "exec" | "done">("card");
  const [motivo, setMotivo] = useState("");
  const [nome, setNome] = useState("");
  const [hold, setHold] = useState(0);
  const [passos, setPassos] = useState<StPasso[]>(["espera", "espera", "espera"]);
  const [quandoDone, setQuandoDone] = useState("");
  const [motivoDone, setMotivoDone] = useState("");
  const [dropdownAberto, setDropdownAberto] = useState(false);
  const [buscaColaborador, setBuscaColaborador] = useState("");
  const [, start2] = useTransition();
  const holdInt = useRef<ReturnType<typeof setInterval> | null>(null);
  const dRef = useRef<HTMLDivElement>(null);

  const alvo = ativos.find((a) => a.id === alvoId) ?? ativos[0];
  const ativosFiltrados = ativos.filter(a => a.nome.toLowerCase().includes(buscaColaborador.toLowerCase()));

  useEffect(
    () => {
      const clickFora = (e: MouseEvent) => {
        if (dRef.current && !dRef.current.contains(e.target as Node)) {
          setDropdownAberto(false);
        }
      };
      document.addEventListener("mousedown", clickFora);
      return () => {
        if (holdInt.current) clearInterval(holdInt.current);
        document.removeEventListener("mousedown", clickFora);
      };
    },
    []
  );

  if (!alvo) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%", maxWidth: 1000 }}>
        <div style={{ minWidth: 300 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
            <span style={{ 
              fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", 
              padding: "4px 10px", borderRadius: 999, 
              background: "color-mix(in srgb, var(--warn) 15%, transparent)", 
              color: "var(--warn)", border: "1px solid color-mix(in srgb, var(--warn) 30%, transparent)"
            }}>
              Área restrita · RH e TI
            </span>
          </div>
          <h1 style={{ margin: "0 0 16px 0", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>Ações de segurança</h1>
        </div>
        <div style={{ 
          display: "flex", flexDirection: "column", gap: 16, padding: 24, borderRadius: 16, 
          background: "color-mix(in srgb, var(--color-surface) 60%, transparent)", 
          border: "1px solid color-mix(in srgb, var(--color-text) 5%, transparent)", 
          boxShadow: "0 8px 32px color-mix(in srgb, #000 3%, transparent)", alignItems: "center"
        }}>
          <span style={{ fontSize: 14, color: "color-mix(in srgb, var(--color-text) 60%, transparent)" }}>
            Nenhum colaborador ativo para bloquear
          </span>
        </div>
      </div>
    );
  }

  const primeiroNome = alvo.nome.split(" ")[0];
  const motivoOk = motivo.trim().length >= 10;
  const nomeOk = nome.trim().toUpperCase() === alvo.nome.toUpperCase();
  const bloqueado = alvo.bloqueado;

  const rodarPasso = async (i: number, atuais: StPasso[]): Promise<void> => {
    const novos = [...atuais];
    novos[i] = "run";
    setPassos([...novos]);
    const r = await executarPasso(alvo.id, PASSOS[i].key);
    novos[i] = r.ok ? "ok" : "erro";
    setPassos([...novos]);
    if (r.ok) {
      if (i + 1 < PASSOS.length) {
        await rodarPasso(i + 1, novos);
      } else {
        await finalizar();
      }
    }
  };

  const finalizar = async () => {
    const res = await concluirBloqueio(alvo.id, motivo);
    if (res.ok) {
      setQuandoDone(res.quando);
      setMotivoDone(motivo);
      setFase("done");
      router.refresh();
    }
  };

  const retry = async (i: number) => {
    const atuais = [...passos];
    await rodarPasso(i, atuais);
  };

  const execPanico = () => {
    setFase("exec");
    setPassos(["espera", "espera", "espera"]);
    void rodarPasso(0, ["espera", "espera", "espera"]);
  };

  const holdIni = () => {
    if (holdInt.current) clearInterval(holdInt.current);
    holdInt.current = setInterval(() => {
      setHold((v) => {
        const novo = v + 5;
        if (novo >= 100) {
          if (holdInt.current) clearInterval(holdInt.current);
          holdInt.current = null;
          execPanico();
          return 0;
        }
        return novo;
      });
    }, 100);
  };

  const holdFim = () => {
    if (holdInt.current) {
      clearInterval(holdInt.current);
      holdInt.current = null;
    }
    if (fase === "modal") setHold(0);
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 24, width: "100%", maxWidth: 800 }}>
      <div style={{ minWidth: 300 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 12 }}>
          <span style={{ 
            fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", 
            padding: "4px 10px", borderRadius: 999, 
            background: "color-mix(in srgb, var(--danger) 15%, transparent)", 
            color: "var(--danger)", border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)"
          }}>
            Área restrita · RH e TI
          </span>
        </div>
        <h1 style={{ margin: "0 0 16px 0", fontSize: 32, fontWeight: 800, letterSpacing: "-0.02em", lineHeight: 1 }}>Ações de segurança</h1>
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 400, position: "relative" }} ref={dRef}>
        <label style={{ fontSize: 13, fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>Colaborador</label>
        
        <div 
          onClick={() => setDropdownAberto(!dropdownAberto)}
          style={{ 
            width: "100%", fontSize: 14, padding: "12px 16px", borderRadius: 12,
            background: "color-mix(in srgb, var(--color-surface) 60%, transparent)",
            border: `1px solid color-mix(in srgb, var(--color-text) ${dropdownAberto ? "30%" : "15%"}, transparent)`,
            color: "var(--color-text)", cursor: "pointer", transition: "all 0.2s",
            display: "flex", alignItems: "center", justifyContent: "space-between"
          }}
        >
          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {alvo.nome}
          </span>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ flex: "none", opacity: 0.5, transform: dropdownAberto ? "rotate(180deg)" : "none", transition: "transform 0.2s" }}>
            <polyline points="6 9 12 15 18 9"></polyline>
          </svg>
        </div>

        {dropdownAberto && (
          <div style={{
            position: "absolute", top: "100%", left: 0, right: 0, marginTop: 8, zIndex: 50,
            background: "var(--color-surface)", borderRadius: 16, border: "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)",
            boxShadow: "0 12px 48px rgba(0,0,0,0.5)", display: "flex", flexDirection: "column", overflow: "hidden"
          }}>
            <div style={{ padding: "12px 12px 8px 12px" }}>
              <input 
                autoFocus
                placeholder="Buscar colaborador..."
                value={buscaColaborador}
                onChange={(e) => setBuscaColaborador(e.target.value)}
                style={{
                  width: "100%", padding: "10px 14px", borderRadius: 10, fontSize: 13,
                  background: "color-mix(in srgb, var(--color-text) 5%, transparent)",
                  border: "1px solid color-mix(in srgb, var(--color-text) 10%, transparent)",
                  color: "var(--color-text)", outline: "none"
                }}
              />
            </div>
            <div style={{ maxHeight: 240, overflowY: "auto", padding: "0 8px 8px 8px", display: "flex", flexDirection: "column", gap: 2 }}>
              {ativosFiltrados.length === 0 ? (
                <div style={{ padding: "12px", fontSize: 13, color: "color-mix(in srgb, var(--color-text) 50%, transparent)", textAlign: "center" }}>
                  Nenhum colaborador encontrado
                </div>
              ) : (
                ativosFiltrados.map((o) => (
                  <div 
                    key={o.id}
                    onClick={() => {
                      setAlvoId(o.id);
                      setFase("card");
                      setMotivo("");
                      setNome("");
                      setHold(0);
                      setDropdownAberto(false);
                      setBuscaColaborador("");
                    }}
                    style={{
                      padding: "10px 12px", borderRadius: 8, fontSize: 13, cursor: "pointer",
                      background: alvo.id === o.id ? "color-mix(in srgb, var(--color-accent) 15%, transparent)" : "transparent",
                      color: alvo.id === o.id ? "var(--color-accent)" : "var(--color-text)",
                      fontWeight: alvo.id === o.id ? 600 : 400,
                      transition: "background 0.2s"
                    }}
                    onMouseEnter={(e) => { if (alvo.id !== o.id) e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 5%, transparent)"; }}
                    onMouseLeave={(e) => { if (alvo.id !== o.id) e.currentTarget.style.background = "transparent"; }}
                  >
                    {o.nome}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>

      {fase === "card" && !bloqueado && (
        <div
          style={{
            background: "color-mix(in srgb, var(--danger) 8%, transparent)",
            border: "1px solid color-mix(in srgb, var(--danger) 25%, transparent)",
            boxShadow: "0 8px 32px color-mix(in srgb, #000 4%, transparent)",
            borderRadius: 16,
            padding: 24,
            display: "flex",
            flexDirection: "column",
            gap: 16,
          }}
        >
          <h4 style={{ margin: 0, fontSize: 20, fontWeight: 800, letterSpacing: "-0.01em", color: "var(--danger)" }}>Bloqueio de emergência</h4>
          <div style={{ fontSize: 14, lineHeight: 1.6, color: "var(--color-text)" }}>
            Ao confirmar, estas três ações são executadas, nesta ordem:
            <ol style={{ margin: "16px 0", paddingLeft: 0, listStyle: "none", display: "flex", flexDirection: "column", gap: 12 }}>
              <li style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>1</span>
                Senha substituída por uma sequência aleatória
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>2</span>
                E-mail e telefone de recuperação removidos
              </li>
              <li style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <span style={{ width: 24, height: 24, borderRadius: "50%", background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 700 }}>3</span>
                Todas as sessões encerradas em todos os dispositivos
              </li>
            </ol>
            <strong>A conta e os dados não são apagados.</strong> A ação não é reversível por esta interface — o
            desbloqueio é feito no console do Workspace por um administrador.
          </div>
          <button
            style={{ 
              alignSelf: "flex-start", marginTop: 8,
              fontSize: 13, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
              padding: "12px 24px", borderRadius: 12, cursor: "pointer",
              background: "color-mix(in srgb, var(--danger) 15%, transparent)", color: "var(--danger)",
              border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)", transition: "all 0.2s ease"
            }}
            onMouseEnter={(e) => { e.currentTarget.style.filter = "brightness(1.2)"; }}
            onMouseLeave={(e) => { e.currentTarget.style.filter = "none"; }}
            onClick={() => {
              setFase("modal");
              setHold(0);
            }}
          >
            Bloquear acesso de {primeiroNome}
          </button>
        </div>
      )}

      {fase === "exec" && (
        <div style={{ 
          display: "flex", flexDirection: "column", gap: 16, padding: 24, borderRadius: 16, 
          background: "color-mix(in srgb, var(--color-surface) 60%, transparent)", 
          border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)", 
          boxShadow: "0 8px 32px color-mix(in srgb, #000 3%, transparent)"
        }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: "var(--danger)" }}>
            Executando bloqueio · {alvo.nome}
          </span>
          <div style={{ display: "flex", flexDirection: "column" }}>
            {PASSOS.map((p, i) => {
              const st = passos[i];
              return (
                <div
                  key={p.key}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    padding: "12px 0",
                    borderBottom: i === PASSOS.length - 1 ? "none" : "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
                    fontSize: 14,
                    color: st === "ok" ? "var(--color-text)" : "color-mix(in srgb, var(--color-text) 60%, transparent)"
                  }}
                >
                  {st === "run" && (
                    <span
                      style={{
                        width: 20, height: 20, flex: "none",
                        border: "2px solid color-mix(in srgb, var(--danger) 20%, transparent)",
                        borderTopColor: "var(--danger)",
                        borderRadius: "50%",
                        animation: "giro .8s linear infinite",
                      }}
                    />
                  )}
                  {st === "ok" && <span style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "color-mix(in srgb, var(--ok) 20%, transparent)", color: "var(--ok)", flex: "none", fontSize: 12, fontWeight: 800 }}>✓</span>}
                  {st === "erro" && <span style={{ width: 20, height: 20, display: "flex", alignItems: "center", justifyContent: "center", borderRadius: "50%", background: "color-mix(in srgb, var(--danger) 20%, transparent)", color: "var(--danger)", flex: "none", fontSize: 10, fontWeight: 800 }}>✕</span>}
                  {st === "espera" && <span style={{ width: 20, height: 20, flex: "none", display: "flex", alignItems: "center", justifyContent: "center", color: "color-mix(in srgb, var(--color-text) 30%, transparent)", fontSize: 18, lineHeight: 1 }}>·</span>}
                  <span style={{ flex: 1, fontWeight: st === "ok" ? 600 : 500 }}>{p.l}</span>
                  {st === "erro" && (
                    <button
                      onClick={() => void retry(i)}
                      style={{ 
                        fontSize: 11, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                        padding: "6px 12px", borderRadius: 8, cursor: "pointer",
                        background: "color-mix(in srgb, var(--color-text) 10%, transparent)", color: "var(--color-text)",
                        border: "none", transition: "all 0.2s ease"
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 15%, transparent)"; }}
                      onMouseLeave={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 10%, transparent)"; }}
                    >
                      Tentar novamente
                    </button>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {(fase === "done" || (fase === "card" && bloqueado)) && (
        <div
          style={{
            border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
            background: "color-mix(in srgb, var(--danger) 10%, transparent)",
            padding: 24,
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--color-text)",
            borderRadius: 16,
            boxShadow: "0 8px 32px color-mix(in srgb, #000 3%, transparent)"
          }}
        >
          <strong style={{ color: "var(--danger)", fontSize: 16 }}>Acesso bloqueado</strong>
          <div style={{ marginTop: 8 }}>
            Bloqueado em <strong>{quandoDone || bloqueado?.quando}</strong> por <strong>{fase === "done" ? "Você" : bloqueado?.por}</strong>.<br />
            Motivo: <em>{motivoDone || bloqueado?.motivo}</em>.<br />
            <span style={{ opacity: 0.7, fontSize: 13 }}>Esta faixa fica registrada no perfil.</span>
          </div>
          <div style={{ marginTop: 16, display: "flex", gap: 12, flexWrap: "wrap" }}>
            <button 
              style={{ 
                fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                padding: "10px 20px", borderRadius: 12, cursor: "pointer",
                background: "color-mix(in srgb, var(--color-text) 10%, transparent)", color: "var(--color-text)",
                border: "none", transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 15%, transparent)"; }}
              onMouseLeave={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 10%, transparent)"; }}
              onClick={() => router.push(`/colaboradores/${alvo.id}`)}
            >
              Ver perfil
            </button>
            {grupoTI && (
              <button
                title="Remove o bloqueio do perfil no sistema (caso a pessoa volte à empresa). A conta Google continua como está — reative-a no console do Workspace."
                style={{ 
                  fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                  padding: "10px 20px", borderRadius: 12, cursor: "pointer",
                  background: "color-mix(in srgb, var(--color-text) 10%, transparent)", color: "var(--color-text)",
                  border: "none", transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 15%, transparent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 10%, transparent)"; }}
                onClick={() =>
                  start2(async () => {
                    const res = await removerBloqueio(alvo.id);
                    toast(res.msg);
                    if (res.ok) {
                      setFase("card");
                      setQuandoDone("");
                      setMotivoDone("");
                      router.refresh();
                    }
                  })
                }
              >
                Remover bloqueio do perfil
              </button>
            )}
          </div>
        </div>
      )}

      {fase === "modal" && (
        <div style={{ position: "fixed", top: 0, left: 0, right: 0, bottom: 0, background: "rgba(0,0,0,0.6)", backdropFilter: "blur(4px)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100, padding: 24 }}>
          <div style={{ 
            background: "var(--color-surface)", width: "100%", maxWidth: 480, borderRadius: 24, padding: 32,
            boxShadow: "0 24px 64px rgba(0,0,0,0.4)", border: "1px solid color-mix(in srgb, var(--danger) 30%, transparent)",
            display: "flex", flexDirection: "column", gap: 24
          }}>
            <h3 style={{ fontSize: 24, fontWeight: 800, margin: 0, letterSpacing: "-0.02em", color: "var(--danger)" }}>
              Bloquear acesso de {alvo.nome}
            </h3>
            <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>Motivo · mínimo 10 caracteres</label>
                <input
                  className="input-no-outline"
                  style={{ 
                    width: "100%", fontSize: 14, padding: "12px 16px", borderRadius: 12,
                    background: "color-mix(in srgb, var(--color-text) 5%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-text) 15%, transparent)",
                    outline: "none", color: "var(--color-text)", transition: "border 0.2s"
                  }}
                  placeholder="ex.: notebook furtado com sessão aberta"
                  value={motivo}
                  onChange={(e) => setMotivo(e.target.value)}
                />
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                <label style={{ fontSize: 13, fontWeight: 600, color: "color-mix(in srgb, var(--color-text) 70%, transparent)" }}>Digite {alvo.nome.toUpperCase()} para confirmar</label>
                <input
                  className="input-no-outline"
                  style={{ 
                    width: "100%", fontSize: 14, padding: "12px 16px", borderRadius: 12, fontFamily: "var(--mono)",
                    background: "color-mix(in srgb, var(--color-text) 5%, transparent)",
                    border: "1px solid color-mix(in srgb, var(--color-text) 15%, transparent)",
                    outline: "none", color: "var(--color-text)", transition: "border 0.2s"
                  }}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                />
              </div>
              <span style={{ fontSize: 13, color: "color-mix(in srgb, var(--color-text) 50%, transparent)", lineHeight: 1.5, background: "color-mix(in srgb, var(--color-text) 5%, transparent)", padding: "10px 16px", borderRadius: 12 }}>
                Com os dois campos corretos, pressione e segure o botão por 2 segundos.
              </span>
            </div>
            <div style={{ display: "flex", gap: 12, alignItems: "center", justifyContent: "flex-end", marginTop: 8 }}>
              <button
                style={{ 
                  fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                  padding: "12px 24px", borderRadius: 12, cursor: "pointer",
                  background: "transparent", color: "var(--color-text)",
                  border: "none", transition: "all 0.2s ease"
                }}
                onMouseEnter={(e) => { e.currentTarget.style.background = "color-mix(in srgb, var(--color-text) 8%, transparent)"; }}
                onMouseLeave={(e) => { e.currentTarget.style.background = "transparent"; }}
                onClick={() => {
                  setFase("card");
                  setHold(0);
                }}
              >
                Cancelar
              </button>
              <button
                onMouseDown={holdIni}
                onMouseUp={holdFim}
                onTouchStart={holdIni}
                onTouchEnd={holdFim}
                disabled={!(motivoOk && nomeOk)}
                style={{ 
                  display: "flex", alignItems: "center", gap: 10, userSelect: "none",
                  fontSize: 12, fontWeight: 700, letterSpacing: "0.04em", textTransform: "uppercase",
                  padding: "12px 24px", borderRadius: 12, cursor: !(motivoOk && nomeOk) ? "not-allowed" : "pointer",
                  background: "var(--danger)", color: "#fff",
                  border: "none", transition: "all 0.2s ease",
                  opacity: !(motivoOk && nomeOk) ? 0.4 : 1
                }}
                onMouseEnter={(e) => { if (motivoOk && nomeOk) e.currentTarget.style.filter = "brightness(1.1)"; }}
                onMouseLeave={(e) => { holdFim(); e.currentTarget.style.filter = "none"; }}
              >
                <span
                  style={{
                    width: 18,
                    height: 18,
                    flex: "none",
                    borderRadius: "50%",
                    background: `conic-gradient(#fff ${Math.round(hold * 3.6)}deg, rgba(255,255,255,.25) 0deg)`,
                  }}
                />
                Segurar para bloquear
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

