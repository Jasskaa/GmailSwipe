import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { listGmailLabels } from "@/lib/gmailApi";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { SignOutLink } from "@/components/SignOutLink";
import { GestureConfigForm, type GestureConfigValue } from "@/components/GestureConfigForm";

export default async function SetupPage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }

  const gmailAccount = await prisma.gmailAccount.findUnique({
    where: { userId: session.user.id },
    select: { email: true },
  });

  if (!gmailAccount) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
        <p className="text-red-500">
          No se encontró tu cuenta de Gmail en la base de datos. Esto pasa si tu sesión quedó
          desactualizada (por ejemplo, tras un cambio de base de datos). Cerrá sesión y volvé a
          conectar.
        </p>
        <SignOutLink className="rounded-full bg-neutral-900 px-5 py-2 text-sm font-medium text-white dark:bg-white dark:text-neutral-900">
          Cerrar sesión y reconectar
        </SignOutLink>
      </main>
    );
  }

  const [config, labels] = await Promise.all([
    prisma.gestureConfig.upsert({
      where: { userId: session.user.id },
      update: {},
      create: { userId: session.user.id },
    }),
    listGmailLabels(session.user.id).catch(() => []),
  ]);

  const initialConfig: GestureConfigValue = {
    leftAction: config.leftAction as GestureConfigValue["leftAction"],
    leftLabelId: config.leftLabelId,
    rightAction: config.rightAction as GestureConfigValue["rightAction"],
    rightLabelId: config.rightLabelId,
    upAction: config.upAction as GestureConfigValue["upAction"],
    upLabelId: config.upLabelId,
    downEnabled: config.downEnabled,
    downAction: config.downAction as GestureConfigValue["downAction"],
    downLabelId: config.downLabelId,
    filterType: config.filterType as GestureConfigValue["filterType"],
    filterLabelId: config.filterLabelId,
    filterQuery: config.filterQuery,
  };

  return (
    <main className="min-h-screen bg-neutral-50 pb-16 dark:bg-neutral-950">
      <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/80 backdrop-blur dark:border-neutral-800/80 dark:bg-neutral-950/80">
        <div className="mx-auto flex max-w-lg items-center justify-between px-6 py-3">
          <a href="/setup" className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            <span className="text-lg">📬</span> Gmail Swipe
          </a>
          <AccountSwitcher
            current={{
              email: gmailAccount.email,
              name: session.user.name ?? null,
              image: session.user.image ?? null,
            }}
          />
        </div>
      </header>

      <div className="mx-auto flex max-w-lg flex-col items-center gap-6 px-6 pt-8">
        <div className="text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-neutral-900 dark:text-neutral-100">
            Configurá tus gestos
          </h1>
          <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
            Elegí qué hace cada dirección y qué correos querés revisar. Podés cambiarlo cuando
            quieras — no hace falta que sea perfecto ahora.
          </p>
        </div>

        <GestureConfigForm initialConfig={initialConfig} labels={labels} />

        <a
          href="/swipe"
          className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500"
        >
          Empezar a triar mis correos
          <span aria-hidden="true">→</span>
        </a>
      </div>
    </main>
  );
}
