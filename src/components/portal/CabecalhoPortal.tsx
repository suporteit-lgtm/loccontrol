import Link from "next/link";
import { AvatarCircle } from "@/components/ui";
import { ThemeToggleButton } from "@/components/ThemeToggle";

const MODULOS = [
  { id: "escala", href: "/escala", label: "Escala" },
  { id: "salas", href: "/salas", label: "Salas" },
] as const;

/** Cabeçalho do portal (login Google): logo, troca entre Escala e Salas, tema e Sair. */
export function CabecalhoPortal({ nome, modulo }: { nome: string; modulo: "escala" | "salas" }) {
  return (
    <header
      style={{
        position: "sticky",
        top: 0,
        zIndex: 10,
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        gap: 12,
        padding: "12px 16px",
        background: "var(--color-surface)",
        borderBottom: "1px solid var(--color-divider)",
      }}
    >
      <div style={{ display: "flex", alignItems: "center", gap: 12, minWidth: 0 }}>
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/logo.png" alt="Locagora" data-logo="1" style={{ width: 96 }} />
        <div style={{ width: 1, height: 20, background: "var(--color-divider)" }} />
        <nav className="portal-modulos" aria-label="Módulos">
          {MODULOS.map((m) => (
            <Link key={m.id} href={m.href} aria-current={m.id === modulo ? "page" : undefined}>
              {m.label}
            </Link>
          ))}
        </nav>
      </div>
      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <ThemeToggleButton />
        <AvatarCircle nome={nome} tamanho={30} />
        <form action="/escala/auth/sair" method="post">
          <button className="btn btn-secondary" style={{ height: 32, fontSize: 13 }}>
            Sair
          </button>
        </form>
      </div>
    </header>
  );
}
