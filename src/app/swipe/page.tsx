import { getServerSession } from "next-auth";
import { redirect } from "next/navigation";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getNextEmail, getProgressStats } from "@/lib/gmailMessages";
import { GmailReauthRequiredError } from "@/lib/gmailAuth";
import { SwipeScreen } from "@/components/SwipeScreen";
import { AccountSwitcher } from "@/components/AccountSwitcher";
import { GmailReauthScreen } from "@/components/GmailReauthScreen";

export default async function SwipePage() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    redirect("/");
  }

  const gmailAccount = await prisma.gmailAccount.findUnique({
    where: { userId: session.user.id },
    select: { email: true },
  });

  if (!gmailAccount) {
    redirect("/setup");
  }

  const config = await prisma.gestureConfig.upsert({
    where: { userId: session.user.id },
    update: {},
    create: { userId: session.user.id },
  });

  // Importante: NO se atrapa el error acá y se lo convierte en "sin
  // correos" — un token de Gmail vencido antes se disfrazaba de "bandeja al
  // día" (falso) porque el catch devolvía null/0 en silencio. Ahora, si es
  // específicamente un problema de reautenticación, se muestra la pantalla
  // real en vez de mentir que la bandeja está vacía.
  let firstEmail;
  let progress;
  try {
    [firstEmail, progress] = await Promise.all([
      getNextEmail(session.user.id),
      getProgressStats(session.user.id),
    ]);
  } catch (err) {
    if (err instanceof GmailReauthRequiredError) {
      return <GmailReauthScreen email={gmailAccount.email} callbackUrl="/swipe" />;
    }
    console.error("Error cargando /swipe:", err);
    firstEmail = null;
    progress = { reviewed: 0, remaining: 0, total: 0 };
  }

  return (
    <main className="min-h-screen bg-neutral-50 pb-16 dark:bg-neutral-950">
      <header className="sticky top-0 z-10 border-b border-neutral-200/80 bg-white/80 backdrop-blur dark:border-neutral-800/80 dark:bg-neutral-950/80">
        <div className="mx-auto flex max-w-lg items-center justify-between px-6 py-3">
          <a href="/swipe" className="flex items-center gap-2 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
            <span className="text-lg">📬</span> Gmail Swipe
          </a>
          <div className="flex items-center gap-2">
            <a
              href="/setup"
              title="Configurar gestos"
              className="flex h-9 w-9 items-center justify-center rounded-full text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:text-neutral-500 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
            >
              ⚙️
            </a>
            <AccountSwitcher
              current={{
                email: gmailAccount.email,
                name: session.user.name ?? null,
                image: session.user.image ?? null,
              }}
            />
          </div>
        </div>
      </header>

      <div className="mx-auto flex max-w-lg flex-col items-center gap-8 px-6 pt-8">
        <SwipeScreen
          initialEmail={firstEmail}
          initialProgress={progress}
          gestureConfig={{
            leftAction: config.leftAction,
            rightAction: config.rightAction,
            upAction: config.upAction,
            downEnabled: config.downEnabled,
            downAction: config.downAction,
          }}
        />
      </div>
    </main>
  );
}
