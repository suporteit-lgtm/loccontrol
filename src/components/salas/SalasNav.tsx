"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const ABAS = [
  { href: "/salas", label: "Agenda" },
  { href: "/salas/minhas", label: "Meus agendamentos" },
];

export function SalasNav() {
  const path = usePathname();
  return (
    <nav className="esc-tabs" aria-label="Seções das salas">
      {ABAS.map((a) => (
        <Link key={a.href} href={a.href} aria-current={path === a.href ? "page" : undefined}>
          {a.label}
        </Link>
      ))}
    </nav>
  );
}
