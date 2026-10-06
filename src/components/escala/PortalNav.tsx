"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/escala", label: "Calendário" },
  { href: "/escala/meus-dias", label: "Meus dias" },
  { href: "/escala/reservas", label: "Meus agendamentos" },
  { href: "/escala/preferencias", label: "Preferências" },
];

export function PortalNav() {
  const path = usePathname();
  return (
    <nav className="esc-tabs" aria-label="Seções da escala">
      {ABAS.map((a) => (
        <Link key={a.href} href={a.href} aria-current={path === a.href ? "page" : undefined}>
          {a.label}
        </Link>
      ))}
    </nav>
  );
}
