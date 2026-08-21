"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/lib/db";
import { exigirRH } from "@/lib/perms";
import { auditar } from "@/lib/audit";

export async function alternarMatriz(cargo: string, acesso: string, ligado: boolean) {
  const u = await exigirRH();
  const [{ data: cg }, { data: ac }] = await Promise.all([
    db().from("cargos").select("id").eq("nome", cargo).maybeSingle(),
    db().from("acessos").select("id").eq("nome", acesso).maybeSingle(),
  ]);
  if (!cg || !ac) return { ok: false, msg: "Cargo ou acesso não encontrado" };
  const { data: cel } = await db()
    .from("matriz")
    .select("obrigatorio")
    .eq("cargo_id", cg.id)
    .eq("acesso_id", ac.id)
    .maybeSingle();
  if (cel?.obrigatorio) return { ok: false, msg: "Acesso obrigatório não pode ser desligado na matriz" };

  await db().from("matriz").upsert({ cargo_id: cg.id, acesso_id: ac.id, ligado, obrigatorio: false });
  await auditar({
    ator: u.nome,
    tabela: "matriz",
    campo: `${cargo} × ${acesso}`,
    antes: ligado ? "desligado" : "ligado",
    depois: ligado ? "ligado" : "desligado",
  });
  revalidatePath("/matriz");
  return { ok: true, msg: "Matriz atualizada" };
}

export async function renomearCargo(atual: string, novo: string) {
  const u = await exigirRH();
  const v = novo.trim();
  if (!v) return { ok: false, msg: "Informe o novo nome" };
  const { data: cg } = await db().from("cargos").select("id").eq("nome", atual).maybeSingle();
  if (!cg) return { ok: false, msg: "Cargo não encontrado" };
  const { data: existe } = await db().from("cargos").select("id").eq("nome", v).maybeSingle();
  if (existe) return { ok: false, msg: "Já existe um cargo com esse nome" };

  await db().from("cargos").update({ nome: v }).eq("id", cg.id);
  // colaboradores guardam o cargo por texto — acompanha o rename
  await db().from("colaboradores").update({ cargo: v }).eq("cargo", atual);
  await auditar({ ator: u.nome, tabela: "matriz", campo: "cargo", antes: atual, depois: v });
  revalidatePath("/matriz");
  revalidatePath("/colaboradores");
  return { ok: true, msg: `Cargo renomeado para ${v}` };
}

export async function excluirCargo(nome: string) {
  const u = await exigirRH();
  const { data: cg } = await db().from("cargos").select("id").eq("nome", nome).maybeSingle();
  if (!cg) return { ok: false, msg: "Cargo não encontrado" };
  const { count } = await db()
    .from("colaboradores")
    .select("id", { count: "exact", head: true })
    .eq("cargo", nome);
  if (count && count > 0)
    return { ok: false, msg: `${count} colaborador(es) ainda têm este cargo — troque o cargo deles antes de excluir` };

  await db().from("cargos").delete().eq("id", cg.id); // matriz cai em cascata
  await auditar({ ator: u.nome, tabela: "matriz", campo: nome, antes: "cargo ativo", depois: "excluído" });
  revalidatePath("/matriz");
  return { ok: true, msg: `Cargo ${nome} excluído` };
}

export async function adicionarAcesso(nome: string) {
  const u = await exigirRH();
  const v = nome.trim();
  if (!v) return { ok: false, msg: "Informe o nome do acesso" };
  const { data: existe } = await db().from("acessos").select("id").eq("nome", v).maybeSingle();
  if (existe) return { ok: false, msg: "Este acesso já existe" };

  const { data: max } = await db().from("acessos").select("ordem").order("ordem", { ascending: false }).limit(1);
  const { data: novo, error } = await db()
    .from("acessos")
    .insert({ nome: v, ordem: (max?.[0]?.ordem ?? 0) + 1 })
    .select("id")
    .single();
  if (error || !novo) return { ok: false, msg: "Erro ao criar acesso" };

  const { data: cargos } = await db().from("cargos").select("id");
  await db()
    .from("matriz")
    .insert((cargos ?? []).map((c) => ({ cargo_id: c.id, acesso_id: novo.id, ligado: false, obrigatorio: false })));

  await auditar({ ator: u.nome, tabela: "matriz", campo: v, depois: "acesso criado" });
  revalidatePath("/matriz");
  return { ok: true, msg: `Acesso ${v} adicionado à matriz` };
}

export async function renomearAcesso(atual: string, novo: string) {
  const u = await exigirRH();
  const v = novo.trim();
  if (!v) return { ok: false, msg: "Informe o novo nome" };
  const { data: ac } = await db().from("acessos").select("id").eq("nome", atual).maybeSingle();
  if (!ac) return { ok: false, msg: "Acesso não encontrado" };
  const { data: existe } = await db().from("acessos").select("id").eq("nome", v).maybeSingle();
  if (existe) return { ok: false, msg: "Já existe um acesso com esse nome" };

  await db().from("acessos").update({ nome: v }).eq("id", ac.id);
  await auditar({ ator: u.nome, tabela: "matriz", campo: "acesso", antes: atual, depois: v });
  revalidatePath("/matriz");
  return { ok: true, msg: `Acesso renomeado para ${v}` };
}

export async function excluirAcesso(nome: string) {
  const u = await exigirRH();
  if (nome === "E-mail corporativo")
    return { ok: false, msg: "O E-mail corporativo é a base das contas — não pode ser excluído" };
  const { data: ac } = await db().from("acessos").select("id").eq("nome", nome).maybeSingle();
  if (!ac) return { ok: false, msg: "Acesso não encontrado" };
  await db().from("acessos").delete().eq("id", ac.id); // matriz cai em cascata
  await auditar({ ator: u.nome, tabela: "matriz", campo: nome, antes: "acesso ativo", depois: "excluído" });
  revalidatePath("/matriz");
  return { ok: true, msg: `Acesso ${nome} excluído` };
}

/** Marca/desmarca o acesso como obrigatório para o cargo (🔒). */
export async function alternarObrigatorio(cargo: string, acesso: string) {
  const u = await exigirRH();
  const [{ data: cg }, { data: ac }] = await Promise.all([
    db().from("cargos").select("id").eq("nome", cargo).maybeSingle(),
    db().from("acessos").select("id").eq("nome", acesso).maybeSingle(),
  ]);
  if (!cg || !ac) return { ok: false, msg: "Cargo ou acesso não encontrado" };
  const { data: cel } = await db()
    .from("matriz")
    .select("obrigatorio")
    .eq("cargo_id", cg.id)
    .eq("acesso_id", ac.id)
    .maybeSingle();
  const novo = !cel?.obrigatorio;
  // obrigatório implica ligado
  await db()
    .from("matriz")
    .upsert(
      { cargo_id: cg.id, acesso_id: ac.id, obrigatorio: novo, ...(novo ? { ligado: true } : {}) },
      { onConflict: "cargo_id,acesso_id" }
    );
  await auditar({
    ator: u.nome,
    tabela: "matriz",
    campo: `${cargo} × ${acesso}`,
    antes: novo ? "opcional" : "obrigatório",
    depois: novo ? "obrigatório" : "opcional",
  });
  revalidatePath("/matriz");
  return { ok: true, msg: novo ? `${acesso} agora é obrigatório para ${cargo}` : `${acesso} deixou de ser obrigatório` };
}

export async function adicionarCargo(nome: string) {
  const u = await exigirRH();
  const v = nome.trim();
  if (!v) return { ok: false, msg: "Informe o nome do cargo" };
  const { data: existe } = await db().from("cargos").select("id").eq("nome", v).maybeSingle();
  if (existe) return { ok: false, msg: "Este cargo já existe" };

  const { data: novo, error } = await db().from("cargos").insert({ nome: v }).select("id").single();
  if (error || !novo) return { ok: false, msg: "Erro ao criar cargo" };

  const { data: acessos } = await db().from("acessos").select("id, nome");
  await db()
    .from("matriz")
    .insert(
      (acessos ?? []).map((a) => ({
        cargo_id: novo.id,
        acesso_id: a.id,
        ligado: a.nome === "E-mail corporativo",
        obrigatorio: a.nome === "E-mail corporativo",
      }))
    );

  await auditar({ ator: u.nome, tabela: "matriz", campo: v, depois: "cargo criado" });
  revalidatePath("/matriz");
  return { ok: true, msg: `Cargo ${v} adicionado à matriz` };
}
