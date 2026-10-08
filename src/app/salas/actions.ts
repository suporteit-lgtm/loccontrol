"use server";

import { revalidatePath } from "next/cache";
import { contaPortal } from "@/lib/escala/auth";
import { cancelarReserva, criarReserva, type Ator, type Resultado } from "@/lib/salas/servico";

/** Portal /salas: a pessoa logada com o Google agenda e cancela só o que é dela. */
async function ator(): Promise<Ator | null> {
  const c = await contaPortal();
  return c ? { email: c.email, nome: c.nome, gestor: false } : null;
}

function atualizar() {
  revalidatePath("/salas", "layout");
  revalidatePath("/agenda-salas", "layout");
}

export async function reservarSalaPortal(p: { salaId: string; data: string; ini: string; fim: string; titulo?: string }): Promise<Resultado> {
  const a = await ator();
  if (!a) return { ok: false, erro: "Sua sessão expirou. Entre de novo." };
  const r = await criarReserva(a, p);
  if (r.ok) atualizar();
  return r;
}

export async function cancelarSalaPortal(id: string): Promise<Resultado> {
  const a = await ator();
  if (!a) return { ok: false, erro: "Sua sessão expirou. Entre de novo." };
  const r = await cancelarReserva(a, id);
  if (r.ok) atualizar();
  return r;
}
