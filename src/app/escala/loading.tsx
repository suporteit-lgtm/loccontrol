import { Splash } from "@/components/Splash";

/** Carregamento do portal da Escala: mesma tela do LocControl, com o nome do módulo. */
export default function Loading() {
  return <Splash marca={["ESCALA", ""]} subtitulo="de presença · Locagora" />;
}
