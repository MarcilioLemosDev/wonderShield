import Link from "next/link";

import Arena from "@/components/Arena";

// Tela cheia, fora do shell do console: a arena e o espetaculo.
export default function ArenaPage() {
  return (
    <>
      <Link className="arena-back" href="/home">
        ← Console
      </Link>
      <Arena />
    </>
  );
}
