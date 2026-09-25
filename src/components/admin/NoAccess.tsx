import Image from "next/image";
import Link from "next/link";
import { Lock } from "lucide-react";

/** Friendly screen for signed-in users without the admin role (never renders any admin data). */
export function NoAccess({ reason }: { reason: "forbidden" | "unconfigured" }) {
  return (
    <div className="relative grid min-h-dvh place-items-center overflow-hidden bg-navy-950 px-4 text-white">
      <div className="grid-bg pointer-events-none absolute inset-0 opacity-60" aria-hidden />
      <div className="pointer-events-none absolute -right-24 top-1/4 h-72 w-72 rounded-full bg-brand-400/20 blur-3xl" aria-hidden />
      <div className="relative w-full max-w-md rounded-3xl bg-white/[0.04] p-8 text-center ring-1 ring-white/10 backdrop-blur">
        <Image src="/media/brand/elama-logo.png" alt="ELAMA" width={826} height={155} className="mx-auto h-7 w-auto" priority />
        <div className="mx-auto mt-8 grid h-14 w-14 -skew-x-12 place-items-center rounded-2xl bg-brand-400 text-navy-900 shadow-glow">
          <Lock className="h-6 w-6 skew-x-12" aria-hidden />
        </div>
        <h1 className="mt-6 text-2xl font-extrabold tracking-[-0.02em]">Nav piekļuves</h1>
        <p className="mt-2 text-[14px] leading-relaxed text-white/65">
          {reason === "unconfigured"
            ? "Datubāzes savienojums nav konfigurēts, tāpēc administrācijas panelis nav pieejams."
            : "Šī sadaļa ir pieejama tikai veikala administratoriem. Ja uzskatāt, ka tā ir kļūda, sazinieties ar SIA Elama."}
        </p>
        <div className="mt-7 flex flex-col justify-center gap-2 sm:flex-row">
          <Link
            href="/"
            className="inline-flex h-11 items-center justify-center rounded-xl bg-brand-400 px-5 text-sm font-bold text-navy-900 transition hover:bg-brand-300"
          >
            Atgriezties veikalā
          </Link>
          <Link
            href="/account"
            className="inline-flex h-11 items-center justify-center rounded-xl px-5 text-sm font-bold text-white/80 ring-1 ring-white/20 transition hover:bg-white/10"
          >
            Mans konts
          </Link>
        </div>
      </div>
    </div>
  );
}
