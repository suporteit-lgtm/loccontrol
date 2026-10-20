// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Teste de CONCORRÊNCIA REAL — várias conexões ao mesmo tempo              ║
// ║                                                                          ║
// ║  Os testes de banco comuns rodam numa transação só, o que não prova o     ║
// ║  lock. Aqui cada pessoa usa a SUA conexão e as chamadas disputam a mesma  ║
// ║  vaga de verdade. Para não tocar em nenhum dado real:                     ║
// ║   • cria um schema temporário (escala_conc_xxxx) com cópias vazias das    ║
// ║     tabelas (LIKE … INCLUDING ALL) e das funções da escala;               ║
// ║   • cada conexão usa search_path = schema temporário, public;            ║
// ║   • a unidade é um UUID aleatório (o advisory lock não colide com nada);  ║
// ║   • no fim: DROP SCHEMA … CASCADE.                                        ║
// ║                                                                          ║
// ║    $env:ESCALA_DB_TEST="1"; npx vitest run escala.concorrencia            ║
// ╚══════════════════════════════════════════════════════════════════════════╝
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { randomBytes, randomUUID } from "node:crypto";
import "dotenv/config";
import pg from "pg";

const ATIVO = process.env.ESCALA_DB_TEST === "1" && !!process.env.DATABASE_URL;
const SCHEMA = `escala_conc_${randomBytes(4).toString("hex")}`;
const TABELAS = [
  "colaboradores", "escala_global", "escala_config", "escala_grupo", "escala_participante", "escala_afastamento",
  "escala_feriado", "escala_dia", "escala_ausencia", "escala_reserva", "escala_fila", "escala_preferencia",
  "escala_email_enviado", "escala_log_job", "escala_evento",
];
const FUNCOES = ["0025_escala_funcoes.sql", "0028_escala_dias_livres.sql", "0029_escala_remanejamento_feriado.sql"];
const N = 10; // conexões simultâneas (o pooler do Supabase aceita 15 no total)
const CAP = 5;
const AGORA = new Date().toISOString();

type R = Record<string, any>;
const nova = () => new pg.Client({ connectionString: process.env.DATABASE_URL, ssl: { rejectUnauthorized: false } });
const adm = nova();
const conns: pg.Client[] = [];
const q = async (c: pg.Client, sql: string, p: unknown[] = []) => (await c.query(sql, p)).rows as R[];

const unidade = randomUUID();
const pessoas: string[] = []; // participantes do Grupo B (dias livres: qualquer um agenda)
let grupoB = "";

/** Dia futuro (daqui a `n` dias) — longe de hoje, prazo no futuro: vaga liberada é ATRIBUÍDA. */
const dia = (n: number) => new Date(Date.now() + n * 86_400_000).toISOString().slice(0, 10);

async function criarDia(data: string, prazoNoFuturo = true) {
  const prazo = new Date(Date.now() + (prazoNoFuturo ? 1 : -1) * 3_600_000).toISOString();
  await q(adm, `insert into escala_dia (unidade_id, data, grupo, prazo) values ($1, $2, null, $3)`, [unidade, data, prazo]);
}

/**
 * Dispara `chamadas` ao mesmo tempo: uma conexão "porteira" segura o lock do
 * dia, todas as chamadas ficam esperando nele e são soltas juntas.
 */
async function emDisputa(data: string, chamadas: ((c: pg.Client) => Promise<R>)[]) {
  const porteira = conns[N];
  await q(porteira, "begin");
  await q(porteira, "select escala__lock($1, $2)", [unidade, data]);
  const promessas = chamadas.map((f, i) => f(conns[i]));
  await new Promise((r) => setTimeout(r, 400)); // todas já estão bloqueadas no lock
  await q(porteira, "commit");
  return Promise.all(promessas);
}

const fn = async (c: pg.Client, nome: string, ...args: unknown[]) =>
  (await q(c, `select ${nome}(${args.map((_, i) => `$${i + 1}`).join(",")}) as r`, args))[0].r as R;

const contar = async (data: string, tabela: "escala_reserva" | "escala_fila", status: string) =>
  Number((await q(adm, `select count(*) n from ${tabela} where unidade_id=$1 and data=$2 and status=$3`, [unidade, data, status]))[0].n);

describe.skipIf(!ATIVO)(`Escala — concorrência real (${N} conexões, schema temporário)`, () => {
  beforeAll(async () => {
    await adm.connect();
    await q(adm, `create schema ${SCHEMA}`);
    await q(adm, `set search_path to ${SCHEMA}, public, extensions`);
    for (const t of TABELAS) await q(adm, `create table ${SCHEMA}.${t} (like public.${t} including all)`);
    const dir = path.join(process.cwd(), "supabase", "migrations");
    for (const f of FUNCOES) {
      // as funções com search_path fixo passam a enxergar o schema temporário primeiro
      const sql = readFileSync(path.join(dir, f), "utf8").replace(/set search_path = public, extensions/g, `set search_path = ${SCHEMA}, public, extensions`);
      await adm.query(sql);
    }
    // sanidade: as funções usadas foram criadas no schema temporário, não em public
    const criadas = await q(adm, `select count(*) n from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = $1 and proname = 'escala_reservar'`, [SCHEMA]);
    expect(Number(criadas[0].n)).toBe(1);

    await q(adm, `insert into escala_config (unidade_id, habilitado, capacidade, data_ancora, limite_mensal) values ($1, true, $2, current_date, null)`, [unidade, CAP]);
    await q(adm, `insert into escala_grupo (unidade_id, letra) values ($1,'A'), ($1,'B')`, [unidade]);
    grupoB = (await q(adm, `select id from escala_grupo where unidade_id=$1 and letra='B'`, [unidade]))[0].id;
    for (let i = 0; i < N; i++) {
      const colab = (await q(adm,
        `insert into colaboradores (nome, cpf, cargo, cidade, unidade, status, email) values ($1,'000.000.000-00','Teste','BH','Centro','Ativo',$2) returning id`,
        [`CONC ${i + 1}`, `conc.${i + 1}@exemplo.invalid`]))[0].id;
      pessoas.push((await q(adm, `insert into escala_participante (colaborador_id, grupo_id) values ($1,$2) returning id`, [colab, grupoB]))[0].id);
    }
    for (let i = 0; i <= N; i++) {
      const c = nova();
      await c.connect();
      await q(c, `set search_path to ${SCHEMA}, public, extensions`);
      conns.push(c);
    }
  }, 120_000);

  afterAll(async () => {
    if (!ATIVO) return;
    await Promise.all(conns.map((c) => c.end().catch(() => {})));
    await adm.query(`drop schema if exists ${SCHEMA} cascade`).catch(() => {});
    const resto = await q(adm, `select count(*) n from pg_namespace where nspname = $1`, [SCHEMA]);
    await adm.end();
    expect(Number(resto[0].n)).toBe(0); // nada ficou no banco
  });

  it(`${N} pessoas, ${CAP} lugares, todas ao mesmo tempo: exatamente ${CAP} confirmadas`, async () => {
    for (const n of [20, 21, 22]) {
      const data = dia(n);
      await criarDia(data);
      const rs = await emDisputa(data, pessoas.map((p) => (c) => fn(c, "escala_reservar", p, data, AGORA)));
      expect(rs.filter((r) => r.ok).length).toBe(CAP);
      expect(rs.filter((r) => r.codigo === "LOTADO").length).toBe(N - CAP);
      expect(await contar(data, "escala_reserva", "CONFIRMADA")).toBe(CAP);
    }
  }, 60_000);

  it("clique duplo: a mesma pessoa 8× ao mesmo tempo → 1 reserva", async () => {
    const data = dia(23);
    await criarDia(data);
    const rs = await emDisputa(data, Array.from({ length: 8 }, () => (c: pg.Client) => fn(c, "escala_reservar", pessoas[0], data, AGORA)));
    expect(rs.filter((r) => r.ok).length).toBe(1);
    expect(rs.filter((r) => !r.ok).every((r) => r.codigo === "JA_RESERVADO")).toBe(true);
    expect(await contar(data, "escala_reserva", "CONFIRMADA")).toBe(1);
  }, 60_000);

  it("cancelamentos simultâneos + novatos tentando furar: as vagas vão para a fila em ordem FIFO", async () => {
    const data = dia(24);
    await criarDia(data);
    const donos = pessoas.slice(0, CAP);
    const fila = pessoas.slice(CAP, CAP + 4); // 4 na fila
    const novatos = pessoas.slice(CAP + 4, N); // tentam reservar no meio da disputa
    for (const p of donos) expect((await fn(adm, "escala_reservar", p, data, AGORA)).ok).toBe(true);
    for (const p of fila) expect((await fn(adm, "escala_entrar_fila", p, data, AGORA)).ok).toBe(true); // ordem de entrada

    const reservas = (await q(adm, `select id, participante_id from escala_reserva where unidade_id=$1 and data=$2 and status='CONFIRMADA'`, [unidade, data]));
    const rs = await emDisputa(data, [
      ...reservas.slice(0, 3).map((r) => (c: pg.Client) => fn(c, "escala_cancelar_reserva", r.id, r.participante_id, AGORA, "pessoa")),
      ...novatos.map((p) => (c: pg.Client) => fn(c, "escala_reservar", p, data, AGORA)),
    ]);
    expect(rs.slice(0, 3).every((r) => r.ok)).toBe(true);
    expect(rs.slice(3).every((r) => r.codigo === "LOTADO")).toBe(true); // ninguém fura a fila

    const viaFila = (await q(adm, `select participante_id from escala_reserva where unidade_id=$1 and data=$2 and status='CONFIRMADA' and origem='FILA'`, [unidade, data])).map((r) => r.participante_id);
    expect(new Set(viaFila)).toEqual(new Set(fila.slice(0, 3))); // os 3 primeiros da fila
    expect(await contar(data, "escala_reserva", "CONFIRMADA")).toBe(CAP);
    expect(await contar(data, "escala_fila", "AGUARDANDO")).toBe(1);
  }, 60_000);

  it("depois do prazo: aceitar a oferta e reservar ao mesmo tempo nunca passa da capacidade", async () => {
    const data = dia(25);
    await criarDia(data, false); // prazo já passou → vaga liberada vira OFERTA (a pessoa não cancela mais; o RH sim)
    for (const p of pessoas.slice(0, CAP)) await fn(adm, "escala_reservar", p, data, AGORA);
    const naFila = pessoas.slice(CAP, CAP + 2);
    for (const p of naFila) await fn(adm, "escala_entrar_fila", p, data, AGORA);
    const r1 = (await q(adm, `select id, participante_id from escala_reserva where unidade_id=$1 and data=$2 and status='CONFIRMADA' limit 1`, [unidade, data]))[0];
    expect((await fn(adm, "escala_cancelar_reserva", r1.id, null, AGORA, "admin")).ok).toBe(true);
    const oferta = (await q(adm, `select id, participante_id from escala_fila where unidade_id=$1 and data=$2 and status='OFERECIDA'`, [unidade, data]))[0];
    expect(oferta.participante_id).toBe(naFila[0]);

    const rs = await emDisputa(data, [
      (c) => fn(c, "escala_aceitar_oferta", oferta.id, oferta.participante_id, null, AGORA),
      (c) => fn(c, "escala_aceitar_oferta", oferta.id, oferta.participante_id, null, AGORA), // clique duplo no aceitar
      ...pessoas.slice(CAP + 2, N).map((p) => (c: pg.Client) => fn(c, "escala_reservar", p, data, AGORA)),
    ]);
    expect(rs.filter((r) => r.ok).length).toBe(1); // só o aceite vale, uma vez
    expect(await contar(data, "escala_reserva", "CONFIRMADA")).toBe(CAP);
  }, 60_000);
});
