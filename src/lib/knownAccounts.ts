// Pequeño "recordatorio" de qué cuentas de Gmail se conectaron antes desde
// ESTE navegador, para poder mostrarlas como accesos rápidos al cambiar de
// cuenta (ver AccountSwitcher). Vive solo en localStorage: no es la fuente
// de verdad de qué cuentas existen (eso lo decide Gmail/Google al loguear),
// es solo una lista de atajos — si falla o está vacía, todo sigue
// funcionando, simplemente no hay atajos para mostrar.

const STORAGE_KEY = "gmail-swipe:known-accounts";
const MAX_ACCOUNTS = 6;

export type KnownAccount = {
  email: string;
  name: string | null;
  image: string | null;
};

export function getKnownAccounts(): KnownAccount[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (a): a is KnownAccount => Boolean(a) && typeof a.email === "string" && a.email.length > 0
    );
  } catch {
    return [];
  }
}

export function rememberAccount(account: KnownAccount): void {
  if (typeof window === "undefined" || !account.email) return;
  try {
    const existing = getKnownAccounts().filter((a) => a.email !== account.email);
    const updated = [account, ...existing].slice(0, MAX_ACCOUNTS);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    /* localStorage puede fallar (modo privado, cuota llena...); no es crítico */
  }
}

export function forgetAccount(email: string): void {
  if (typeof window === "undefined") return;
  try {
    const updated = getKnownAccounts().filter((a) => a.email !== email);
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
  } catch {
    /* noop */
  }
}
