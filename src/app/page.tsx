import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { ConnectGmailButton } from "@/components/ConnectGmailButton";

const FEATURES: { icon: string; label: string }[] = [
  { icon: "🗑️", label: "Eliminar" },
  { icon: "📥", label: "Archivar" },
  { icon: "✅", label: "Mantener" },
  { icon: "🏷️", label: "Etiquetar" },
];

const TRUST_ITEMS: { icon: string; label: string }[] = [
  { icon: "👤", label: "Tu propia cuenta, tu propio login" },
  { icon: "🔒", label: "Tokens cifrados, nunca en el navegador" },
  { icon: "♻️", label: "Nada se borra sin pasar por la papelera" },
];

export default async function LandingPage() {
  const session = await getServerSession(authOptions);
  if (session?.user) {
    redirect("/setup");
  }

  return (
    <main className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-16 text-center">
      {/* Fondo decorativo: dos manchas de color suaves, no interactúan con nada */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-32 left-1/2 h-[32rem] w-[32rem] -translate-x-1/2 rounded-full bg-indigo-200/40 blur-3xl dark:bg-indigo-500/10"
      />
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-40 right-1/2 h-[26rem] w-[26rem] translate-x-1/2 rounded-full bg-purple-200/30 blur-3xl dark:bg-purple-500/10"
      />

      <div className="relative flex flex-col items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-white text-3xl shadow-lg shadow-neutral-900/5 dark:bg-neutral-900">
          📬
        </div>
        <h1 className="text-4xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
          Gmail Swipe
        </h1>
        <p className="max-w-sm text-balance text-base text-neutral-500 dark:text-neutral-400">
          Triá tu bandeja de entrada deslizando tarjetas, como en Tinder.
          Conectá tu propia cuenta de Gmail para empezar.
        </p>
      </div>

      <div className="relative mt-8 flex flex-wrap items-center justify-center gap-2">
        {FEATURES.map((f) => (
          <span
            key={f.label}
            className="inline-flex items-center gap-1.5 rounded-full border border-neutral-200 bg-white/70 px-3 py-1.5 text-xs font-medium text-neutral-600 shadow-sm backdrop-blur dark:border-neutral-800 dark:bg-neutral-900/70 dark:text-neutral-300"
          >
            <span>{f.icon}</span>
            {f.label}
          </span>
        ))}
      </div>

      <div className="relative mt-10">
        <ConnectGmailButton />
      </div>

      <ul className="relative mt-10 flex flex-col items-start gap-2 text-left">
        {TRUST_ITEMS.map((t) => (
          <li
            key={t.label}
            className="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-500"
          >
            <span>{t.icon}</span>
            {t.label}
          </li>
        ))}
      </ul>
    </main>
  );
}
