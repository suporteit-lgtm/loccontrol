import { db } from "@/lib/db";
import { hojeSP, somarDias } from "@/lib/escala/calendario";
import { unidadeDaEscala } from "@/lib/escala/rh";
import { CalendarioRHClient, type DiaRH } from "./CalendarioRHClient";

export const dynamic = "force-dynamic";

function ultimoDia(ano: number, mes: number): string {
  return new Date(Date.UTC(ano, mes, 0)).toISOString().slice(0, 10);
}

export default async function CalendarioRHPage({ searchParams }: { searchParams: Promise<{ mes?: string }> }) {
  const u = await unidadeDaEscala();
  const unidade = u.config.unidade_id;
  const hoje = hojeSP();
  const { mes } = await searchParams;
  const ref = /^\d{4}-\d{2}$/.test(mes ?? "") ? mes! : hoje.slice(0, 7);
  const [ano, m] = ref.split("-").map(Number);
  const de = `${ref}-01`;
  const ate = ultimoDia(ano, m);

  const [{ data: dias }, { data: feriados }, { data: fila }] = await Promise.all([
    db().from("escala_v_dia").select("data, grupo, capacidade, escalados, afastados, ausencias, reservas, presentes")
      .eq("unidade_id", unidade).gte("data", de).lte("data", ate),
    db().from("escala_feriado").select("data, nome").or(`unidade_id.is.null,unidade_id.eq.${unidade}`).gte("data", de).lte("data", ate),
    db().from("escala_fila").select("data").eq("unidade_id", unidade).gte("data", de).lte("data", ate).in("status", ["AGUARDANDO", "OFERECIDA"]),
  ]);
  const porDia = new Map((dias ?? []).map((d) => [d.data as string, d]));
  const fer = new Map((feriados ?? []).map((f) => [f.data as string, f.nome as string]));
  const filaN = new Map<string, number>();
  for (const f of fila ?? []) filaN.set(f.data, (filaN.get(f.data) ?? 0) + 1);

  const lista: DiaRH[] = [];
  for (let d = de; d <= ate; d = somarDias(d, 1)) {
    const v = porDia.get(d);
    lista.push({
      data: d,
      util: !!v,
      grupo: (v?.grupo as "A" | "B" | null) ?? null,
      feriado: fer.get(d) ?? null,
      capacidade: Number(v?.capacidade ?? u.config.capacidade),
      escalados: Number(v?.escalados ?? 0),
      afastados: Number(v?.afastados ?? 0),
      ausencias: Number(v?.ausencias ?? 0),
      reservas: Number(v?.reservas ?? 0),
      presentes: Number(v?.presentes ?? 0),
      fila: filaN.get(d) ?? 0,
      passado: d < hoje,
      hoje: d === hoje,
    });
  }
  return <CalendarioRHClient unidade={`${u.cidade} · ${u.unidade}`} refMes={ref} dias={lista} />;
}
