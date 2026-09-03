"use client";

import { useEffect, useState } from "react";
import type { SwipeEmail } from "@/components/EmailCard";

export function ExpandedEmailModal({
  email,
  onClose,
}: {
  email: SwipeEmail;
  onClose: () => void;
}) {
  const [body, setBody] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    setBody(null);

    fetch(`/api/gmail/message/${email.id}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudo cargar el correo.");
        if (!cancelled) setBody(data.body ?? "");
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : "Error desconocido.");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [email.id]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4 py-8 backdrop-blur-sm"
      onClick={onClose}
    >
      <div
        className="flex max-h-full w-full max-w-lg flex-col overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-black/5 dark:bg-neutral-900"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-start justify-between gap-3 border-b border-neutral-200 p-5 dark:border-neutral-800">
          <div className="min-w-0">
            <p className="truncate text-sm text-neutral-500 dark:text-neutral-400">
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {email.from.name}
              </span>{" "}
              · {email.from.email}
            </p>
            <h2 className="mt-1 text-base font-semibold text-neutral-900 dark:text-neutral-100">
              {email.subject}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar"
            className="shrink-0 rounded-full p-1.5 text-neutral-400 transition hover:bg-neutral-100 hover:text-neutral-600 dark:hover:bg-neutral-800 dark:hover:text-neutral-300"
          >
            ✕
          </button>
        </div>

        <div className="overflow-y-auto p-5 text-sm leading-relaxed text-neutral-700 dark:text-neutral-300">
          {loading && (
            <div className="flex items-center gap-2 text-neutral-400 dark:text-neutral-500">
              <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-current border-t-transparent" />
              Cargando correo…
            </div>
          )}
          {error && <p className="text-red-500">{error}</p>}
          {!loading && !error && (
            <p className="whitespace-pre-wrap">
              {body || "(Este correo no tiene contenido de texto.)"}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
