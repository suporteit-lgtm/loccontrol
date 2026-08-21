import type { Metadata } from "next";
import localFont from "next/font/local";
import { ToastProvider } from "@/components/Toast";
import "./globals.css";

// Code Saver (Typodermic) — fonte única do sistema, arquivo em src/fonts,
// licença na pasta de origem. Só existe o peso regular: o navegador sintetiza
// o negrito, preservando a hierarquia de 600/700 do design system.
const codeSaver = localFont({
  src: [{ path: "../fonts/CodeSaver-Regular.otf", weight: "400", style: "normal" }],
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
      className={codeSaver.variable}
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
