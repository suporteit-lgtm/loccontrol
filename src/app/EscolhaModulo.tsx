/**
 * Tela de entrada. À esquerda, os dois acessos: portal do colaborador (Escala e
 * Salas, login Google) e o acesso administrativo do LocControl. À direita, um
 * painel com dados reais — a semana da escala e a situação das salas agora — e
 * o fluxo que RH e TI acompanham.
 */
import { CartaoEscala } from "@/components/escala/CartaoEscala";
import type { DiaSemana } from "@/lib/escala/semana";
import type { EstadoSala } from "@/lib/salas/regras";
import { dataLonga, maiuscula } from "@/lib/escala/formato";

export type { DiaSemana };

export interface SalaAgora {
  nome: string;
  descricao: string | null;
  estado: EstadoSala;
}

const ICONES = {
  cadeado: ["M5 11h14v10H5z", "M8 11V7a4 4 0 0 1 8 0v4"],
  escudo: ["M12 3 4 6v6c0 5 3.5 8 8 9 4.5-1 8-4 8-9V6z", "m9 12 2 2 4-4"],
  calendario: ["M3 5h18v16H3z", "M3 10h18", "M8 3v4", "M16 3v4"],
  porta: ["M3 21h18", "M5 21V4a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v17", "M15 12h.01"],
  admissao: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8", "M19 8v6", "M22 11h-6"],
  transferencia: ["M17 3l4 4-4 4", "M3 7h18", "M7 21l-4-4 4-4", "M21 17H3"],
  desligamento: ["M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2", "M9 3a4 4 0 1 0 0 8 4 4 0 0 0 0-8", "M22 11h-6"],
} as const;

function Ico({ nome, tamanho = 18 }: { nome: keyof typeof ICONES; tamanho?: number }) {
  return (
    <svg width={tamanho} height={tamanho} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {ICONES[nome].map((d) => (
        <path key={d} d={d} />
      ))}
    </svg>
  );
}

function rotuloSala(e: EstadoSala): { texto: string; tom: "ok" | "ocupada" | "fechada" } {
  if (e.tipo === "fechada") return { texto: "Fechada agora", tom: "fechada" };
  if (e.tipo === "ocupada") return { texto: `Ocupada até ${e.ate}`, tom: "ocupada" };
  return { texto: e.ate ? `Livre até ${e.ate}` : "Livre", tom: "ok" };
}

const ETAPAS = [
  { icone: "admissao", nome: "Admissão", texto: "Conta, acessos e equipamentos prontos no primeiro dia" },
  { icone: "transferencia", nome: "Transferência", texto: "Mudança de área ou unidade sem perder nada" },
  { icone: "desligamento", nome: "Desligamento", texto: "Acessos revogados e devoluções conferidas" },
] as const;

export function EscolhaModulo({
  semana,
  salas,
  hoje,
  hrefEscala = "/escala",
}: {
  semana: DiaSemana[] | null;
  salas: SalaAgora[] | null;
  hoje: string;
  hrefEscala?: string;
}) {
  const diaHoje = semana?.find((d) => d.hoje);
  const livres = salas?.filter((s) => s.estado.tipo === "livre").length ?? 0;

  return (
    <div className="login-split">
      <div className="login-form-panel">
        <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Locagora" data-logo="1" style={{ width: 128, maxWidth: "100%", filter: "brightness(1.35) saturate(1.05)" }} />
          <div style={{ width: 1, height: 22, background: "rgb(255 255 255 / 0.15)" }} />
          <span style={{ fontWeight: 800, fontSize: 12, letterSpacing: "0.16em", color: "#fff", opacity: 0.85 }}>LOCCONTROL</span>
        </div>

        <div className="entrada-coluna">
          <div>
            <h1 style={{ fontSize: 26, margin: 0, letterSpacing: "-0.015em" }}>Acesse sua conta</h1>
            <p className="text-muted" style={{ fontSize: 14, margin: "8px 0 0", lineHeight: 1.5 }}>
              Escolha como você vai entrar.
            </p>
          </div>

          <CartaoEscala semana={semana} href={hrefEscala} />

          <div className="entrada-divisor">equipe de RH e TI</div>

          <a href="/login" className="entrada-admin">
            <span className="entrada-admin-ico">
              <Ico nome="cadeado" />
            </span>
            <span style={{ display: "flex", flexDirection: "column", gap: 2, minWidth: 0, flex: 1 }}>
              <strong style={{ fontSize: 14.5 }}>Acesso administrativo</strong>
              <span style={{ fontSize: 12.5, opacity: 0.7 }}>LocControl · e-mail e senha</span>
            </span>
            <span aria-hidden="true" style={{ fontSize: 18, opacity: 0.8 }}>→</span>
          </a>

          <div className="entrada-restrito">
            <Ico nome="escudo" tamanho={15} />
            Acesso restrito a <strong>@locgrupo.com.br</strong>
          </div>
        </div>

        <span style={{ fontSize: 11.5, color: "rgb(255 255 255 / 0.4)" }}>© 2026 Locagora. Todos os direitos reservados.</span>
      </div>

      <div className="login-hero">
        <div className="entrada-hero">
          <span className="entrada-pilula">
            <i /> LocControl · Grupo LOC
          </span>
          <h1 className="entrada-titulo">
            Sua rotina no escritório
            <br />e a gestão das pessoas, <span>em um só lugar</span>
          </h1>

          <div className="entrada-bento">
            {/* hoje na escala (dado real) */}
            <section className="entrada-bloco">
              <header>
                <span className="entrada-bloco-ico"><Ico nome="calendario" /></span>
                <span>
                  <small>Para colaboradores</small>
                  <strong>Escala de presença</strong>
                </span>
              </header>
              <div className="entrada-hoje">
                <span className="text-muted">{maiuscula(dataLonga(hoje))}</span>
                <strong>
                  {diaHoje?.feriado
                    ? `Feriado · ${diaHoje.feriado}`
                    : diaHoje?.grupo
                      ? `Hoje é dia do Grupo ${diaHoje.grupo}`
                      : diaHoje?.util
                        ? "Hoje é dia livre: qualquer pessoa agenda"
                        : "Sem expediente hoje"}
                </strong>
              </div>
              {semana && (
                <div className="entrada-semana" aria-label="Semana da escala">
                  {semana.map((d) => (
                    <span key={d.data} data-g={d.grupo ?? (d.util ? "livre" : undefined)} data-hoje={d.hoje ? "1" : undefined}>
                      <small>{d.nome}</small>
                      <b>{d.grupo ?? (d.util ? "Livre" : "—")}</b>
                    </span>
                  ))}
                </div>
              )}
                          </section>

            {/* salas agora (dado real, sem nomes de pessoas) */}
            <section className="entrada-bloco">
              <header>
                <span className="entrada-bloco-ico"><Ico nome="porta" /></span>
                <span>
                  <small>Para colaboradores</small>
                  <strong>Salas de reunião</strong>
                </span>
                {salas && salas.length > 0 && <em className="entrada-contagem">{livres} de {salas.length} livres</em>}
              </header>
              {salas && salas.length > 0 ? (
                <ul className="entrada-salas">
                  {salas.map((s) => {
                    const r = rotuloSala(s.estado);
                    return (
                      <li key={s.nome}>
                        <span>
                          <strong>{s.nome}</strong>
                          {s.descricao && <small>{s.descricao}</small>}
                        </span>
                        <em data-tom={r.tom}>{r.texto}</em>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <p>Agende uma sala de reunião em poucos cliques.</p>
              )}
            </section>

            {/* fluxo do RH e TI */}
            <section className="entrada-bloco entrada-bloco-largo">
              <header>
                <span className="entrada-bloco-ico"><Ico nome="admissao" /></span>
                <span>
                  <small>Para RH e TI</small>
                  <strong>Ciclo de vida do colaborador</strong>
                </span>
              </header>
              <ol className="entrada-etapas">
                {ETAPAS.map((e) => (
                  <li key={e.nome}>
                    <span className="entrada-etapa-ico"><Ico nome={e.icone} tamanho={17} /></span>
                    <strong>{e.nome}</strong>
                    <small>{e.texto}</small>
                  </li>
                ))}
              </ol>
            </section>
          </div>
          <p className="entrada-rodape">A semana da escala e a situação das salas são reais e se atualizam a cada acesso.</p>
        </div>
      </div>
    </div>
  );
}
