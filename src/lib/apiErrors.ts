import { NextResponse } from "next/server";
import { GmailReauthRequiredError } from "@/lib/gmailAuth";

/**
 * Respuesta uniforme para errores de rutas que tocan la API de Gmail.
 * Si el token de Gmail ya no se puede refrescar, devuelve 401 con
 * `reauthRequired: true` para que el cliente pueda mostrar "reconectá tu
 * cuenta" en vez de un error genérico (o, peor, confundirlo con "no hay
 * correos").
 */
export function gmailErrorResponse(err: unknown, fallbackMessage: string): NextResponse {
  if (err instanceof GmailReauthRequiredError) {
    return NextResponse.json({ error: err.message, reauthRequired: true }, { status: 401 });
  }
  console.error(fallbackMessage, err);
  return NextResponse.json({ error: fallbackMessage }, { status: 502 });
}
