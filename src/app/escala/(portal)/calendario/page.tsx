import { redirect } from "next/navigation";

/** Endereço antigo: o calendário agora é a tela principal do portal. */
export default async function CalendarioAntigo({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const { mes } = await searchParams;
  redirect(mes ? `/escala?mes=${encodeURIComponent(mes)}` : "/escala");
}
