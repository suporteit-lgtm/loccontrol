"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PageHeader } from "@/components/ui";
import { useToast } from "@/components/Toast";
import { GUIAS, AREAS, type Guia } from "@/lib/guias";
import { salvarVideoAjuda } from "@/app/actions/ajuda";

const COR_AREA: Record<Guia["area"], string> = {
  RH: "var(--color-accent)",
  TI: "var(--warn-forte)",
  Geral: "var(--ok-forte)",
};

/** Link colado pelo admin → URL de player embutido (YouTube ou Drive). */
function urlEmbed(url: string): string | null {
  const yt = url.match(/(?:youtube\.com\/watch\?[^#]*v=|youtu\.be\/|youtube\.com\/shorts\/)([\w-]{6,})/);
  if (yt) return `https://www.youtube.com/embed/${yt[1]}`;
  const drive = url.match(/drive\.google\.com\/file\/d\/([\w-]+)/);
  if (drive) return `https://drive.google.com/file/d/${drive[1]}/preview`;
  return null;
}

function GuiaCard({ guia, video, admin }: { guia: Guia; video?: string; admin: boolean }) {
  const [aberto, setAberto] = useState(false);
  const [editando, setEditando] = useState(false);
  const [url, setUrl] = useState(video ?? "");
  const [pending, start] = useTransition();
  const router = useRouter();
  const { toast } = useToast();

  const salvar = () =>
    start(async () => {
      const res = await salvarVideoAjuda(guia.chave, url);
      toast(res.msg, res.ok ? "ok" : "erro");
      if (res.ok) setEditando(false);
      router.refresh();
    });

  const embed = video ? urlEmbed(video) : null;

  return (
    <div className="card" style={{ gap: 0, padding: 0, overflow: "hidden" }}>
      <button
        onClick={() => setAberto((v) => !v)}
        aria-expanded={aberto}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 12,
          width: "100%",
          padding: "14px 16px",
          background: "transparent",
          border: "none",
          cursor: "pointer",
          textAlign: "left",
          color: "inherit",
          font: "inherit",
        }}
      >
        <span
          aria-hidden
          style={{
            width: 8,
            height: 8,
            flex: "none",
            borderRadius: "50%",
            background: COR_AREA[guia.area],
          }}
        />
        <span style={{ minWidth: 0, flex: 1 }}>
          <span style={{ display: "block", fontWeight: 700, fontSize: 14.5 }}>{guia.titulo}</span>
          <span className="text-muted" style={{ display: "block", fontSize: 12.5, marginTop: 2 }}>
            {guia.resumo}
          </span>
        </span>
        {video && (
          <span
            title="Este guia tem vídeo"
            style={{
              fontSize: 10.5,
              fontWeight: 700,
              letterSpacing: "0.05em",
              padding: "2px 8px",
              borderRadius: 999,
              border: `1px solid ${COR_AREA[guia.area]}`,
              color: COR_AREA[guia.area],
              flex: "none",
            }}
          >
            ▶ vídeo
          </span>
        )}
        <span className="text-muted" aria-hidden style={{ flex: "none", fontSize: 12 }}>
          {aberto ? "▲" : "▼"}
        </span>
      </button>

      {aberto && (
        <div style={{ padding: "0 16px 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {embed && (
            <div style={{ position: "relative", width: "100%", aspectRatio: "16 / 9", borderRadius: 10, overflow: "hidden", background: "#000" }}>
              <iframe
                src={embed}
                title={`Vídeo — ${guia.titulo}`}
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                allowFullScreen
                style={{ position: "absolute", inset: 0, width: "100%", height: "100%", border: 0 }}
              />
            </div>
          )}
          {video && !embed && (
            <a href={video} target="_blank" rel="noreferrer" className="btn btn-secondary" style={{ alignSelf: "flex-start" }}>
              ▶ Assistir ao vídeo
            </a>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            {guia.passos.map((p, i) => (
              <div key={i} style={{ display: "flex", gap: 12, position: "relative", paddingBottom: 12 }}>
                {i < guia.passos.length - 1 && (
                  <span
                    aria-hidden
                    style={{ position: "absolute", left: 12, top: 26, bottom: 0, width: 2, background: "var(--color-divider)" }}
                  />
                )}
                <span
                  style={{
                    width: 26,
                    height: 26,
                    flex: "none",
                    display: "grid",
                    placeItems: "center",
                    borderRadius: "50%",
                    border: `2px solid ${COR_AREA[guia.area]}`,
                    color: COR_AREA[guia.area],
                    fontWeight: 700,
                    fontSize: 12.5,
                    background: "var(--color-surface)",
                    zIndex: 1,
                  }}
                >
                  {i + 1}
                </span>
                <span style={{ fontSize: 13.5, lineHeight: 1.55, paddingTop: 3 }}>{p}</span>
              </div>
            ))}
          </div>

          {admin &&
            (editando ? (
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap", alignItems: "center" }}>
                <input
                  className="input"
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  placeholder="Cole o link do vídeo (YouTube ou Google Drive)"
                  style={{ flex: 1, minWidth: 220, fontSize: 13 }}
                />
                <button className="btn btn-primary" disabled={pending} style={{ fontSize: 13, padding: "6px 14px" }} onClick={salvar}>
                  {pending ? "Salvando..." : "Salvar"}
                </button>
                <button
                  className="btn btn-ghost"
                  disabled={pending}
                  style={{ fontSize: 13, padding: "6px 10px" }}
                  onClick={() => {
                    setEditando(false);
                    setUrl(video ?? "");
                  }}
                >
                  Cancelar
                </button>
              </div>
            ) : (
              <button
                className="btn btn-ghost"
                style={{ fontSize: 12.5, padding: "4px 8px", alignSelf: "flex-start" }}
                onClick={() => setEditando(true)}
              >
                {video ? "Trocar ou remover o vídeo" : "+ Adicionar vídeo a este guia"}
              </button>
            ))}
        </div>
      )}
    </div>
  );
}

export function AjudaClient({ videos, admin }: { videos: Record<string, string>; admin: boolean }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "var(--space-4)" }}>
      <PageHeader
        eyebrow="Central de ajuda"
        titulo="Como mexer no sistema"
        sub="Passo a passo escrito de cada tarefa — e vídeo, quando disponível. Clique num guia para abrir."
      />
      {AREAS.map((area) => {
        const doGrupo = GUIAS.filter((g) => g.area === area);
        return (
          <section key={area} style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            <h6 style={{ margin: "6px 0 0", display: "flex", alignItems: "center", gap: 8, color: COR_AREA[area] }}>
              <span style={{ width: 8, height: 8, flex: "none", borderRadius: "50%", background: COR_AREA[area] }} />
              {area === "Geral" ? "Para todo mundo" : `Para o ${area}`}
              <span style={{ fontFamily: "var(--mono)", marginLeft: "auto" }}>{doGrupo.length}</span>
            </h6>
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(340px, 1fr))", gap: 10, alignItems: "start" }}>
              {doGrupo.map((g) => (
                <GuiaCard key={g.chave} guia={g} video={videos[g.chave]} admin={admin} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
