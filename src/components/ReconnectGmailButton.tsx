"use client";

import { signIn } from "next-auth/react";

/**
 * Reautentica la MISMA cuenta (login_hint) para conseguir un refresh token
 * nuevo — distinto del selector de cuentas, que deja elegir cualquiera.
 * prompt=consent fuerza a Google a reemitir el refresh_token (si solo
 * pidiéramos login, a veces no lo reenvía).
 */
export function ReconnectGmailButton({
  email,
  callbackUrl,
}: {
  email: string;
  callbackUrl: string;
}) {
  return (
    <button
      onClick={() => void signIn("google", { callbackUrl }, { prompt: "consent", login_hint: email })}
      className="inline-flex items-center gap-2 rounded-full bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500"
    >
      Reconectar cuenta
    </button>
  );
}
