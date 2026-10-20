import { ofertaPorToken } from "@/app/escala/actions";
import { dataLonga, maiuscula } from "@/lib/escala/formato";
import { OfertaClient } from "./OfertaClient";

export const dynamic = "force-dynamic";

/**
 * Link do e-mail "vaga oferecida". Não exige login: o token (48 hex, guardado só
 * como hash) é o segredo. Nada acontece no GET — aceitar/recusar exige clique,
 * para que pré-visualizadores de e-mail não aceitem sozinhos.
 */
export default async function OfertaPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;
  const o = await ofertaPorToken(token);
  const ativa = !!o && o.status === "OFERECIDA" && new Date(o.expira) > new Date();

  return (
    <div style={{ minHeight: "100vh", display: "grid", placeItems: "center", padding: 16, background: "var(--color-bg)" }}>
      <div className="card elev-md" style={{ width: "min(440px, 100%)", gap: 12 }}>
        <div className="card-kicker">Escala de Presença · vaga oferecida</div>
        {!o ? (
          <>
            <div className="card-title">Link inválido ou já usado</div>
            <p className="card-body">Abra o portal para ver os seus agendamentos.</p>
          </>
        ) : !ativa ? (
          <>
            <div className="card-title">Esta oferta não está mais disponível</div>
            <p className="card-body">
              {o.status === "ATENDIDA" ? "A vaga já foi aceita." : "O prazo terminou e a vaga passou para a próxima pessoa."}
            </p>
          </>
        ) : (
          <>
            <div className="card-title">{maiuscula(dataLonga(o.data))}</div>
            <p className="card-body">
              Olá, {o.primeiroNome}. Abriu uma vaga para você neste dia. Ela fica reservada até {o.expiraTexto}.
            </p>
            <OfertaClient token={token} expira={o.expira} />
          </>
        )}
        <a href="/escala" className="btn btn-ghost" style={{ alignSelf: "flex-start" }}>
          Abrir o portal →
        </a>
      </div>
    </div>
  );
}
