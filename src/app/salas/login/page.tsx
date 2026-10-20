import { redirect } from "next/navigation";

/** O portal tem um só login (Escala e Salas): manda para ele, voltando às salas depois. */
export default async function SalasLoginPage({ searchParams }: { searchParams: Promise<{ erro?: string }> }) {
  const { erro } = await searchParams;
  redirect(`/escala/login?volta=salas${erro ? `&erro=${encodeURIComponent(erro)}` : ""}`);
}
