import { Splash } from "@/components/Splash";

/** Carregamento do portal de salas: mesma tela do LocControl, com o nome do módulo. */
export default function Loading() {
  return <Splash marca={["SALAS", ""]} subtitulo="de reunião · Locagora" />;
}
