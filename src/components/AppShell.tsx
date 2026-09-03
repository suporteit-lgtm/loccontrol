"use client";

import { useEffect, useState, useTransition } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { Icone } from "./Icone";
import { useTema } from "./ThemeToggle";
import { SidebarExtrasProvider, useSidebarExtras } from "./SidebarExtras";
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
  { label: "Central de ajuda", rota: "/ajuda", icone: "ajuda" },
  { label: "Configurações", rota: "/configuracoes", icone: "config" },
];

import { SelectCustom } from "./SelectCustom";

export interface ShellProps {
  usuario: { nome: string; email: string; papel: Papel };
  /** já filtrado pelas unidades de acesso do usuário (mapaPermitido) */
  unidadesMap: UnidadesMap;
  filtro: { cidade: string; unidade: string };
  children: React.ReactNode;
}

export function AppShell(props: ShellProps) {
  return (
    <SidebarExtrasProvider>
      <AppShellBody {...props} />
    </SidebarExtrasProvider>
  );
}

function AppShellBody({ usuario, unidadesMap, filtro, children }: ShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { escuro } = useTema();
  const { extras } = useSidebarExtras();
  // item do menu com os extras abertos (clicar de novo fecha) — começa
  // escondido, só aparece depois de clicar em cima do item
  const [expandido, setExpandido] = useState<string | null>(null);
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
  // "Todas as ..." aparece para todos: quem é restrito enxerga o conjunto
  // das bases DELE (o servidor corta pelo acesso), não o grupo inteiro
  const opcoesCidade = [TODAS_CIDADES, ...cidades];
  const todasAsBases = filtro.cidade === TODAS_CIDADES;
  const minhasUnidades = todasAsBases ? [TODAS] : [TODAS, ...(unidadesMap[filtro.cidade] ?? [])];

  const iniciais = usuario.nome
    .trim()
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const setCidade = (cidade: string) =>
    start(async () => {
      await mudarUnidade(cidade, TODAS);
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
    // controles que a própria página registrou (usePaginaExtrasNoMenu) —
    // ficam escondidos até clicar em cima do item (clicar de novo esconde)
    const comExtras = sel && !navMin && extras?.rota === n.rota && expandido === n.rota;
    return (
      <div key={n.rota}>
        <Link
          href={n.rota}
          title={n.label}
          className={sel ? "" : "nav-item"}
          onClick={(e) => {
            // já tá nessa página — não renavega (o Next remontaria a página
            // no meio do clique), só alterna o painel de extras
            if (sel) e.preventDefault();
            setExpandido((atual) => (atual === n.rota ? null : n.rota));
          }}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 12,
            padding: "10px 12px",
            fontSize: 13.5,
            fontWeight: sel ? 700 : 600,
            textDecoration: "none",
            borderRadius: 8,
            color: sel ? "var(--color-accent)" : "inherit",
            // sem background inline no item não-selecionado: inline vence o CSS
            // e mataria o :hover definido em .nav-item
            ...(sel
              ? {
                  background: "color-mix(in srgb, var(--color-accent) 12%, transparent)",
                  // barra de acento à esquerda — inset não mexe no layout, só marca o item ativo
                  boxShadow: "inset 3px 0 0 var(--color-accent)",
                }
              : {}),
          }}
        >
          <Icone nome={n.icone} />
          {!navMin && (
            <span style={{ whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{n.label}</span>
          )}
          {sel && !navMin && extras?.rota === n.rota && (
            <span
              style={{
                marginLeft: "auto",
                flex: "none",
                display: "grid",
                placeItems: "center",
                transform: `rotate(${expandido === n.rota ? 0 : -90}deg)`,
                transition: "transform 0.15s ease",
                opacity: 0.7,
              }}
            >
              <Icone nome="chevron" tamanho={14} />
            </span>
          )}
        </Link>
        {comExtras && (
          <div
            style={{
              display: "flex",
              flexDirection: "column",
              gap: 8,
              margin: "6px 0 4px 0",
              padding: "10px",
              borderRadius: 10,
              background: "color-mix(in srgb, var(--color-accent) 6%, var(--color-bg))",
              border: "1px solid color-mix(in srgb, var(--color-accent) 16%, transparent)",
              boxShadow: "inset 2px 0 0 color-mix(in srgb, var(--color-accent) 35%, transparent)",
              animation: "entrada 0.16s ease both",
            }}
          >
            {extras!.node}
          </div>
        )}
      </div>
    );
  };

  const bloco = (titulo: string, itens: NavItem[]) => (
    <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
      {!navMin && (
        <h6
          className="text-muted"
          style={{
            margin: "4px 0 8px 12px",
            fontSize: 11,
            fontWeight: 800,
            textTransform: "uppercase",
            letterSpacing: "0.06em",
            opacity: 0.7,
          }}
        >
          {titulo}
        </h6>
      )}
      {itens.map(linkNav)}
    </div>
  );

  const seletorUnidade = (
    <div style={{ display: "flex", flexDirection: "column", gap: 6, padding: "0 4px" }}>
      <span
        className="text-muted"
        style={{
          fontSize: 11,
          fontWeight: 800,
          letterSpacing: "0.06em",
          textTransform: "uppercase",
          opacity: 0.7,
          marginLeft: 8,
        }}
      >
        Minha unidade
      </span>
      <SelectCustom
        className="input"
        style={{
          fontSize: 13,
          padding: "6px 12px",
          minHeight: 36,
          borderRadius: 8,
          background: "color-mix(in srgb, var(--color-text) 4%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
        }}
        value={filtro.cidade}
        options={opcoesCidade}
        onChange={setCidade}
      />
      <SelectCustom
        className="input"
        style={{
          fontSize: 13,
          padding: "6px 12px",
          minHeight: 36,
          borderRadius: 8,
          background: "color-mix(in srgb, var(--color-text) 4%, transparent)",
          border: "1px solid color-mix(in srgb, var(--color-text) 8%, transparent)",
        }}
        value={filtro.unidade}
        options={minhasUnidades}
        onChange={setUnidade}
      />
    </div>
  );

  const navTodos = [...(veRH ? NAV_RH : []), ...(veTI ? NAV_TI : []), ...NAV_GERAL];

  return (
    <div style={{ display: "flex", minHeight: "100vh", alignItems: "stretch" }}>
      {!isMobile && (
        <aside
          style={{
            width: navMin ? 72 : 264,
            flex: "none",
            position: "sticky",
            top: 0,
            height: "100vh",
            overflow: "hidden",
            background: "var(--nav-bg, var(--color-surface))",
            borderRight: "1px solid var(--color-divider)",
            boxShadow: "2px 0 12px color-mix(in srgb, #000 4%, transparent)",
            padding: navMin ? "16px 8px" : "20px 16px",
            display: "flex",
            flexDirection: "column",
            gap: 24,
          }}
        >
          <div
            style={{
              display: "flex",
              alignItems: "flex-start",
              justifyContent: "space-between",
              gap: 8,
              flexWrap: "wrap",
              padding: "0 4px",
            }}
          >
            {!navMin ? (
              <div style={{ display: "flex", flexDirection: "column", gap: 10, minWidth: 0 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/logo.png" alt="Locagora" data-logo="1" style={{ width: 140 }} />
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ width: 1, height: 16, background: "var(--color-divider)" }} />
                  <span
                    style={{
                      fontFamily: "var(--font-heading)",
                      fontWeight: 800,
                      fontSize: 12,
                      letterSpacing: "0.18em",
                      color: "var(--color-accent)",
                      opacity: 0.9,
                    }}
                  >
                    LOCCONTROL
                  </span>
                </div>
              </div>
            ) : (
              /* eslint-disable-next-line @next/next/no-img-element */
              <img src="/favicon.png" alt="LOCCONTROL" style={{ width: 32, height: 32, borderRadius: 8, margin: "0 auto" }} />
            )}
            <button
              onClick={() => {
                const v = !navMin;
                setNavMin(v);
                try {
                  localStorage.setItem("lc-nav-min", v ? "1" : "0");
                } catch {}
              }}
              aria-label="Minimizar menu"
              title="Minimizar ou expandir o menu"
              style={{ 
                width: 32, height: 32, 
                color: "var(--color-text)", 
                marginTop: navMin ? 16 : 0, 
                alignSelf: navMin ? "center" : "flex-start",
                background: "var(--color-bg)",
                border: "1px solid var(--color-divider)",
                borderRadius: "50%",
                boxShadow: "var(--shadow-sm)",
                transition: "all 0.2s ease",
                display: "grid", placeItems: "center",
                cursor: "pointer"
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "scale(1.05)";
                e.currentTarget.style.background = "color-mix(in srgb, var(--color-accent) 10%, var(--color-bg))";
                e.currentTarget.style.color = "var(--color-accent)";
                e.currentTarget.style.borderColor = "var(--color-accent)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "scale(1)";
                e.currentTarget.style.background = "var(--color-bg)";
                e.currentTarget.style.color = "var(--color-text)";
                e.currentTarget.style.borderColor = "var(--color-divider)";
              }}
            >
              <Icone nome={navMin ? "sidebar-expand" : "sidebar-collapse"} tamanho={18} />
            </button>
          </div>

          {!navMin && seletorUnidade}
          
          <div
            className="hide-scrollbar"
            style={{
              flex: 1,
              minHeight: 0,
              overflowY: "auto",
              display: "flex",
              flexDirection: "column",
              gap: 24,
              padding: "4px 0",
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
              gap: 8,
              paddingTop: 16,
              borderTop: "1px solid var(--color-divider)",
            }}
          >

            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: 10,
                padding: navMin ? 0 : "10px 12px",
                marginTop: 4,
                borderRadius: 12,
                background: navMin ? "transparent" : "color-mix(in srgb, var(--color-text) 3%, transparent)",
                border: navMin ? "none" : "1px solid color-mix(in srgb, var(--color-text) 5%, transparent)",
              }}
            >
              <span
                style={{
                  width: 32,
                  height: 32,
                  flex: "none",
                  display: "grid",
                  placeItems: "center",
                  borderRadius: "50%",
                  background: "color-mix(in srgb, var(--color-accent) 15%, transparent)",
                  color: "var(--color-accent)",
                  fontWeight: 700,
                  fontSize: 12,
                }}
              >
                {iniciais}
              </span>
              {!navMin && (
                <div style={{ minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700, color: "var(--color-text)", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                    {usuario.nome}
                  </div>
                  <div className="text-muted" style={{ fontSize: 11, marginTop: 2 }}>
                    {usuario.papel}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => start(() => sair())}
              title="Sair da conta"
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: navMin ? "center" : "flex-start",
                gap: 12,
                fontSize: 13,
                fontWeight: 600,
                padding: navMin ? "10px" : "10px 16px",
                marginTop: 8,
                borderRadius: 12,
                color: "var(--danger)",
                background: "color-mix(in srgb, var(--danger) 8%, transparent)",
                border: "1px solid color-mix(in srgb, var(--danger) 10%, transparent)",
                width: "100%",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
              onMouseEnter={(e) => { 
                e.currentTarget.style.background = "color-mix(in srgb, var(--danger) 15%, transparent)";
                e.currentTarget.style.transform = "scale(0.98)";
              }}
              onMouseLeave={(e) => { 
                e.currentTarget.style.background = "color-mix(in srgb, var(--danger) 8%, transparent)";
                e.currentTarget.style.transform = "scale(1)";
              }}
            >
              <Icone nome="sair" />
              {!navMin && <span>Sair da conta</span>}
            </button>
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

            </div>
            {menuOpen && (
              /* gaveta lateral: mesma organização por setores da sidebar do desktop */
              <div className="drawer-backdrop" onClick={() => setMenuOpen(false)}>
                <nav className="drawer" onClick={(e) => e.stopPropagation()}>
                  <div style={{ display: "flex", gap: 6 }}>
                    <SelectCustom
                      className="input"
                      style={{ flex: 1, fontSize: 13, minHeight: 42, padding: "8px 12px", borderRadius: 8 }}
                      value={filtro.cidade}
                      options={opcoesCidade}
                      onChange={setCidade}
                    />
                    <SelectCustom
                      className="input"
                      style={{ flex: 1, fontSize: 13, minHeight: 42, padding: "8px 12px", borderRadius: 8 }}
                      value={filtro.unidade}
                      options={minhasUnidades}
                      onChange={setUnidade}
                    />
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
