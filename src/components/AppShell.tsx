"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Icone } from "./Icone";
import { useTema } from "./ThemeToggle";
import { mudarUnidade, sair } from "@/app/actions/sessao";
import type { Papel, UnidadesMap } from "@/lib/types";

const TODAS = "Todas as unidades";
const TODAS_CIDADES = "Todas as cidades";

interface NavItem {
  label: string;
  rota: string;
  icone: string;
}

const NAV_RH: NavItem[] = [
  { label: "Dashboard", rota: "/dash", icone: "dash" },
  { label: "Fila do RH", rota: "/fila-rh", icone: "filarh" },
  { label: "Colaboradores", rota: "/colaboradores", icone: "colabs" },
  { label: "Nova pré-admissão", rota: "/pre-admissao", icone: "wizard" },
  { label: "Matriz de acessos", rota: "/matriz", icone: "matriz" },
];
const NAV_TI: NavItem[] = [
  { label: "Dashboard TI", rota: "/dash-ti", icone: "dashti" },
  { label: "Fila da TI", rota: "/fila-ti", icone: "fila" },
  { label: "Usuários", rota: "/usuarios", icone: "usuarios" },
  { label: "Unidades", rota: "/unidades", icone: "unidades" },
];
const NAV_GERAL: NavItem[] = [
  { label: "Grupos do Workspace", rota: "/grupos", icone: "membros" },
  { label: "Área restrita", rota: "/restrita", icone: "restrita" },
  { label: "Log de auditoria", rota: "/auditoria", icone: "auditoria" },
  { label: "Configurações", rota: "/configuracoes", icone: "config" },
];

export interface ShellProps {
  usuario: { nome: string; email: string; papel: Papel };
  unidadesMap: UnidadesMap;
  filtro: { cidade: string; unidade: string };
  /** false = usuário restrito a unidades específicas (sem "Todas as unidades") */
  temTodas: boolean;
  children: React.ReactNode;
}

export function AppShell({ usuario, unidadesMap, filtro, temTodas, children }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { escuro, alternar } = useTema();
  const [isMobile, setIsMobile] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [navMin, setNavMin] = useState(false);
  const [, start] = useTransition();

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 820px)");
    const on = () => setIsMobile(mq.matches);
    mq.addEventListener("change", on);
    on();
    try {
      setNavMin(localStorage.getItem("lc-nav-min") === "1");
    } catch {}
    return () => mq.removeEventListener("change", on);
  }, []);

  useEffect(() => setMenuOpen(false), [pathname]);

  const ehAdmin = usuario.papel === "Superadmin" || usuario.papel.startsWith("Admin");
  const veRH = ehAdmin || usuario.papel === "Usuário RH";
  const veTI = ehAdmin || usuario.papel === "Usuário T.I";

  const cidades = Object.keys(unidadesMap).sort((a, b) => a.localeCompare(b));
  // quem não é restrito pode ver o grupo inteiro de uma vez
  const opcoesCidade = temTodas ? [TODAS_CIDADES, ...cidades] : cidades;
  const todasAsBases = filtro.cidade === TODAS_CIDADES;
  const minhasUnidades = todasAsBases
    ? [TODAS]
    : temTodas
      ? [TODAS, ...(unidadesMap[filtro.cidade] ?? [])]
      : unidadesMap[filtro.cidade] ?? [];

  const iniciais = usuario.nome
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const setCidade = (cidade: string) =>
    start(async () => {
      const unidade =
        cidade === TODAS_CIDADES ? TODAS : temTodas ? TODAS : unidadesMap[cidade]?.[0] ?? TODAS;
      await mudarUnidade(cidade, unidade);
      router.refresh();
    });
  const setUnidade = (unidade: string) =>
    start(async () => {
      await mudarUnidade(filtro.cidade, unidade);
      router.refresh();
    });

  const ativo = (rota: string) =>
    pathname === rota ||
    (rota === "/colaboradores" && pathname.startsWith("/colaboradores/")) ||
    (rota === "/fila-ti" && (pathname.startsWith("/chamados/") || pathname.startsWith("/offboarding/")));

  const linkNav = (n: NavItem) => {
    const sel = ativo(n.rota);
    return (
      <Link
        key={n.rota}
        href={n.rota}
        title={n.label}
        className={sel ? "" : "nav-item"}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          padding: "8px 10px",
          fontSize: 13.5,
          fontWeight: 600,
          textDecoration: "none",
          borderRadius: 8,
          color: sel ? "var(--color-accent-700)" : "inherit",
          // sem background inline no item não-selecionado: inline vence o CSS
          // e mataria o :hover definido em .nav-item
          ...(sel ? { background: "var(--color-accent-100)" } : {}),
        }}
      >
        <Icone nome={n.icone} />
        {!navMin && (
          <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.label}</span>
        )}
      </Link>
    );
  };

  const bloco = (titulo: string, itens: NavItem[]) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
      {!navMin && <h6 className="text-muted" style={{ margin: "0 0 4px" }}>{titulo}</h6>}
      {itens.map(linkNav)}
    </div>
  );

  const seletorUnidade = (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      <span
        className="text-muted"
        style={{ fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" }}
      >
        Minha unidade
      </span>
      <select
        className="input"
        style={{ fontSize: 12, padding: "4px 6px", minHeight: 30 }}
        value={filtro.cidade}
        onChange={(e) => setCidade(e.target.value)}
      >
        {opcoesCidade.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <select
        className="input"
        style={{ fontSize: 12, padding: "4px 6px", minHeight: 30 }}
        value={filtro.unidade}
        onChange={(e) => setUnidade(e.target.value)}
      >
        {minhasUnidades.map((u) => (
          <option key={u} value={u}>
            {u}
          </option>
        ))}
      </select>
    </div>
  );

  const navTodos = [...(veRH ? NAV_RH : []), ...(veTI ? NAV_TI : []), ...NAV_GERAL];

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "stretch" }}>
      {!isMobile && (
        <aside
          style={{
            width: navMin ? 64 : 248,
            flex: "none",
            position: "sticky",
            top: 0,
            height: "100vh",
            overflow: "hidden",
            background: "var(--nav-bg, var(--color-surface))",
            borderRight: "1px solid var(--color-divider)",
            padding: navMin ? "12px 8px" : "var(--space-4)",
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-4)",
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 6,
              flexWrap: "wrap",
              padding: "4px 2px 2px",
            }}
          >
            {!navMin ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 7, minWidth: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src="/logo.png" alt="Locagora" data-logo="1" style={{ width: 130 }} />
                <span
                  style={{
                    fontFamily: "var(--font-heading)",
                    fontWeight: 800,
                    fontSize: 13,
                    letterSpacing: "0.16em",
                    color: "var(--color-accent-700)",
                  }}
                >
                  LOCCONTROL
                </span>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src="/favicon.png" alt="LOCCONTROL" style={{ width: 28, height: 28, borderRadius: 6 }} />
            )}
            <button
              className="btn btn-ghost btn-icon"
              onClick={() => {
                const v = !navMin;
                setNavMin(v);
                try {
                  localStorage.setItem("lc-nav-min", v ? "1" : "0");
                } catch {}
              }}
              aria-label="Minimizar menu"
              title="Minimizar ou expandir o menu"
              style={{ width: 26, height: 26, fontSize: 15, color: "var(--color-neutral-600)" }}
            >
              {navMin ? "»" : "«"}
            </button>
          </div>
          {!navMin && seletorUnidade}
          <div
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: "var(--space-4)",
            }}
          >
            {veRH && bloco("RH", NAV_RH)}
            {veTI && bloco("TI", NAV_TI)}
            {bloco("Geral", NAV_GERAL)}
          </div>
          <div
            style={{
              marginTop: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 10,
              paddingTop: "var(--space-3)",
              borderTop: "1px solid var(--color-divider)",
            }}
          >
            <button
              className="btn btn-ghost"
              onClick={alternar}
              style={{ justifyContent: "flex-start", gap: 10, fontSize: 13, padding: "4px 6px" }}
            >
              <Icone nome={escuro ? "sol" : "lua"} />
              {!navMin && <span>{escuro ? "Modo claro" : "Modo escuro"}</span>}
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => start(() => sair())}
              title="Sair da conta"
              style={{
                justifyContent: "flex-start",
                gap: 10,
                fontSize: 13,
                padding: "4px 6px",
                color: "var(--danger-forte)",
              }}
            >
              <Icone nome="sair" />
              {!navMin && <span>Sair da conta</span>}
            </button>
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  width: 30,
                  height: 30,
                  flex: "none",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "50%",
                  background: "var(--color-accent-100)",
                  color: "var(--color-accent-700)",
                  border: "1px solid var(--color-accent-300)",
                  fontFamily: "var(--font-heading)",
                  fontWeight: 600,
                  fontSize: 12,
                }}
              >
                {iniciais}
              </span>
              {!navMin && (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 600 }}>{usuario.nome}</div>
                  <div className="text-muted" style={{ fontSize: 11 }}>
                    {usuario.papel}
                  </div>
                  <div className="text-muted" style={{ fontSize: 11, fontFamily: "var(--mono)" }}>
                    {usuario.email}
                  </div>
                </div>
              )}
            </div>
          </div>
        </aside>
      )}

      <div style={{ flex: 1, minWidth: 0, display: "flex", flexDirection: "column" }}>
        {isMobile && (
          <>
            <div
              style={{
                position: "sticky",
                top: 0,
                zIndex: 30,
                display: "flex",
                alignItems: "center",
                gap: 12,
                padding: "10px 16px",
                borderBottom: "1px solid var(--color-divider)",
                background: "var(--color-surface)",
              }}
            >
              <button className="btn btn-secondary btn-icon" onClick={() => setMenuOpen((v) => !v)} aria-label="Menu">
                ≡
              </button>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/logo.png" alt="Locagora" data-logo="1" style={{ height: 24 }} />
              <span
                style={{
                  fontFamily: "var(--font-body)",
                  fontWeight: 800,
                  fontSize: 11,
                  letterSpacing: "0.14em",
                  color: "var(--color-accent-700)",
                }}
              >
                LOCCONTROL
              </span>
              <button
                className="btn btn-secondary btn-icon"
                onClick={alternar}
                style={{ marginLeft: "auto" }}
                aria-label="Alternar tema"
              >
                <Icone nome={escuro ? "sol" : "lua"} />
              </button>
            </div>
            {menuOpen && (
              /* gaveta lateral: mesma organização por setores da sidebar do desktop */
              <div className="drawer-backdrop" onClick={() => setMenuOpen(false)}>
                <nav className="drawer" onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <select
                      className="input"
                      style={{ flex: 1, fontSize: 13 }}
                      value={filtro.cidade}
                      onChange={(e) => setCidade(e.target.value)}
                    >
                      {opcoesCidade.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <select
                      className="input"
                      style={{ flex: 1, fontSize: 13 }}
                      value={filtro.unidade}
                      onChange={(e) => setUnidade(e.target.value)}
                    >
                      {minhasUnidades.map((u) => (
                        <option key={u} value={u}>
                          {u}
                        </option>
                      ))}
                    </select>
                  </div>
                  {([
                    ["RH", veRH ? NAV_RH : []],
                    ["TI", veTI ? NAV_TI : []],
                    ["Geral", NAV_GERAL],
                  ] as const).map(([titulo, itens]) =>
                    itens.length === 0 ? null : (
                      <div key={titulo} style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                        <h6 className="text-muted" style={{ margin: "0 0 4px" }}>
                          {titulo}
                        </h6>
                        {itens.map((n) => {
                          const sel = ativo(n.rota);
                          return (
                            <Link
                              key={n.rota}
                              href={n.rota}
                              onClick={() => setMenuOpen(false)}
                              className={sel ? "" : "nav-item"}
                              style={{
                                display: "flex",
                                alignItems: "center",
                                gap: 12,
                                padding: "11px 12px",
                                fontSize: 14.5,
                                fontWeight: 600,
                                textDecoration: "none",
                                borderRadius: 10,
                                color: sel ? "var(--color-accent-700)" : "inherit",
                                ...(sel ? { background: "var(--color-accent-100)" } : {}),
                              }}
                            >
                              <Icone nome={n.icone} />
                              {n.label}
                            </Link>
                          );
                        })}
                      </div>
                    )
                  )}
                  <button
                    className="btn btn-secondary"
                    onClick={() => start(() => sair())}
                    style={{ gap: 8, color: "var(--danger-forte)", marginTop: "auto" }}
                  >
                    <Icone nome="sair" />
                    Sair da conta
                  </button>
                </nav>
              </div>
            )}
          </>
        )}

        <main
          className="app-main"
          style={{
            flex: 1,
            display: "flex",
            flexDirection: "column",
            gap: "var(--space-6)",
            maxWidth: 1240,
            width: "100%",
            margin: "0 auto",
            boxSizing: "border-box",
          }}
        >
          {children}
        </main>
      </div>
    </div>
  );
}
