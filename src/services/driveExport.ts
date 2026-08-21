// ╔══════════════════════════════════════════════════════════════════════════╗
// ║  Google Drive — exportação de planilhas                                  ║
// ║  Usa a mesma service account do Workspace impersonando                   ║
// ║  GOOGLE_ADMIN_IMPERSONATE, com o escopo drive já autorizado na           ║
// ║  delegação. Cada exportação vira uma pasta datada dentro de              ║
// ║  "LOCCONTROL — Exportações" no Meu Drive dessa conta; os CSVs são        ║
// ║  convertidos em Planilhas Google no upload.                              ║
// ║  Sem credenciais, cai no MOCK (log no console).                          ║
// ╚══════════════════════════════════════════════════════════════════════════╝

import { google, type drive_v3 } from "googleapis";
import { Readable } from "node:stream";
import { chaveServico, googleConfigurado } from "@/lib/googleKey";

const PASTA_RAIZ = "LOCCONTROL — Exportações";

function drive(): drive_v3.Drive {
  const key = chaveServico();
  const auth = new google.auth.JWT({
    email: key.client_email,
    key: key.private_key,
    scopes: ["https://www.googleapis.com/auth/drive"],
    subject: process.env.GOOGLE_ADMIN_IMPERSONATE,
  });
  return google.drive({ version: "v3", auth });
}

function msgErro(e: unknown): string {
  const err = e as { errors?: { message?: string }[]; message?: string };
  return err?.errors?.[0]?.message ?? err?.message ?? "erro desconhecido na API do Drive";
}

/** Acha (ou cria) uma pasta pelo nome, opcionalmente dentro de outra. */
async function pastaId(d: drive_v3.Drive, nome: string, paiId?: string): Promise<string> {
  const q = [
    `name = '${nome.replace(/'/g, "\\'")}'`,
    "mimeType = 'application/vnd.google-apps.folder'",
    "trashed = false",
    ...(paiId ? [`'${paiId}' in parents`] : []),
  ].join(" and ");
  const r = await d.files.list({ q, fields: "files(id)", pageSize: 1 });
  const existente = r.data.files?.[0]?.id;
  if (existente) return existente;
  const nova = await d.files.create({
    requestBody: {
      name: nome,
      mimeType: "application/vnd.google-apps.folder",
      parents: paiId ? [paiId] : undefined,
    },
    fields: "id",
  });
  return nova.data.id!;
}

export interface PlanilhaExport {
  nome: string;
  csv: string; // separado por vírgula (o conversor do Sheets não aceita ";")
}

export async function salvarPlanilhasNoDrive(
  rotuloPasta: string,
  planilhas: PlanilhaExport[]
): Promise<{ ok: boolean; link?: string; erro?: string }> {
  if (!googleConfigurado()) {
    console.log(`[drive:mock] pasta="${rotuloPasta}" planilhas=${planilhas.map((p) => p.nome).join(", ")}`);
    return { ok: true, link: "https://drive.google.com (mock)" };
  }
  try {
    const d = drive();
    const raiz = await pastaId(d, PASTA_RAIZ);
    const pasta = await pastaId(d, rotuloPasta, raiz);

    // sequencial: poucos arquivos e evita rate limit do Drive
    for (const p of planilhas) {
      await d.files.create({
        requestBody: {
          name: p.nome,
          parents: [pasta],
          mimeType: "application/vnd.google-apps.spreadsheet", // converte o CSV em Planilha Google
        },
        media: { mimeType: "text/csv", body: Readable.from(["﻿" + p.csv]) },
        fields: "id",
      });
    }

    const meta = await d.files.get({ fileId: pasta, fields: "webViewLink" });
    return { ok: true, link: meta.data.webViewLink ?? undefined };
  } catch (e) {
    return { ok: false, erro: msgErro(e) };
  }
}
