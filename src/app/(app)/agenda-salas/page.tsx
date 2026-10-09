import { redirect } from "next/navigation";
import { usuarioAtual, ehAdmin } from "@/lib/session";
import { hojeSP } from "@/lib/escala/calendario";
import { agendaDoDia } from "@/lib/salas/servico";
import { PageHeader } from "@/components/ui";
import { GradeSalas } from "@/components/salas/GradeSalas";
import { cancelarSalaRH, reservarSalaRH } from "@/app/actions/salas";

export const dynamic = "force-dynamic";

export default async function AgendaSalasRHPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  const { data: q } = await searchParams;
  const data = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : hojeSP();
  const a = await agendaDoDia(data, u.email);
  const gestor = ehAdmin(u.papel);

  return (
    <>
      <PageHeader
        titulo="Agenda de salas"
        eyebrow="Salas"
        sub={
          gestor
            ? "Todas as salas do dia. Clique em um horário livre para agendar (para você ou para outra pessoa) ou em um agendamento para cancelar."
            : "Todas as salas do dia. Clique em um horário livre para agendar."
        }
      />
      <GradeSalas
        data={data}
        hoje={a.hoje}
        agoraMin={a.agoraMin}
        config={a.config}
        salas={a.salas}
        reservas={a.reservas}
        gestor={gestor}
        reservar={reservarSalaRH}
        cancelar={cancelarSalaRH}
      />
    </>
  );
}
