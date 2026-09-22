import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import { createOAuth2Client } from "@/lib/googleClient";

// Margen de seguridad: refrescamos el access token si le quedan menos de 2 min.
const EXPIRY_BUFFER_MS = 2 * 60 * 1000;

/**
 * El refresh token dejó de ser válido y Google no lo va a renovar más —
 * hay que volver a conectar la cuenta (nuevo login OAuth) para conseguir
 * uno nuevo. Pasa típicamente cuando: (a) la app está en modo "Testing" en
 * Google Cloud, donde los refresh tokens caducan a los 7 días sin
 * excepción, o (b) el usuario revocó el acceso manualmente desde
 * myaccount.google.com/permissions. Antes esto se confundía con "no hay
 * correos nuevos" porque el error se tragaba silenciosamente — ahora se
 * distingue explícitamente para poder mostrar "reconectá tu cuenta" en vez
 * de una bandeja vacía falsa.
 */
export class GmailReauthRequiredError extends Error {
  constructor(
    message = "Tu conexión con Gmail expiró. Reconectá tu cuenta para seguir usando la app."
  ) {
    super(message);
    this.name = "GmailReauthRequiredError";
  }
}

/**
 * Devuelve un access token de Gmail válido para el usuario, refrescándolo
 * automáticamente con el refresh token guardado (cifrado) si ha caducado.
 * Nunca se llama desde el cliente: solo desde route handlers / server code.
 */
export async function getValidAccessToken(userId: string): Promise<string> {
  const gmailAccount = await prisma.gmailAccount.findUnique({ where: { userId } });
  if (!gmailAccount) {
    throw new Error("Este usuario no tiene una cuenta de Gmail conectada.");
  }

  const expiresAt = gmailAccount.accessTokenExpiresAt.getTime();
  const stillValid = expiresAt - EXPIRY_BUFFER_MS > Date.now();

  if (stillValid) {
    return decrypt(gmailAccount.encryptedAccessToken);
  }

  // Access token caducado (o a punto de caducar): refrescar con el refresh token.
  const refreshToken = decrypt(gmailAccount.encryptedRefreshToken);
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ refresh_token: refreshToken });

  let credentials;
  try {
    ({ credentials } = await oauth2Client.refreshAccessToken());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    if (message.includes("invalid_grant")) {
      throw new GmailReauthRequiredError();
    }
    throw err;
  }

  if (!credentials.access_token || !credentials.expiry_date) {
    throw new Error("Google no devolvió un access token válido al refrescar.");
  }

  await prisma.gmailAccount.update({
    where: { userId },
    data: {
      encryptedAccessToken: encrypt(credentials.access_token),
      accessTokenExpiresAt: new Date(credentials.expiry_date),
      // Google a veces reemite un refresh_token nuevo; si lo hace, lo guardamos.
      ...(credentials.refresh_token
        ? { encryptedRefreshToken: encrypt(credentials.refresh_token) }
        : {}),
    },
  });

  return credentials.access_token;
}

/** Cliente OAuth2 de googleapis ya autenticado, listo para llamar a la API de Gmail. */
export async function getAuthorizedGmailClient(userId: string) {
  const accessToken = await getValidAccessToken(userId);
  const oauth2Client = createOAuth2Client();
  oauth2Client.setCredentials({ access_token: accessToken });
  return oauth2Client;
}
