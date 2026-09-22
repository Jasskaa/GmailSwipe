import { ReconnectGmailButton } from "@/components/ReconnectGmailButton";
import { SignOutLink } from "@/components/SignOutLink";

/**
 * Se muestra cuando el refresh token de Gmail ya no sirve (típicamente:
 * pasaron ~7 días y la app de Google Cloud sigue en modo "Testing", donde
 * Google los hace caducar sin excepción). Antes esto se confundía con
 * "bandeja al día" porque el error se tragaba en silencio — ahora se
 * distingue y se ofrece la salida real: reconectar.
 */
export function GmailReauthScreen({ email, callbackUrl }: { email: string; callbackUrl: string }) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="text-4xl">🔒</div>
      <h1 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">
        Tu conexión con Gmail expiró
      </h1>
      <p className="max-w-sm text-sm text-neutral-500 dark:text-neutral-400">
        Esto pasa cada ~7 días mientras la app de Google siga en modo &quot;Testing&quot;.
        Reconectá <strong>{email}</strong> y seguís exactamente donde estabas — no se pierde
        nada de tu configuración ni tu historial.
      </p>
      <ReconnectGmailButton email={email} callbackUrl={callbackUrl} />
      <SignOutLink className="text-xs text-neutral-400 underline-offset-4 hover:underline dark:text-neutral-500">
        O cerrar sesión
      </SignOutLink>
    </main>
  );
}
