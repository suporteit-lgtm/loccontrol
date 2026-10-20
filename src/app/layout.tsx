import type { Metadata } from "next";
import { Roboto } from "next/font/google";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

// Roboto — fonte única do sistema (trocou a Code Saver local). Pesos reais
// 400/500/700/800: sem negrito sintetizado pelo navegador.
const roboto = Roboto({
  subsets: ["latin"],
  weight: ["400", "500", "700", "800"],
  variable: "--font-sans",
  display: "swap",
});

export const metadata: Metadata = {
  title: "LOCCONTROL · Ciclo de vida de colaboradores",
  description: "Sistema interno do Grupo LOC — RH e TI",
  icons: { icon: "/favicon.png" },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  // as variáveis das fontes precisam ficar no <html>: os tokens que as
  // consomem (--font-heading, --font-body) são declarados em :root, e a
  // substituição de var() acontece no elemento onde o token foi declarado.
  return (
    <html
      lang="pt-BR"
      suppressHydrationWarning
      className={roboto.variable}
    >
      <head>
        {/* aplica o tema salvo antes do primeiro paint */}
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{if(localStorage.getItem('ciclo-tema')==='escuro')document.documentElement.setAttribute('data-tema','escuro')}catch(e){}})()`,
          }}
        />
      </head>
      <body>
        <ToastProvider>{children}</ToastProvider>
      </body>
    </html>
  );
}
