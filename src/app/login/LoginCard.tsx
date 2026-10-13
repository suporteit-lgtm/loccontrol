"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Plus_Jakarta_Sans } from "next/font/google";
import { entrarComEmail } from "@/app/actions/sessao";
import type { DiaSemana } from "@/lib/escala/semana";
import { PortalColaborador } from "./PortalColaborador";
import { HeroPortal } from "./HeroPortal";
import s from "./login.module.css";

// fonte do mockup "Login · Desktop" — só nesta tela
const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700", "800"],
  variable: "--font-login",
  display: "swap",
});

type Status = "Concluído" | "Em andamento" | "Pendente";

const TOM: Record<Status, string> = {
  Concluído: s.chipConcluido,
  "Em andamento": s.chipAndamento,
  Pendente: s.chipPendente,
};

const ICONE = {
  entrada: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="19" x2="19" y1="8" y2="14" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </>
  ),
  troca: (
    <>
      <path d="M8 3 4 7l4 4" />
      <path d="M4 7h16" />
      <path d="m16 21 4-4-4-4" />
      <path d="M20 17H4" />
    </>
  ),
  saida: (
    <>
      <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
      <circle cx="9" cy="7" r="4" />
      <line x1="22" x2="16" y1="11" y2="11" />
    </>
  ),
};

const ETAPAS: { nome: string; desc: string; rh: Status; ti: Status; icone: keyof typeof ICONE }[] = [
  { nome: "Admissão", desc: "Contrato, acessos e equipamentos", rh: "Concluído", ti: "Concluído", icone: "entrada" },
  { nome: "Transferência", desc: "Mudança de área ou unidade", rh: "Concluído", ti: "Em andamento", icone: "troca" },
  { nome: "Desligamento", desc: "Revogação de acessos e devoluções", rh: "Pendente", ti: "Pendente", icone: "saida" },
];

const DESTAQUES = [
  "Um fluxo só, do início ao fim",
  "RH e TI sem planilha paralela",
  "Histórico de acessos e equipamentos",
];

function Icone({ size = 18, stroke = "currentColor", width = 2, children }: {
  size?: number;
  stroke?: string;
  width?: number;
  children: React.ReactNode;
}) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={stroke}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {children}
    </svg>
  );
}

export function LoginCard({
  portal,
  admin = false,
}: {
  /** cartão do portal do colaborador (Escala e Salas); só vem com a Escala habilitada */
  portal?: { semana: DiaSemana[] | null; href: string };
  /** abrir direto no login por e-mail e senha (?admin=1) */
  admin?: boolean;
}) {
  // com o portal ligado, a tela abre no login Google; RH e TI seguem para o e-mail e senha
  const [modo, setModo] = useState<"portal" | "admin">(portal && !admin ? "portal" : "admin");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [verSenha, setVerSenha] = useState(false);
  const [erro, setErro] = useState("");
  const [pending, start] = useTransition();
  const [lembrar, setLembrar] = useState(true);
  const senhaRef = useRef<HTMLInputElement>(null);

  // "Manter conectado": o e-mail fica salvo neste navegador
  useEffect(() => {
    if (modo !== "admin") return;
    try {
      const salvo = localStorage.getItem("lc_email");
      if (salvo) {
        setEmail(salvo);
        senhaRef.current?.focus();
      }
    } catch {}
  }, [modo]);

  const entrar = () =>
    start(async () => {
      try {
        if (lembrar) localStorage.setItem("lc_email", email.trim().toLowerCase());
        else localStorage.removeItem("lc_email");
      } catch {}
      const r = await entrarComEmail(email, senha, lembrar);
      if (r && !r.ok) setErro(r.msg);
    });

  const podeEntrar = email.includes("@") && !!senha && !pending;

  return (
    <main className={`${jakarta.variable} ${s.main}`}>
      <section className={s.formCol}>
        <div className={s.brand}>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/logo.png" alt="Locagora" data-logo="1" className={s.brandLogo} />
          <span className={s.brandSep} />
          <span className={s.brandName}>LOCCONTROL</span>
        </div>

        <div className={s.formWrap}>
          {/* form de verdade: o navegador oferece salvar a senha */}
          <form
            className={s.form}
            onSubmit={(e) => {
              e.preventDefault();
              if (podeEntrar) entrar();
            }}
          >
            <div className={s.head}>
              <h1 className={s.title}>{modo === "portal" ? "Acesse sua conta" : "Acesso RH e TI"}</h1>
              <p className={s.subtitle}>
                {modo === "portal"
                  ? "Entre com sua conta Google @locgrupo.com.br."
                  : "Entre com seu e-mail corporativo e senha do LocControl."}
              </p>
            </div>

            {modo === "portal" && portal && (
              <>
                <PortalColaborador semana={portal.semana} href={portal.href} />
                <div className={s.ou}>
                  <span />
                  equipe de RH e TI
                  <span />
                </div>
                <button type="button" className={s.adminBtn} onClick={() => setModo("admin")}>
                  <span className={s.adminIcone} aria-hidden="true">
                    <Icone size={17}>
                      <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                      <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                    </Icone>
                  </span>
                  <span className={s.adminTxt}>
                    <strong>Acesso administrativo</strong>
                    <span>LocControl · e-mail e senha</span>
                  </span>
                  <Icone width={2.2}>
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </Icone>
                </button>
              </>
            )}

            {modo === "admin" && (
            <>
            <div className={s.fields}>
              <div className={s.group}>
                <label htmlFor="email" className={s.label}>E-mail corporativo</label>
                <div className={s.field}>
                  <Icone stroke="#7D89A8">
                    <rect width="20" height="16" x="2" y="4" rx="2" />
                    <path d="m22 7-8.97 5.7a1.94 1.94 0 0 1-2.06 0L2 7" />
                  </Icone>
                  <input
                    id="email"
                    name="email"
                    type="email"
                    autoFocus
                    autoComplete="username"
                    placeholder="nome@locgrupo.com.br"
                    value={email}
                    onChange={(e) => {
                      setEmail(e.target.value);
                      setErro("");
                    }}
                  />
                </div>
              </div>

              <div className={s.group}>
                <div className={s.labelRow}>
                  <label htmlFor="password" className={s.label}>Senha</label>
                </div>
                <div className={`${s.field} ${s.fieldPw}`}>
                  <Icone stroke="#7D89A8">
                    <rect width="18" height="11" x="3" y="11" rx="2" ry="2" />
                    <path d="M7 11V7a5 5 0 0 1 10 0v4" />
                  </Icone>
                  <input
                    ref={senhaRef}
                    id="password"
                    name="password"
                    type={verSenha ? "text" : "password"}
                    autoComplete="current-password"
                    placeholder="Sua senha"
                    value={senha}
                    onChange={(e) => {
                      setSenha(e.target.value);
                      setErro("");
                    }}
                  />
                  <button
                    type="button"
                    className={s.eye}
                    onClick={() => setVerSenha((v) => !v)}
                    aria-label={verSenha ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={verSenha}
                  >
                    {verSenha ? (
                      <Icone>
                        <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24" />
                        <path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68" />
                        <path d="M6.61 6.61A13.53 13.53 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61" />
                        <line x1="2" x2="22" y1="2" y2="22" />
                      </Icone>
                    ) : (
                      <Icone>
                        <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z" />
                        <circle cx="12" cy="12" r="3" />
                      </Icone>
                    )}
                  </button>
                </div>
              </div>

              <label htmlFor="remember" className={s.remember}>
                <input
                  id="remember"
                  type="checkbox"
                  checked={lembrar}
                  onChange={() => setLembrar(!lembrar)}
                />
                <span>Manter conectado por 30 dias</span>
              </label>
            </div>

            {erro && (
              <div role="alert" className={s.erro}>
                {erro}
              </div>
            )}

            <button type="submit" className={s.cta} disabled={!podeEntrar}>
              <span>{pending ? "Entrando..." : "Entrar"}</span>
              <Icone width={2.2}>
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </Icone>
            </button>

            {portal && (
              <button type="button" className={s.voltar} onClick={() => { setModo("portal"); setErro(""); }}>
                <Icone size={16} width={2.2}>
                  <path d="M19 12H5" />
                  <path d="m12 19-7-7 7-7" />
                </Icone>
                Voltar para o login com Google
              </button>
            )}
            </>
            )}

            <div className={s.foot}>
              <div className={s.footLine}>
                <Icone size={16} stroke="#3CC45A">
                  <path d="M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z" />
                  <path d="m9 12 2 2 4-4" />
                </Icone>
                <span>
                  Acesso restrito a <strong>@locgrupo.com.br</strong>
                </span>
              </div>
            </div>
          </form>
        </div>

        <p className={s.copy}>© 2026 Locagora. Todos os direitos reservados.</p>
      </section>

      <aside className={s.hero}>
        {/* no login Google o lado direito mostra o portal; no acesso administrativo, o ciclo de vida (RH e TI) */}
        {modo === "portal" && portal ? (
          <HeroPortal
            semana={portal.semana}
            painelRhTi={
              <div className={s.stages}>
                {ETAPAS.map((e) => (
                  <div key={e.nome} className={s.stage}>
                    <span className={s.stageIcon}>
                      <Icone>{ICONE[e.icone]}</Icone>
                    </span>
                    <div className={s.stageText}>
                      <span className={s.stageName}>{e.nome}</span>
                      <span className={s.stageDesc}>{e.desc}</span>
                    </div>
                    <div className={s.chips}>
                      <span className={`${s.chip} ${TOM[e.rh]}`}>RH · {e.rh}</span>
                      <span className={`${s.chip} ${TOM[e.ti]}`}>TI · {e.ti}</span>
                    </div>
                  </div>
                ))}
              </div>
            }
          />
        ) : (
        <>
        <div className={s.heroIntro}>
          <span className={s.pill}>
            <span className={s.dot} />
            Gestão de pessoas · RH + TI
          </span>
          <h2 className={s.heroTitle}>
            Gestão inteligente
            <br />
            do <span>ciclo de vida</span>
          </h2>
          <p className={s.heroText}>
            Acompanhe admissões, transferências e desligamentos com RH e TI sempre sincronizados, em tempo real.
          </p>
        </div>

        <div className={s.panel}>
          <div className={s.panelHead}>
            <span className={s.panelTitle}>Etapas do colaborador</span>
            <span className={s.live}>
              <span className={s.dot} />
              Tempo real
            </span>
          </div>
          <div className={s.stages}>
            {ETAPAS.map((e) => (
              <div key={e.nome} className={s.stage}>
                <span className={s.stageIcon}>
                  <Icone>{ICONE[e.icone]}</Icone>
                </span>
                <div className={s.stageText}>
                  <span className={s.stageName}>{e.nome}</span>
                  <span className={s.stageDesc}>{e.desc}</span>
                </div>
                <div className={s.chips}>
                  <span className={`${s.chip} ${TOM[e.rh]}`}>RH · {e.rh}</span>
                  <span className={`${s.chip} ${TOM[e.ti]}`}>TI · {e.ti}</span>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className={s.features}>
          {DESTAQUES.map((f) => (
            <div key={f} className={s.feature}>
              <Icone size={16} stroke="#3CC45A" width={2.4}>
                <path d="M20 6 9 17l-5-5" />
              </Icone>
              <span>{f}</span>
            </div>
          ))}
        </div>
        </>
        )}
      </aside>
    </main>
  );
}
