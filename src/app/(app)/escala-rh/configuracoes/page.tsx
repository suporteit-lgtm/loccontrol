import { db } from "@/lib/db";
import { contexto } from "@/lib/data";
import { googleConfigurado } from "@/lib/googleKey";
import { lerModos } from "@/lib/escala/envio";
import { TAREFAS } from "@/lib/escala/jobs";
import { unidadeDaEscala } from "@/lib/escala/rh";
import { ConfigEscalaClient } from "./ConfigEscalaClient";

export const dynamic = "force-dynamic";

export default async function ConfigEscalaPage() {
  const { usuario } = await contexto("rh");
  const [u, modos, { data: logs }, { data: emails }] = await Promise.all([
    unidadeDaEscala(),
    lerModos(),
    db().from("escala_log_job").select("*").order("inicio", { ascending: false }).limit(25),
    db().from("escala_email_enviado").select("chave, destinatario, tipo, status, modo, erro, criado_em").order("criado_em", { ascending: false }).limit(15),
  ]);
  return (
    <ConfigEscalaClient
      unidade={`${u.cidade} · ${u.unidade}`}
      config={u.config}
      grupos={u.grupos}
      modos={modos}
      superadmin={usuario.papel === "Superadmin"}
      admin={usuario.papel === "Superadmin" || usuario.papel.startsWith("Admin")}
      tarefas={TAREFAS}
      logs={logs ?? []}
      emails={emails ?? []}
      integracoes={{
        gmail: googleConfigurado(),
        cron: !!process.env.CRON_SECRET,
      }}
    />
  );
}
