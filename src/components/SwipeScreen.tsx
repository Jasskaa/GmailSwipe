"use client";

import { useEffect, useRef, useState } from "react";
import { AnimatePresence } from "framer-motion";
import confetti from "canvas-confetti";
import { SwipeCard } from "@/components/SwipeCard";
import { ExpandedEmailModal } from "@/components/ExpandedEmailModal";
import type { SwipeEmail } from "@/components/EmailCard";
import { ACTION_ICON, ACTION_TITLE, DIRECTION_ARROW, type Direction } from "@/lib/actionLabels";

export type GestureConfigSummary = {
  leftAction: string;
  rightAction: string;
  upAction: string;
  downEnabled: boolean;
  downAction: string;
};

export type ProgressStats = {
  reviewed: number;
  remaining: number;
  total: number;
};

// Cuántas tarjetas queremos siempre tener listas (la de arriba + la que
// se insinúa detrás), para que al accionar la de arriba ya haya una lista.
const STACK_SIZE = 2;

function fireConfetti() {
  confetti({ particleCount: 90, spread: 75, origin: { y: 0.6 }, scalar: 0.9 });
  confetti({ particleCount: 60, spread: 100, origin: { y: 0.5 }, scalar: 0.7, startVelocity: 35 });
}

export function SwipeScreen({
  initialEmail,
  initialProgress,
  gestureConfig,
}: {
  initialEmail: SwipeEmail | null;
  initialProgress: ProgressStats;
  gestureConfig: GestureConfigSummary;
}) {
  const [cards, setCards] = useState<SwipeEmail[]>(initialEmail ? [initialEmail] : []);
  const [exhausted, setExhausted] = useState(initialEmail === null);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [undoing, setUndoing] = useState(false);
  const [expandedEmail, setExpandedEmail] = useState<SwipeEmail | null>(null);
  const [trigger, setTrigger] = useState<{ direction: Direction; nonce: number } | null>(null);
  const [progress, setProgress] = useState<ProgressStats>(initialProgress);
  // El historial de acciones vive en el servidor (ActionHistory), no en
  // memoria del cliente: así "Deshacer" funciona aunque recargues la
  // página, y se puede pulsar varias veces seguidas para retroceder más
  // de un paso (útil si algo llegó a aplicar acciones de más).
  const [canUndo, setCanUndo] = useState(initialProgress.reviewed > 0);
  // Correos "saltados" en esta sesión (sin aplicar ninguna acción): se
  // excluyen de la cola para no repetirlos, pero no quedan registrados en
  // Gmail ni en ActionHistory — al recargar la página vuelven a aparecer.
  const [skippedIds, setSkippedIds] = useState<Set<string>>(new Set());
  const fetchingRef = useRef(false);
  const celebratedRef = useRef(false);

  function actionFor(direction: Direction): string {
    switch (direction) {
      case "left":
        return gestureConfig.leftAction;
      case "right":
        return gestureConfig.rightAction;
      case "up":
        return gestureConfig.upAction;
      case "down":
        return gestureConfig.downAction;
    }
  }

  function refreshProgress() {
    fetch("/api/gmail/progress")
      .then((res) => res.json())
      .then((data: Partial<ProgressStats>) => {
        if (typeof data.reviewed === "number" && typeof data.total === "number") {
          setProgress({ reviewed: data.reviewed, remaining: data.remaining ?? 0, total: data.total });
          setCanUndo(data.reviewed > 0);
        }
      })
      .catch(() => {
        /* el contador es un extra visual, no bloqueamos el flujo si falla */
      });
  }

  // Mantiene la cola en STACK_SIZE tarjetas, prefetcheando la siguiente
  // mientras el usuario decide sobre la de arriba. Como esto corre en
  // segundo plano y siempre intenta mantener 2 tarjetas listas, la tarjeta
  // que queda "top" tras cada acción normalmente YA está cargada — no hay
  // que esperar red para poder seguir interactuando.
  useEffect(() => {
    if (exhausted || cards.length >= STACK_SIZE || fetchingRef.current) return;
    fetchingRef.current = true;
    const excludeIds = [...cards.map((c) => c.id), ...Array.from(skippedIds)];
    const qs = excludeIds.length ? `?exclude=${encodeURIComponent(excludeIds.join(","))}` : "";

    fetch(`/api/gmail/next${qs}`)
      .then(async (res) => {
        const data = await res.json();
        if (!res.ok) throw new Error(data.error ?? "No se pudo obtener el siguiente correo.");
        if (!data.message) {
          setExhausted(true);
          return;
        }
        setCards((prev) =>
          prev.some((c) => c.id === data.message.id) ? prev : [...prev, data.message]
        );
      })
      .catch((err) => setError(err instanceof Error ? err.message : "Error desconocido."))
      .finally(() => {
        fetchingRef.current = false;
      });
  }, [cards, exhausted, skippedIds]);

  // Confetti sutil al llegar a "bandeja al día".
  useEffect(() => {
    if (cards.length === 0 && exhausted && !celebratedRef.current) {
      celebratedRef.current = true;
      fireConfetti();
    }
    if (!(cards.length === 0 && exhausted)) {
      celebratedRef.current = false;
    }
  }, [cards.length, exhausted]);

  // Confirmación OPTIMISTA: la tarjeta se retira y la siguiente (ya
  // precargada) queda interactiva al instante, sin esperar la respuesta de
  // Gmail/la base de datos — esa espera de red era lo que hacía sentir
  // lenta la app. El POST se dispara en paralelo; si falla, avisamos y
  // devolvemos la tarjeta a la cola para reintentar.
  function commitAction(direction: Direction) {
    const current = cards[0];
    if (!current) return;
    // Importante: limpiar el trigger YA, antes de que la próxima tarjeta se
    // monte como "top". Si no, esta tarjeta se retira, la siguiente pasa a
    // ser la de arriba y hereda este mismo `trigger` (el nonce no cambia
    // para ella porque nunca lo tuvo antes), disparando el mismo gesto sola
    // — y así en cadena con toda la cola.
    setTrigger(null);
    setError(null);
    setNotice(null);

    setCards((prev) => prev.slice(1));
    setProgress((p) => ({ ...p, reviewed: p.reviewed + 1 }));
    setCanUndo(true);
    if (expandedEmail?.id === current.id) setExpandedEmail(null);

    fetch("/api/gmail/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messageId: current.id, threadId: current.threadId, direction }),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "No se pudo aplicar la acción.");
        refreshProgress();
      })
      .catch((err) => {
        const message = err instanceof Error ? err.message : "error desconocido";
        setError(
          `No se pudo aplicar la acción a "${current.subject}" (${message}). La volvimos a poner al principio de la cola.`
        );
        setProgress((p) => ({ ...p, reviewed: Math.max(0, p.reviewed - 1) }));
        setCards((prev) => [current, ...prev]);
      });
  }

  function handleSkip() {
    const current = cards[0];
    if (!current) return;
    setSkippedIds((prev) => new Set(prev).add(current.id));
    setCards((prev) => prev.slice(1));
  }

  async function handleUndo() {
    if (!canUndo || undoing) return;
    setUndoing(true);
    setError(null);
    setNotice(null);
    try {
      const res = await fetch("/api/gmail/undo", { method: "POST" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "No se pudo deshacer.");
      if (data.email) {
        setCards((prev) => [data.email, ...prev.filter((c) => c.id !== data.email.id)]);
      }
      setExhausted(false);
      setProgress((p) => ({ ...p, reviewed: Math.max(0, p.reviewed - 1) }));
      setCanUndo(typeof data.remaining === "number" ? data.remaining > 0 : true);
      refreshProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
      setCanUndo(false);
    } finally {
      setUndoing(false);
    }
  }

  // Deshace TODO el historial pendiente, en lotes, hasta que no quede
  // nada. Pensado para recuperarse de golpe si alguna vez una cadena de
  // acciones se aplicó por error.
  async function handleUndoAll() {
    if (undoing) return;
    setUndoing(true);
    setError(null);
    setNotice(null);
    let totalUndone = 0;
    try {
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const res = await fetch("/api/gmail/undo-all", { method: "POST" });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.error ?? "No se pudo deshacer todo.");
        totalUndone += data.undoneCount ?? 0;
        if (!data.remaining || data.undoneCount === 0) break;
      }
      setNotice(
        totalUndone > 0
          ? `Se deshicieron ${totalUndone} acciones. Volvés a empezar desde el principio.`
          : "No había nada para deshacer."
      );
      // El estado local de la cola quedó obsoleto (los correos revertidos
      // pueden volver a matchear el filtro en cualquier orden): la
      // reiniciamos y dejamos que el efecto de prefetch la vuelva a llenar.
      setCards([]);
      setExhausted(false);
      setSkippedIds(new Set());
      setCanUndo(false);
      refreshProgress();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error desconocido.");
    } finally {
      setUndoing(false);
    }
  }

  const directions: Direction[] = (["left", "right", "up", "down"] as Direction[]).filter(
    (d) => d !== "down" || gestureConfig.downEnabled
  );

  const done = cards.length === 0 && exhausted;

  return (
    <div className="flex w-full flex-col items-center gap-6">
      {progress.total > 0 && (
        <div className="w-full max-w-md">
          <div className="mb-1 flex items-center justify-between text-xs text-neutral-500 dark:text-neutral-400">
            <span>
              {progress.reviewed} de ~{progress.total}
            </span>
            <span>{Math.min(100, Math.round((progress.reviewed / progress.total) * 100))}%</span>
          </div>
          <div className="h-1.5 w-full overflow-hidden rounded-full bg-neutral-200 dark:bg-neutral-800">
            <div
              className="h-full rounded-full bg-indigo-600 transition-all dark:bg-indigo-400"
              style={{
                width: `${Math.min(100, (progress.reviewed / progress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      {done ? (
        <div className="flex flex-col items-center gap-4 rounded-3xl border border-neutral-200 bg-white px-6 py-16 text-center shadow-sm dark:border-neutral-800 dark:bg-neutral-900 sm:px-8">
          <div className="text-5xl">🎉</div>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              ¡Bandeja al día!
            </h1>
            <p className="mt-1 text-sm text-neutral-500 dark:text-neutral-400">
              No quedan más correos con el filtro configurado.
            </p>
          </div>
          <a
            href="/setup"
            className="mt-2 inline-flex items-center gap-1.5 rounded-full bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500"
          >
            ⚙️ Probar otro filtro
          </a>
        </div>
      ) : (
        <div className="relative h-[420px] w-full max-w-md sm:h-[440px]">
          <AnimatePresence>
            {cards.slice(0, STACK_SIZE).map((card, idx) => (
              <SwipeCard
                key={card.id}
                email={card}
                isTop={idx === 0}
                stackIndex={idx}
                actionFor={actionFor}
                downEnabled={gestureConfig.downEnabled}
                externalTrigger={idx === 0 ? trigger : null}
                onCommit={commitAction}
                onExpand={() => setExpandedEmail(card)}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {error && (
        <p className="w-full max-w-md rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-center text-xs text-red-600 dark:border-red-900 dark:bg-red-950/50 dark:text-red-400">
          {error}
        </p>
      )}
      {notice && (
        <p className="w-full max-w-md rounded-xl border border-green-200 bg-green-50 px-3 py-2 text-center text-xs text-green-700 dark:border-green-900 dark:bg-green-950/50 dark:text-green-400">
          {notice}
        </p>
      )}

      {!done && (
        <div className="flex flex-wrap items-center justify-center gap-2.5 sm:gap-4">
          {directions.map((dir) => {
            const action = actionFor(dir);
            return (
              <button
                key={dir}
                onClick={() => setTrigger({ direction: dir, nonce: Date.now() })}
                disabled={cards.length === 0}
                title={`${DIRECTION_ARROW[dir]} ${ACTION_TITLE[action] ?? action}`}
                className="flex h-12 w-12 items-center justify-center rounded-full border border-neutral-200 bg-white text-lg shadow-sm transition hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md active:translate-y-0 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-800 dark:bg-neutral-900 dark:hover:border-indigo-800 sm:h-14 sm:w-14 sm:text-xl"
              >
                <span>{ACTION_ICON[action] ?? DIRECTION_ARROW[dir]}</span>
              </button>
            );
          })}
          <button
            onClick={handleSkip}
            disabled={cards.length === 0}
            title="Saltar (decidir más tarde, no aplica ninguna acción)"
            className="flex h-12 w-12 items-center justify-center rounded-full border border-dashed border-neutral-300 bg-white text-lg shadow-sm transition hover:-translate-y-0.5 hover:shadow-md active:translate-y-0 disabled:pointer-events-none disabled:opacity-40 dark:border-neutral-700 dark:bg-neutral-900 sm:h-14 sm:w-14 sm:text-xl"
          >
            <span>⏭️</span>
          </button>
        </div>
      )}

      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          onClick={handleUndo}
          disabled={!canUndo || undoing}
          className="flex items-center gap-1.5 rounded-full border border-neutral-200 px-4 py-1.5 text-xs font-medium text-neutral-600 transition hover:bg-neutral-100 disabled:cursor-not-allowed disabled:opacity-40 dark:border-neutral-800 dark:text-neutral-300 dark:hover:bg-neutral-900"
        >
          ↩️ {undoing ? "Deshaciendo…" : "Deshacer última acción"}
        </button>
        <button
          onClick={handleUndoAll}
          disabled={!canUndo || undoing}
          title="Revierte en Gmail TODAS las acciones aplicadas desde esta app y reinicia la cola desde el principio"
          className="flex items-center gap-1.5 rounded-full border border-red-200 px-4 py-1.5 text-xs font-medium text-red-500 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-40 dark:border-red-900/60 dark:text-red-400 dark:hover:bg-red-950/50"
        >
          ⏮️ {undoing ? "Deshaciendo…" : "Deshacer todo y reiniciar"}
        </button>
      </div>

      {!done && (
        <p className="max-w-sm text-center text-xs text-neutral-400 dark:text-neutral-600">
          Arrastrá la tarjeta o tocá un botón · tocá la tarjeta (sin arrastrar) para leerla completa
          · ⏭️ la salta sin decidir todavía.
        </p>
      )}

      {expandedEmail && (
        <ExpandedEmailModal email={expandedEmail} onClose={() => setExpandedEmail(null)} />
      )}
    </div>
  );
}
