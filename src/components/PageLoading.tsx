/** Loading leve pra troca de tela dentro do app já logado — ao contrário do
 *  Splash (boot inicial, tela cheia), este fica só na área de conteúdo:
 *  a sidebar e o header continuam visíveis, nada "pisca" por cima deles. */
export function PageLoading() {
  return (
    <div
      style={{
        flex: 1,
        display: "grid",
        placeItems: "center",
        minHeight: "40vh",
        padding: "var(--space-6)",
      }}
    >
      <span
        aria-hidden
        style={{
          width: 30,
          height: 30,
          borderRadius: "50%",
          border: "3px solid color-mix(in srgb, var(--color-text) 10%, transparent)",
          borderTopColor: "var(--color-accent)",
          animation: "giro 0.8s linear infinite",
        }}
      />
    </div>
  );
}
