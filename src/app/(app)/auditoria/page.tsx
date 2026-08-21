import { db } from "@/lib/db";
import { contexto } from "@/lib/data";
import { AuditoriaClient } from "./AuditoriaClient";
import type { Auditoria } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AuditoriaPage() {
  await contexto();
  const { data } = await db().from("auditoria").select("*").order("quando", { ascending: false }).limit(500);
  return <AuditoriaClient linhas={(data ?? []) as Auditoria[]} />;
}
