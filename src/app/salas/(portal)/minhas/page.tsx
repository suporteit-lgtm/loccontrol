import { contaPortal } from "@/lib/escala/auth";
import { lerConfig, reservasDe } from "@/lib/salas/servico";
import { ListaReservas } from "@/components/salas/ListaReservas";
import { EmPreparacao } from "@/components/salas/EmPreparacao";
import { cancelarSalaPortal } from "../../actions";

export const dynamic = "force-dynamic";

export default async function MinhasSalasPage() {
  const conta = (await contaPortal())!;
  const [{ instalado }, itens] = await Promise.all([lerConfig(), reservasDe(conta.email)]);
  if (!instalado) return <EmPreparacao />;
  return (
    <div className="esc-estreito">
      <div>
        <h1 style={{ fontSize: 24, margin: 0 }}>Meus agendamentos</h1>
        <p className="text-muted" style={{ margin: "4px 0 0", fontSize: 14 }}>
          Suas próximas reservas de sala. Não vai usar? Cancele e libere o horário para outra pessoa.
        </p>
      </div>
      <ListaReservas itens={itens} cancelar={cancelarSalaPortal} hrefAgenda="/salas" vazio="Você não tem agendamentos de sala." />
    </div>
  );
}
