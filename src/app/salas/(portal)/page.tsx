import { contaPortal } from "@/lib/escala/auth";
import { hojeSP } from "@/lib/escala/calendario";
import { agendaDoDia } from "@/lib/salas/servico";
import { GradeSalas } from "@/components/salas/GradeSalas";
import { EmPreparacao } from "@/components/salas/EmPreparacao";
import { cancelarSalaPortal, reservarSalaPortal } from "../actions";

export const dynamic = "force-dynamic";

export default async function AgendaSalasPage({ searchParams }: { searchParams: Promise<{ data?: string }> }) {
  const conta = (await contaPortal())!;
  const { data: q } = await searchParams;
  const data = q && /^\d{4}-\d{2}-\d{2}$/.test(q) ? q : hojeSP();
  const a = await agendaDoDia(data, conta.email);
  if (!a.instalado) return <EmPreparacao />;

  return (
    <>
      <div>
        <h1 style={{ fontSize: 24, margin: 0 }}>Agenda de salas</h1>
        <p className="text-muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
          Clique em um horário livre para agendar. Para cancelar, clique no seu agendamento.
        </p>
      </div>
      <GradeSalas
        data={data}
        hoje={a.hoje}
        agoraMin={a.agoraMin}
        config={a.config}
        salas={a.salas}
        reservas={a.reservas}
        reservar={reservarSalaPortal}
        cancelar={cancelarSalaPortal}
      />
    </>
  );
}
