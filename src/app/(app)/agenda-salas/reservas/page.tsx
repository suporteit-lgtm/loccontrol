import { redirect } from "next/navigation";
import { usuarioAtual, ehAdmin } from "@/lib/session";
import { hojeSP, somarDias } from "@/lib/escala/calendario";
import { buscarReservas, listarSalas, reservasDe } from "@/lib/salas/servico";
import { PageHeader } from "@/components/ui";
import { ListaReservas } from "@/components/salas/ListaReservas";
import { cancelarSalaRH } from "@/app/actions/salas";

export const dynamic = "force-dynamic";

const ISO = /^\d{4}-\d{2}-\d{2}$/;

export default async function ReservasSalasPage({
  searchParams,
}: {
  searchParams: Promise<{ de?: string; ate?: string; sala?: string; pessoa?: string }>;
}) {
  const u = await usuarioAtual();
  if (!u) redirect("/login");
  const gestor = ehAdmin(u.papel);

  if (!gestor) {
    const itens = await reservasDe(u.email);
    return (
      <>
        <PageHeader eyebrow="Salas" titulo="Meus agendamentos" sub="Suas próximas reservas de sala." />
        <div className="esc-estreito" style={{ margin: 0 }}>
          <ListaReservas itens={itens} cancelar={cancelarSalaRH} hrefAgenda="/agenda-salas" vazio="Você não tem agendamentos de sala." />
        </div>
      </>
    );
  }

  const sp = await searchParams;
  const hoje = hojeSP();
  const de = sp.de && ISO.test(sp.de) ? sp.de : hoje;
  let ate = sp.ate && ISO.test(sp.ate) ? sp.ate : somarDias(hoje, 30);
  if (ate < de) ate = de;
  const sala = /^[0-9a-f-]{36}$/.test(sp.sala ?? "") ? sp.sala! : "";
  const pessoa = (sp.pessoa ?? "").slice(0, 80);
  const [salas, itens] = await Promise.all([listarSalas(true), buscarReservas({ de, ate, sala, pessoa })]);

  return (
    <>
      <PageHeader eyebrow="Salas" titulo="Reservas de salas" sub={`${itens.length} ${itens.length === 1 ? "agendamento" : "agendamentos"} no período`} />
      <form className="card elev-sm" style={{ display: "flex", flexDirection: "row", flexWrap: "wrap", gap: 12, alignItems: "flex-end" }}>
        <div className="field" style={{ width: 160 }}>
          <label htmlFor="de">De</label>
          <input id="de" name="de" type="date" className="input" defaultValue={de} />
        </div>
        <div className="field" style={{ width: 160 }}>
          <label htmlFor="ate">Até</label>
          <input id="ate" name="ate" type="date" className="input" defaultValue={ate} />
        </div>
        <div className="field" style={{ width: 200 }}>
          <label htmlFor="sala">Sala</label>
          <select id="sala" name="sala" className="input" defaultValue={sala}>
            <option value="">Todas as salas</option>
            {salas.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nome}
                {s.ativo ? "" : " (desativada)"}
              </option>
            ))}
          </select>
        </div>
        <div className="field" style={{ flex: "1 1 220px" }}>
          <label htmlFor="pessoa">Pessoa ou assunto</label>
          <input id="pessoa" name="pessoa" className="input" defaultValue={pessoa} placeholder="Buscar por nome, e-mail ou assunto" />
        </div>
        <button className="btn btn-primary">Filtrar</button>
      </form>
      <ListaReservas itens={itens} cancelar={cancelarSalaRH} hrefAgenda="/agenda-salas" mostrarDono vazio="Nenhum agendamento com esses filtros." />
    </>
  );
}
