"use client";

import { signOut } from "next-auth/react";

/**
 * Como <a href="/">, pero cerrando sesión de verdad antes de ir a la
 * landing. Un <a> normal no alcanza cuando la cookie de sesión quedó
 * "huérfana" (apunta a un usuario que ya no existe en la base, p.ej. tras
 * migrar de base de datos): la landing ve la cookie, cree que seguís
 * logueado y te rebota de nuevo para acá — bucle infinito.
 */
export function SignOutLink({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <button onClick={() => signOut({ callbackUrl: "/" })} className={className}>
      {children}
    </button>
  );
}
