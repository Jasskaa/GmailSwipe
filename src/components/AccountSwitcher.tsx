"use client";

import { useEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { signIn, signOut } from "next-auth/react";
import { forgetAccount, getKnownAccounts, rememberAccount, type KnownAccount } from "@/lib/knownAccounts";

function initials(name: string | null, email: string): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  return parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "").join("") || "?";
}

function Avatar({ name, email, image, size = 32 }: KnownAccount & { size?: number }) {
  if (image) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={image}
        alt=""
        referrerPolicy="no-referrer"
        style={{ width: size, height: size }}
        className="shrink-0 rounded-full"
      />
    );
  }
  return (
    <div
      style={{ width: size, height: size }}
      className="flex shrink-0 items-center justify-center rounded-full bg-indigo-100 text-xs font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300"
    >
      {initials(name, email)}
    </div>
  );
}

/**
 * Selector de cuenta activa: muestra la cuenta de Gmail conectada ahora y
 * permite cambiar a otra. "Cambiar" no hace un truco de sesiones múltiples
 * (NextAuth v4 con JWT solo sostiene una sesión por navegador) — reautentica
 * con Google forzando `prompt=select_account`, que muestra el selector
 * nativo de cuentas de Google con TODAS las que ya tenés logueadas en el
 * dispositivo (exactamente el caso de "tengo más de una cuenta en el
 * móvil"). Guardamos un atajo por cuenta en localStorage para no tener que
 * pasar por ese selector cada vez.
 */
export function AccountSwitcher({ current }: { current: KnownAccount }) {
  const [open, setOpen] = useState(false);
  const [known, setKnown] = useState<KnownAccount[]>([]);
  const containerRef = useRef<HTMLDivElement>(null);
  const pathname = usePathname();

  useEffect(() => {
    rememberAccount(current);
    setKnown(getKnownAccounts());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [current.email]);

  useEffect(() => {
    if (!open) return;
    function onPointerDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const others = known.filter((a) => a.email !== current.email);
  const callbackUrl = pathname || "/setup";

  function switchTo(email?: string) {
    setOpen(false);
    void signIn(
      "google",
      { callbackUrl },
      { prompt: "select_account consent", ...(email ? { login_hint: email } : {}) }
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-2 rounded-full border border-neutral-200 bg-white py-1 pl-1 pr-3 text-sm shadow-sm transition hover:border-neutral-300 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-neutral-700"
        aria-haspopup="menu"
        aria-expanded={open}
      >
        <Avatar {...current} />
        <span className="max-w-[9rem] truncate font-medium text-neutral-800 dark:text-neutral-200">
          {current.name || current.email}
        </span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          className={`text-neutral-400 transition-transform ${open ? "rotate-180" : ""}`}
        >
          <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 z-20 mt-2 w-72 max-w-[calc(100vw-2rem)] overflow-hidden rounded-2xl border border-neutral-200 bg-white py-1.5 shadow-xl dark:border-neutral-800 dark:bg-neutral-900"
        >
          <div className="flex items-center gap-3 px-3 py-2">
            <Avatar {...current} size={36} />
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
                {current.name || "Cuenta activa"}
              </p>
              <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">{current.email}</p>
            </div>
          </div>

          {others.length > 0 && (
            <div className="mt-1 border-t border-neutral-100 py-1 dark:border-neutral-800">
              <p className="px-3 pb-1 pt-1.5 text-[11px] font-medium uppercase tracking-wide text-neutral-400 dark:text-neutral-500">
                Cambiar a
              </p>
              {others.map((acc) => (
                <button
                  key={acc.email}
                  role="menuitem"
                  onClick={() => switchTo(acc.email)}
                  className="flex w-full items-center gap-3 px-3 py-2 text-left text-sm hover:bg-neutral-50 dark:hover:bg-neutral-800"
                >
                  <Avatar {...acc} size={28} />
                  <span className="min-w-0 flex-1 truncate text-neutral-700 dark:text-neutral-300">
                    {acc.name || acc.email}
                  </span>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      forgetAccount(acc.email);
                      setKnown(getKnownAccounts());
                    }}
                    title="Quitar de la lista"
                    className="shrink-0 rounded p-0.5 text-neutral-300 hover:text-neutral-500 dark:text-neutral-600 dark:hover:text-neutral-400"
                  >
                    ✕
                  </button>
                </button>
              ))}
            </div>
          )}

          <div className="mt-1 border-t border-neutral-100 py-1 dark:border-neutral-800">
            <button
              role="menuitem"
              onClick={() => switchTo()}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-indigo-600 hover:bg-indigo-50 dark:text-indigo-400 dark:hover:bg-indigo-500/10"
            >
              <span className="flex h-6 w-6 items-center justify-center rounded-full border border-dashed border-indigo-300 text-xs dark:border-indigo-700">
                +
              </span>
              Agregar otra cuenta de Gmail
            </button>
            <button
              role="menuitem"
              onClick={() => signOut({ callbackUrl: "/" })}
              className="flex w-full items-center gap-2.5 px-3 py-2 text-left text-sm text-neutral-500 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
            >
              <span className="flex h-6 w-6 items-center justify-center">↪️</span>
              Cerrar sesión
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
