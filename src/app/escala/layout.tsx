import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { escalaHabilitada } from "@/lib/escala/auth";

export const metadata: Metadata = {
  title: "Escala de Presença · Locagora",
  description: "Seus dias no escritório, reservas e lista de espera",
};

/** Portal do colaborador: layout próprio, sem o menu e sem links do LocControl. */
export default function EscalaRaizLayout({ children }: { children: React.ReactNode }) {
  if (!escalaHabilitada()) notFound(); // feature flag
  return children;
}
