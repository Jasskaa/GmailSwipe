"use client";

import { useEffect } from "react";

/** Registra el service worker (necesario para que el navegador ofrezca "Instalar app"). */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        /* no crítico: la app funciona igual sin service worker, solo no se podrá "instalar" */
      });
    }
  }, []);

  return null;
}
