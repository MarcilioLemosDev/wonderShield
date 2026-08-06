// O emblema do estelar como componente. Cor determinística vinda da semente; o
// glifo é o símbolo do signo quando se sabe, senão as iniciais do nome estelar.
// Sem rosto, por princípio — a pessoa se revela no encontro, não na foto.
import { emblemaDe } from "@/lib/emblema";
import { simboloDoSigno } from "@/lib/estelar";

export default function Avatar({
  nome,
  seed,
  sign,
  className,
}: {
  nome?: string | null;
  seed?: string | null;
  sign?: string | null;
  className?: string;
}) {
  const semente = seed || nome || "estelar";
  const { fundo } = emblemaDe(semente);
  const simbolo = sign ? simboloDoSigno(sign) : null;
  const glifo = simbolo || (nome ?? "??").slice(0, 2).toUpperCase();
  return (
    <span className={`avatar${className ? ` ${className}` : ""}`} style={{ background: fundo }} aria-hidden>
      {glifo}
    </span>
  );
}
