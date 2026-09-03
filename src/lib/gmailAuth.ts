import { prisma } from "@/lib/prisma";
import { decrypt, encrypt } from "@/lib/crypto";
import { createOAuth2Client } from "@/lib/googleClient";

// Margen de seguridad: refrescamos el access token si le quedan menos de 2 min.
const EXPIRY_BUFFER_MS = 2 * 60 * 1000;

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

  const { credentials } = await oauth2Client.refreshAccessToken();
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
