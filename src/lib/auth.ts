import type { NextAuthOptions } from "next-auth";
import GoogleProvider from "next-auth/providers/google";
import { prisma } from "@/lib/prisma";
import { encrypt } from "@/lib/crypto";
import { GMAIL_SCOPES } from "@/lib/googleClient";

export const authOptions: NextAuthOptions = {
  // Sesión JWT (no adaptador de base de datos): los tokens de Gmail se
  // guardan aparte, cifrados, en nuestra propia tabla GmailAccount — nunca
  // en la cookie de sesión.
  session: { strategy: "jwt" },
  secret: process.env.NEXTAUTH_SECRET,
  providers: [
    GoogleProvider({
      clientId: process.env.GOOGLE_CLIENT_ID ?? "",
      clientSecret: process.env.GOOGLE_CLIENT_SECRET ?? "",
      authorization: {
        params: {
          scope: GMAIL_SCOPES.join(" "),
          access_type: "offline", // necesario para recibir refresh_token
          prompt: "consent", // fuerza reenviar refresh_token en cada login
        },
      },
    }),
  ],
  callbacks: {
    async jwt({ token, account, profile }) {
      // `account` y `profile` solo vienen presentes justo tras el login OAuth.
      if (account && profile?.email) {
        const googleSub = (profile as { sub?: string }).sub ?? account.providerAccountId;

        const user = await prisma.user.upsert({
          where: { email: profile.email },
          update: {
            name: profile.name ?? undefined,
            image: (profile as { picture?: string }).picture ?? undefined,
          },
          create: {
            email: profile.email,
            name: profile.name ?? undefined,
            image: (profile as { picture?: string }).picture ?? undefined,
          },
        });

        if (!account.access_token || !account.refresh_token || !account.expires_at) {
          // Si Google no envía refresh_token (p.ej. el usuario ya había dado
          // consentimiento fuera de este flujo), pedimos que reintente: con
          // prompt=consent esto no debería pasar en un login normal.
          throw new Error(
            "Google no devolvió refresh_token. Revoca el acceso de la app en https://myaccount.google.com/permissions e inténtalo de nuevo."
          );
        }

        await prisma.gmailAccount.upsert({
          where: { userId: user.id },
          update: {
            googleSub,
            email: profile.email,
            encryptedAccessToken: encrypt(account.access_token),
            encryptedRefreshToken: encrypt(account.refresh_token),
            accessTokenExpiresAt: new Date(account.expires_at * 1000),
            scope: account.scope ?? GMAIL_SCOPES.join(" "),
          },
          create: {
            userId: user.id,
            googleSub,
            email: profile.email,
            encryptedAccessToken: encrypt(account.access_token),
            encryptedRefreshToken: encrypt(account.refresh_token),
            accessTokenExpiresAt: new Date(account.expires_at * 1000),
            scope: account.scope ?? GMAIL_SCOPES.join(" "),
          },
        });

        // Por si ya existía un GestureConfig lo dejamos, si no, creamos uno con defaults.
        await prisma.gestureConfig.upsert({
          where: { userId: user.id },
          update: {},
          create: { userId: user.id },
        });

        token.uid = user.id;
      }

      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.uid as string;
      }
      return session;
    },
  },
  pages: {
    signIn: "/",
    error: "/",
  },
};
