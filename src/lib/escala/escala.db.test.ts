// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Testes de banco da Escala de Presença — "ensaio" das migrations          ║
// ║                                                                          ║
// ║  Abre UMA transação, aplica as migrations pendentes da escala, cria 35    ║
// ║  participantes fictícios e roda os cenários. No fim: ROLLBACK — nada fica ║
// ║  gravado. Só roda com ESCALA_DB_TEST=1 (precisa de DATABASE_URL).          ║
// ║                                                                          ║
// ║    $env:ESCALA_DB_TEST="1"; npx vitest run escala.db                      ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import "dotenv/config";
import pg from "pg";
import { hojeSP, instanteSP, materializar, prazoDoDia } from "./calendario";

const ATIVO = process.env.ESCALA_DB_TEST === "1" && !!process.env.DATABASE_URL;
const MIGRATIONS = ["0024_escala_schema.sql", "0025_escala_funcoes.sql", "0026_escala_rls.sql", "0027_blindar_tabelas_loccontrol.sql"];
const TABELAS_LOCCONTROL = [
  "acessos", "ajuda_videos", "auditoria", "cargos", "chamados", "checklist_itens", "checklist_templates", "cidades",
  "colaboradores", "documentos", "envios_agendados", "equipamentos_catalogo", "eventos", "grupo_membros_externos",
  "grupos_workspace", "matriz", "modelos_email", "notificacoes", "sync_estado", "unidades", "usuarios", "wizard_drafts",
];

type R = Record<string, any>;
const c = new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const q = async (sql: string, p: unknown[] = []) => (await c.query(sql, p)).rows as R[];
const fn = async (nome: string, ...args: unknown[]) =>
  (await q(`select ${nome}(${args.map((_, i) => `$${i + 1}`).join(",")}) as r`, args))[0].r;

/** Executa num savepoint; erro não aborta a transação principal. */
async function tenta(sql: string, p: unknown[] = []): Promise<{ rows?: R[]; erro?: string }> {
  await c.query("savepoint t");
  try {
    const rows = await q(sql, p);
    await c.query("release savepoint t");
    return { rows };
  } catch (e) {
    await c.query("rollback to savepoint t");
    return { erro: (e as Error).message };
  }
}

const SP = (data: string, hora: string) => instanteSP(data, hora).toISOString();
const AGORA0 = SP("2026-10-05", "10:00"); // segunda; âncora = 05/10 (A)
let unidade = "";
let feriados = new Set<string>();
const pa: string[] = []; // participantes do Grupo A
const pb: string[] = []; // participantes do Grupo B
const colabDe = new Map<string, string>();
let diasA: string[] = [];

async function materializarNoBanco(agoraIso: string, motivo = "feriado") {
  feriados = new Set(
    (await q(`select data::text d from escala_feriado where unidade_id is null or unidade_id = $1`, [unidade])).map((r) => r.d),
  );
  const cfg = (await q(`select data_ancora::text a, grupo_inicial g, prazo_hora::text h from escala_config where unidade_id=$1`, [unidade]))[0];
  const hoje = hojeSP(new Date(agoraIso));
  const base = (await q(`select data::text data, grupo from escala_dia where unidade_id=$1 and data < $2 order by data desc limit 1`, [unidade, hoje]))[0];
  const ate = new Date(Date.parse(hoje) + 90 * 86_400_000).toISOString().slice(0, 10);
  const dias = materializar({ de: hoje, ate, params: { ancora: cfg.a, grupoInicial: cfg.g }, feriados, base: (base as any) ?? null })
    .map((d) => ({ ...d, prazo: prazoDoDia(d.data, cfg.h.slice(0, 5), feriados).toISOString() }));
  return fn("escala_aplicar_materializacao", unidade, JSON.stringify(dias), hoje, ate, motivo, agoraIso);
}

const ocup = async (data: string, agora = AGORA0) =>
  (await q(`select * from escala_ocupacao($1,$2,$3)`, [unidade, data, agora]))[0];

describe.skipIf(!ATIVO)("Escala — banco (transação com ROLLBACK)", () => {
  beforeAll(async () => {
    await c.connect();
    await c.query("begin");
    const aplicadas = new Set((await q("select nome from _migrations")).map((r) => r.nome));
    const dir = path.join(process.cwd(), "supabase", "migrations");
    for (const f of readdirSync(dir).filter((f) => MIGRATIONS.includes(f)).sort())
      if (!aplicadas.has(f)) await c.query(readFileSync(path.join(dir, f), "utf8"));

    unidade = (await q(`select unidade_id from escala_config limit 1`))[0].unidade_id;
    await q(`update escala_config set habilitado = true, data_ancora = '2026-10-05' where unidade_id = $1`, [unidade]);
    await q(`insert into escala_feriado (data, nome, origem) values
      ('2026-10-12','Nossa Senhora Aparecida','NACIONAL_API'), ('2026-11-02','Finados','NACIONAL_API'),
      ('2026-11-20','Consciência Negra','NACIONAL_API') on conflict do nothing`);

    const grupos = Object.fromEntries((await q(`select letra, id from escala_grupo where unidade_id=$1`, [unidade])).map((r) => [r.letra, r.id]));
    for (let i = 0; i < 35; i++) {
      const colab = (await q(
        `insert into colaboradores (nome, cpf, cargo, cidade, unidade, status, email)
         values ($1, '000.000.000-00', 'Teste', 'Belo Horizonte', 'Centro', 'Ativo', $2) returning id`,
        [`TESTE Escala ${String(i + 1).padStart(2, "0")}`, `teste.escala.${i + 1}@exemplo.invalid`],
      ))[0].id;
      const letra = i < 18 ? "A" : "B";
      const p = (await q(`insert into escala_participante (colaborador_id, grupo_id) values ($1,$2) returning id`, [colab, grupos[letra]]))[0].id;
      (letra === "A" ? pa : pb).push(p);
      colabDe.set(p, colab);
    }
    await materializarNoBanco(AGORA0);
    diasA = (await q(`select data::text d from escala_dia where unidade_id=$1 and grupo='A' and data > '2026-10-05' order by data`, [unidade])).map((r) => r.d);
  }, 60_000);

  afterAll(async () => {
    if (ATIVO) {
      await c.query("rollback");
      await c.end();
    }
  });

  it("materializa 90 dias, só dias úteis, alternando A/B a partir da âncora", async () => {
    const dias = await q(`select data::text d, grupo from escala_dia where unidade_id=$1 order by data`, [unidade]);
    expect(dias[0]).toMatchObject({ d: "2026-10-05", grupo: "A" });
    expect(dias.find((d) => d.d === "2026-10-12")).toBeUndefined();
    for (let i = 1; i < dias.length; i++) expect(dias[i].grupo).not.toBe(dias[i - 1].grupo);
  });

  it("vagas: dia do A (18) sobra 4; dia do B (17) sobra 5", async () => {
    expect((await ocup(diasA[0])).vagas_livres).toBe(4);
    expect((await ocup("2026-10-06")).vagas_livres).toBe(5);
  });

  it("elegibilidade de reserva", async () => {
    expect(await fn("escala_reservar", pb[0], diasA[0], AGORA0)).toMatchObject({ ok: true, codigo: "CONFIRMADA" });
    expect(await fn("escala_reservar", pa[0], diasA[0], AGORA0)).toMatchObject({ codigo: "DIA_DO_PROPRIO_GRUPO" });
    expect(await fn("escala_reservar", pb[0], diasA[0], AGORA0)).toMatchObject({ codigo: "JA_RESERVADO" });
    expect(await fn("escala_reservar", pb[0], "2026-10-05", AGORA0)).toMatchObject({ codigo: "DIA_PASSADO" });
    expect(await fn("escala_reservar", pb[0], "2026-10-10", AGORA0)).toMatchObject({ codigo: "NAO_E_DIA_UTIL" });
  });

  it("limite mensal (4 reservas confirmadas/utilizadas no mês)", async () => {
    const outubro = diasA.filter((d) => d.startsWith("2026-10")).slice(2, 7);
    for (const d of outubro.slice(0, 4)) expect(await fn("escala_reservar", pb[1], d, AGORA0)).toMatchObject({ ok: true });
    expect(await fn("escala_reservar", pb[1], outubro[4], AGORA0)).toMatchObject({ codigo: "LIMITE_MENSAL" });
  });

  it("dia lotado → fila FIFO com posição; ninguém fura a fila", async () => {
    const d = diasA[1];
    for (const p of pb.slice(2, 6)) expect(await fn("escala_reservar", p, d, AGORA0)).toMatchObject({ ok: true });
    expect(await fn("escala_reservar", pb[6], d, AGORA0)).toMatchObject({ codigo: "LOTADO" });
    expect((await fn("escala_entrar_fila", pb[6], d, AGORA0)).posicao).toBe(1);
    expect((await fn("escala_entrar_fila", pb[7], d, AGORA0)).posicao).toBe(2);
    expect((await fn("escala_entrar_fila", pb[8], d, AGORA0)).posicao).toBe(3);
    expect(await fn("escala_entrar_fila", pb[6], d, AGORA0)).toMatchObject({ codigo: "JA_NA_FILA" });
    expect(await fn("escala_entrar_fila", pb[10], diasA[0], AGORA0)).toMatchObject({ codigo: "HA_VAGAS" });
  });

  it("vaga aberta ANTES do prazo vai direto para o 1º da fila", async () => {
    const d = diasA[1];
    const r = await fn("escala_marcar_ausencia", pa[1], d, AGORA0);
    expect(r).toMatchObject({ ok: true, em_cima_da_hora: false });
    expect(r.acoes).toEqual([expect.objectContaining({ tipo: "ATRIBUIDA", participante_id: pb[6] })]);
    const fila = (await q(`select id from escala_fila where participante_id=$1 and data=$2`, [pb[7], d]))[0].id;
    expect(await fn("escala_posicao_fila", fila)).toBe(1);
  });

  it("vaga aberta DEPOIS do prazo vira oferta de 2h; oferta segura o lugar; aceite pelo link", async () => {
    const d = diasA[1];
    const prazo = (await q(`select prazo from escala_dia where unidade_id=$1 and data=$2`, [unidade, d]))[0].prazo as Date;
    const agora = new Date(prazo.getTime() + 60 * 60_000).toISOString(); // 1h após o prazo
    const r = await fn("escala_marcar_ausencia", pa[2], d, agora);
    expect(r.em_cima_da_hora).toBe(true);
    const oferta = r.acoes[0];
    expect(oferta).toMatchObject({ tipo: "OFERECIDA", participante_id: pb[7] });
    expect(new Date(oferta.expira_em).getTime()).toBe(Date.parse(agora) + 120 * 60_000);
    expect(await fn("escala_reservar", pb[11], d, agora)).toMatchObject({ codigo: "LOTADO" });
    expect(await fn("escala_aceitar_oferta", null, null, oferta.token, agora)).toMatchObject({ ok: true, codigo: "CONFIRMADA" });
  });

  it("recusa passa a vaga ao próximo na hora", async () => {
    const d = diasA[1];
    const prazo = (await q(`select prazo from escala_dia where unidade_id=$1 and data=$2`, [unidade, d]))[0].prazo as Date;
    const agora = new Date(prazo.getTime() + 70 * 60_000).toISOString();
    const r = await fn("escala_marcar_ausencia", pa[3], d, agora);
    expect(r.acoes[0]).toMatchObject({ tipo: "OFERECIDA", participante_id: pb[8] });
    const rec = await fn("escala_recusar_oferta", r.acoes[0].fila_id, pb[8], null, agora);
    expect(rec).toMatchObject({ ok: true, acoes: [] }); // fila vazia: a vaga fica livre
    expect(await fn("escala_reservar", pb[11], d, agora)).toMatchObject({ ok: true });
  });

  it("oferta expirada passa ao próximo; job é idempotente; fila encerra às 00:00", async () => {
    const d = diasA[3];
    for (const p of pb.slice(2, 17)) {
      const r = await fn("escala_reservar", p, d, AGORA0);
      if (r.codigo === "LOTADO") break;
    }
    expect((await ocup(d)).vagas_disponiveis).toBe(0);
    await fn("escala_entrar_fila", pb[12], d, AGORA0);
    await fn("escala_entrar_fila", pb[13], d, AGORA0);

    const prazo = (await q(`select prazo from escala_dia where unidade_id=$1 and data=$2`, [unidade, d]))[0].prazo as Date;
    const t1 = new Date(prazo.getTime() + 60 * 60_000);
    const r = await fn("escala_marcar_ausencia", pa[5], d, t1.toISOString());
    expect(r.acoes[0]).toMatchObject({ tipo: "OFERECIDA", participante_id: pb[12] });

    const t2 = new Date(t1.getTime() + 121 * 60_000).toISOString();
    const e1 = await fn("escala_expirar_ofertas", t2);
    expect(e1.expiradas).toBe(1);
    expect(e1.acoes).toEqual(expect.arrayContaining([expect.objectContaining({ tipo: "OFERECIDA", participante_id: pb[13] })]));
    expect((await fn("escala_expirar_ofertas", t2)).expiradas).toBe(0);
    expect(await fn("escala_aceitar_oferta", r.acoes[0].fila_id, pb[12], null, t2)).toMatchObject({ codigo: "STATUS_INVALIDO" });

    const depoisDaMeiaNoite = SP(d, "00:30");
    await fn("escala_expirar_ofertas", depoisDaMeiaNoite);
    const abertas = await q(`select count(*)::int n from escala_fila where data <= $1 and status in ('AGUARDANDO','OFERECIDA')`, [d]);
    expect(abertas[0].n).toBe(0);
  });

  it("prazo de cancelamento: pessoa bloqueada depois do prazo; RH pode cancelar", async () => {
    const d = diasA[0];
    const res = (await q(`select id from escala_reserva where participante_id=$1 and data=$2 and status='CONFIRMADA'`, [pb[0], d]))[0].id;
    const prazo = (await q(`select prazo from escala_dia where unidade_id=$1 and data=$2`, [unidade, d]))[0].prazo as Date;
    const depois = new Date(prazo.getTime() + 60_000).toISOString();
    expect(await fn("escala_cancelar_reserva", res, pb[0], depois, "pessoa")).toMatchObject({ codigo: "PRAZO_ENCERRADO" });
    expect(await fn("escala_cancelar_reserva", res, null, depois, "admin")).toMatchObject({ ok: true });
    const r2 = await fn("escala_reservar", pb[0], d, AGORA0);
    expect(await fn("escala_cancelar_reserva", r2.reserva_id, pb[0], AGORA0, "pessoa")).toMatchObject({ ok: true });
  });

  it("afastado não reserva; desligado sai da escala e perde reservas futuras", async () => {
    await q(`update colaboradores set status='Afastado' where id=$1`, [colabDe.get(pb[14])]);
    const ev = await q(`select payload from escala_evento where payload->>'colaborador_id' = $1`, [colabDe.get(pb[14])]);
    expect(ev[0].payload).toMatchObject({ de: "Ativo", para: "Afastado" });
    await fn("escala_aplicar_status", colabDe.get(pb[14]), "Afastado", AGORA0);
    expect(await fn("escala_reservar", pb[14], diasA[5], AGORA0)).toMatchObject({ codigo: "AFASTADO" });

    await q(`update colaboradores set status='Afastado' where id=$1`, [colabDe.get(pa[6])]);
    const antes = (await ocup(diasA[5])).vagas_livres;
    await fn("escala_aplicar_status", colabDe.get(pa[6]), "Afastado", AGORA0);
    expect((await ocup(diasA[5])).vagas_livres).toBe(antes + 1);

    await q(`update colaboradores set status='Desligado' where id=$1`, [colabDe.get(pb[1])]);
    const r = await fn("escala_aplicar_status", colabDe.get(pb[1]), "Desligado", AGORA0);
    expect(r.canceladas.length).toBe(4);
    expect((await q(`select ativo from escala_participante where id=$1`, [pb[1]]))[0].ativo).toBe(false);
  });

  it("feriado novo: remove o dia, recalcula só o futuro e invalida reservas; reaplicar é idempotente", async () => {
    const reservaNoDia = await fn("escala_reservar", pb[15], "2026-10-21", AGORA0);
    await q(`insert into escala_feriado (data, nome, unidade_id, origem) values ('2026-10-21','Teste','${unidade}','MANUAL')`);
    const r = await materializarNoBanco(AGORA0);
    expect(r.removidos.map((x: R) => x.data)).toContain("2026-10-21");
    expect(r.alterados.length).toBeGreaterThan(0);
    if (reservaNoDia.ok) expect(r.canceladas).toEqual(expect.arrayContaining([expect.objectContaining({ id: reservaNoDia.reserva_id })]));

    // ninguém ficou com reserva num dia do próprio grupo
    const conflito = await q(`select count(*)::int n from escala_reserva x join escala_participante p on p.id=x.participante_id
      join escala_grupo g on g.id=p.grupo_id join escala_dia ed on ed.unidade_id=x.unidade_id and ed.data=x.data
      where x.status='CONFIRMADA' and ed.grupo=g.letra`);
    expect(conflito[0].n).toBe(0);

    const r2 = await materializarNoBanco(AGORA0);
    expect(r2).toMatchObject({ removidos: [], alterados: [], canceladas: [] });
  });

  it("nenhum dia passa da capacidade", async () => {
    const neg = await q(`select ed.data from escala_dia ed, escala_ocupacao(ed.unidade_id, ed.data, $1) o
      where ed.unidade_id=$2 and o.vagas_livres < 0`, [AGORA0, unidade]);
    expect(neg).toEqual([]);
  });

  it("marcação de UTILIZADA é idempotente; views do dashboard respondem", async () => {
    const t = SP("2026-10-09", "23:00");
    expect(await fn("escala_marcar_utilizadas", t)).toBeGreaterThan(0);
    expect(await fn("escala_marcar_utilizadas", t)).toBe(0);
    const v = await q(`select * from escala_v_dia where unidade_id=$1 and data='2026-10-07'`, [unidade]);
    expect(v[0]).toMatchObject({ escalados: "18" });
  });

  describe("separação de acesso (RLS)", () => {
    const authId = randomUUID();
    const comoUsuario = async (role: "anon" | "authenticated", sql: string) => {
      await c.query("savepoint rls");
      try {
        await c.query(`set local role ${role}`);
        await c.query(`select set_config('request.jwt.claims', $1, true)`, [
          JSON.stringify(role === "anon" ? { role } : { role, sub: authId, email: "teste@locgrupo.com.br" }),
        ]);
        const rows = await q(sql);
        return { rows };
      } catch (e) {
        return { erro: (e as Error).message };
      } finally {
        await c.query("rollback to savepoint rls");
        await c.query("reset role");
      }
    };

    beforeAll(async () => {
      if (ATIVO) await q(`update escala_participante set auth_user_id=$1 where id=$2`, [authId, pb[2]]);
    });

    it.each(TABELAS_LOCCONTROL)("COLABORADOR_ESCALA não lê %s", async (t) => {
      const r = await comoUsuario("authenticated", `select * from ${t} limit 1`);
      expect(r.erro ?? "").toMatch(/permission denied/);
    });

    it.each(TABELAS_LOCCONTROL)("anon não lê %s", async (t) => {
      const r = await comoUsuario("anon", `select * from ${t} limit 1`);
      expect(r.erro ?? "").toMatch(/permission denied/);
    });

    it("não lê tabelas internas da escala nem as views", async () => {
      for (const t of ["escala_config", "escala_global", "escala_grupo", "escala_email_enviado", "escala_log_job",
        "escala_evento", "escala_afastamento", "escala_v_dia", "escala_v_presenca"]) {
        expect((await comoUsuario("authenticated", `select * from ${t} limit 1`)).erro ?? "").toMatch(/permission denied/);
      }
    });

    it("lê só as próprias reservas e não lê colunas secretas", async () => {
      const r = await comoUsuario("authenticated", `select distinct participante_id from escala_reserva`);
      expect(r.rows).toEqual([{ participante_id: pb[2] }]);
      expect((await comoUsuario("authenticated", `select oferta_token_hash from escala_fila`)).erro).toMatch(/permission denied/);
      expect((await comoUsuario("authenticated", `select ics_token_hash from escala_preferencia`)).erro).toMatch(/permission denied/);
    });

    it("não escreve nada direto nem executa as funções de regra", async () => {
      expect((await comoUsuario("authenticated",
        `insert into escala_reserva (participante_id, unidade_id, data) values ('${pb[2]}','${unidade}','2026-10-30')`)).erro)
        .toMatch(/permission denied/);
      expect((await comoUsuario("authenticated", `update escala_reserva set status='CANCELADA'`)).erro).toMatch(/permission denied/);
      expect((await comoUsuario("authenticated", `select escala_reservar('${pb[2]}','2026-10-30')`)).erro).toMatch(/permission denied/);
      expect((await comoUsuario("authenticated", `select proximo_chamado()`)).erro).toMatch(/permission denied/);
    });

    it("vê o calendário só da própria unidade; conta sem vínculo não vê nada", async () => {
      const r = await comoUsuario("authenticated", `select count(*)::int n from escala_dia`);
      expect(r.rows![0].n).toBeGreaterThan(0);
      await q(`update escala_participante set auth_user_id=null where id=$1`, [pb[2]]);
      const r2 = await comoUsuario("authenticated", `select count(*)::int n from escala_dia`);
      expect(r2.rows![0].n).toBe(0);
    });
  });
});
