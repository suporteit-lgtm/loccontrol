import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { escalaHabilitada } from "@/lib/escala/auth";

export const metadata: Metadata = {
  title: "Salas de reunião · Locagora",
  description: "Agende uma sala de reunião",
};

/** Portal de salas: mesmo login Google da Escala (@locgrupo.com.br), layout próprio. */
export default function SalasRaizLayout({ children }: { children: React.ReactNode }) {
  if (!escalaHabilitada()) notFound(); // o login Google do portal depende do mesmo módulo
  return children;
}
