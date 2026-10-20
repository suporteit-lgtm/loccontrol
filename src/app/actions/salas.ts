"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirAdmin, exigirSessao } from "@/lib/perms";
import { ehAdmin } from "@/lib/session";
import { auditar } from "@/lib/audit";
import { escalaHabilitada } from "@/lib/escala/auth";
import { cancelarReserva, criarReserva, type Ator, type Resultado } from "@/lib/salas/servico";
import { minutos } from "@/lib/salas/regras";

/** LocControl: qualquer usuário interno agenda; administradores gerenciam salas e reservas de todos. */
async function ator(): Promise<Ator> {
  if (!escalaHabilitada()) throw new Error("Módulo de salas desligado.");
  const u = await exigirSessao();
  return { email: u.email, nome: u.nome, gestor: ehAdmin(u.papel) };
}

function atualizar() {
  revalidatePath("/agenda-salas", "layout");
  revalidatePath("/salas", "layout");
}

export async function reservarSalaRH(p: {
  salaId: string;
  data: string;
  ini: string;
  fim: string;
  titulo?: string;
  paraEmail?: string;
}): Promise<Resultado> {
  const a = await ator();
  const r = await criarReserva(a, p);
  if (r.ok) {
    atualizar();
    if (p.paraEmail && p.paraEmail.trim().toLowerCase() !== a.email.toLowerCase())
      await auditar({ pessoa: p.paraEmail.trim().toLowerCase(), ator: a.email, tabela: "Salas", campo: "Agendamento para outra pessoa", depois: `${p.data} ${p.ini}–${p.fim}` });
  }
  return r;
}

export async function cancelarSalaRH(id: string): Promise<Resultado> {
  const a = await ator();
  const { data: antes } = await db().from("sala_reserva").select("email, inicio").eq("id", id).maybeSingle();
  const r = await cancelarReserva(a, id);
  if (r.ok) {
    atualizar();
    if (antes && antes.email !== a.email.toLowerCase())
      await auditar({ pessoa: antes.email, ator: a.email, tabela: "Salas", campo: "Agendamento cancelado pelo administrador", antes: antes.inicio });
  }
  return r;
}

// ── Cadastro de salas e regras (administradores) ──────────────────────────────

export interface SalaForm {
  id?: string;
  nome: string;
  descricao: string;
  capacidade: number;
  local: string;
  recursos: string;
  ativo: boolean;
  ordem: number;
}

export async function salvarSala(f: SalaForm): Promise<Resultado> {
  const u = await exigirAdmin();
  const nome = f.nome.trim();
  if (!nome) return { ok: false, erro: "Dê um nome à sala." };
  const capacidade = Math.round(Number(f.capacidade));
  if (!(capacidade >= 1 && capacidade <= 200)) return { ok: false, erro: "Capacidade entre 1 e 200 pessoas." };
  const linha = {
    nome: nome.slice(0, 60),
    descricao: f.descricao.trim() || null,
    capacidade,
    local: f.local.trim() || null,
    recursos: f.recursos.split(",").map((s) => s.trim()).filter(Boolean).slice(0, 12),
    ativo: f.ativo,
    ordem: Math.round(Number(f.ordem) || 0),
  };
  const { error } = f.id
    ? await db().from("sala").update(linha).eq("id", f.id)
    : await db().from("sala").insert(linha);
  if (error) return { ok: false, erro: "Não foi possível salvar: " + error.message };
  await auditar({ ator: u.email, tabela: "Salas", campo: f.id ? "Sala alterada" : "Sala criada", depois: linha.nome });
  atualizar();
  return { ok: true };
}

/** Exclui a sala se nunca foi usada; se tem histórico, apenas desativa. */
export async function excluirSala(id: string): Promise<Resultado & { desativada?: boolean }> {
  const u = await exigirAdmin();
  const { data: s } = await db().from("sala").select("nome").eq("id", id).maybeSingle();
  if (!s) return { ok: false, erro: "Sala não encontrada." };
  const { data: futuras } = await db()
    .from("sala_reserva").select("id").eq("sala_id", id).eq("status", "ATIVA").gt("fim", new Date().toISOString()).limit(1);
  if (futuras?.length) return { ok: false, erro: "Essa sala tem agendamentos futuros. Cancele-os antes ou apenas desative a sala." };
  const { error } = await db().from("sala").delete().eq("id", id);
  if (error) {
    // tem histórico (FK): mantém para os relatórios e só tira da agenda
    await db().from("sala").update({ ativo: false }).eq("id", id);
    await auditar({ ator: u.email, tabela: "Salas", campo: "Sala desativada", antes: s.nome });
    atualizar();
    return { ok: true, desativada: true };
  }
  await auditar({ ator: u.email, tabela: "Salas", campo: "Sala excluída", antes: s.nome });
  atualizar();
  return { ok: true };
}

export async function salvarConfigSalas(c: {
  hora_inicio: string;
  hora_fim: string;
  intervalo_min: number;
  dias_antecedencia: number;
  duracao_max_min: number;
  fim_de_semana: boolean;
}): Promise<Resultado> {
  const u = await exigirAdmin();
  if (!/^\d{2}:\d{2}$/.test(c.hora_inicio) || !/^\d{2}:\d{2}$/.test(c.hora_fim)) return { ok: false, erro: "Horário inválido." };
  if (minutos(c.hora_fim) <= minutos(c.hora_inicio)) return { ok: false, erro: "O fim do expediente precisa ser depois do início." };
  if (![15, 30, 60].includes(c.intervalo_min)) return { ok: false, erro: "Intervalo inválido." };
  if ((minutos(c.hora_fim) - minutos(c.hora_inicio)) % c.intervalo_min)
    return { ok: false, erro: `O expediente precisa caber em blocos de ${c.intervalo_min} minutos.` };
  if (!(c.dias_antecedencia >= 1 && c.dias_antecedencia <= 365)) return { ok: false, erro: "Antecedência entre 1 e 365 dias." };
  if (!(c.duracao_max_min >= 15 && c.duracao_max_min <= 720)) return { ok: false, erro: "Duração máxima entre 15 minutos e 12 horas." };
  const { error } = await db().from("sala_config").upsert({ id: true, ...c });
  if (error) return { ok: false, erro: "Não foi possível salvar: " + error.message };
  await auditar({ ator: u.email, tabela: "Salas", campo: "Regras das salas", depois: `${c.hora_inicio}–${c.hora_fim}, ${c.intervalo_min} min, até ${c.dias_antecedencia} dias, máx. ${c.duracao_max_min} min` });
  atualizar();
  return { ok: true };
}
