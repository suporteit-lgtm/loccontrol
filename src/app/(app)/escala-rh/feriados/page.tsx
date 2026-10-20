import { db } from "@/lib/db";
import { hojeSP } from "@/lib/escala/calendario";
import { unidadeDaEscala } from "@/lib/escala/rh";
import { FeriadosClient } from "./FeriadosClient";

export const dynamic = "force-dynamic";

export default async function FeriadosPage({ searchParams }: { searchParams: Promise<{ ano?: string }> }) {
  const u = await unidadeDaEscala();
  const anoAtual = Number(hojeSP().slice(0, 4));
  const ano = Number((await searchParams).ano) || anoAtual;
  const [{ data: feriados }, { data: ultimo }] = await Promise.all([
    db()
      .from("escala_feriado")
      .select("id, data, nome, origem, sem_expediente, unidade_id, criado_por")
      .or(`unidade_id.is.null,unidade_id.eq.${u.config.unidade_id}`)
      .gte("data", `${ano}-01-01`)
      .lte("data", `${ano}-12-31`)
      .order("data"),
    db().from("escala_log_job").select("inicio, status, itens, erro").eq("tarefa", "feriados").order("inicio", { ascending: false }).limit(1).maybeSingle(),
  ]);
  return (
    <FeriadosClient
      unidade={`${u.cidade} · ${u.unidade}`}
      ano={ano}
      anos={[anoAtual - 1, anoAtual, anoAtual + 1]}
      feriados={(feriados ?? []) as FeriadoLinha[]}
      ultimaImportacao={ultimo ?? null}
    />
  );
}

export interface FeriadoLinha {
  id: string;
  data: string;
  nome: string;
  origem: "NACIONAL_API" | "MANUAL";
  sem_expediente: boolean;
  unidade_id: string | null;
  criado_por: string | null;
}
