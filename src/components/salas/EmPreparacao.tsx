/** Enquanto a migration das salas não foi aplicada. */
export function EmPreparacao() {
  return (
    <div className="card elev-sm" style={{ textAlign: "center", padding: "var(--space-8)", gap: 8 }}>
      <div className="card-kicker">Salas de reunião</div>
      <div className="card-title">Agendamento em preparação</div>
      <p className="card-body">O módulo ainda está sendo configurado. Volte em breve.</p>
    </div>
  );
}
