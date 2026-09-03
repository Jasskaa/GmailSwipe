"use client";

import { useState } from "react";
import type { GmailLabel } from "@/lib/gmailApi";

export type ActionType = "trash" | "archive" | "keep" | "label";
export type FilterType = "inbox" | "unread" | "label" | "query";

export type GestureConfigValue = {
  leftAction: ActionType;
  leftLabelId: string | null;
  rightAction: ActionType;
  rightLabelId: string | null;
  upAction: ActionType;
  upLabelId: string | null;
  downEnabled: boolean;
  downAction: ActionType;
  downLabelId: string | null;
  filterType: FilterType;
  filterLabelId: string | null;
  filterQuery: string | null;
};

const ACTION_OPTIONS: { value: ActionType; label: string }[] = [
  { value: "trash", label: "🗑️ Eliminar (papelera)" },
  { value: "archive", label: "📥 Archivar" },
  { value: "keep", label: "✅ Mantener en bandeja" },
  { value: "label", label: "🏷️ Aplicar etiqueta" },
];

const DIRECTIONS: {
  key: "left" | "right" | "up" | "down";
  icon: string;
  title: string;
}[] = [
  { key: "left", icon: "⬅️", title: "Izquierda" },
  { key: "right", icon: "➡️", title: "Derecha" },
  { key: "up", icon: "⬆️", title: "Arriba" },
  { key: "down", icon: "⬇️", title: "Abajo (opcional)" },
];

const FIELD_CLASS =
  "w-full rounded-xl border border-neutral-200 bg-white px-3 py-2.5 text-sm text-neutral-900 shadow-sm outline-none transition focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-100 dark:focus:ring-indigo-500/20";

function LabelSelect({
  value,
  onChange,
  labels,
}: {
  value: string | null;
  onChange: (v: string) => void;
  labels: GmailLabel[];
}) {
  return (
    <select value={value ?? ""} onChange={(e) => onChange(e.target.value)} className={FIELD_CLASS}>
      <option value="" disabled>
        Elegí una etiqueta…
      </option>
      {labels.map((l) => (
        <option key={l.id} value={l.id}>
          {l.name}
        </option>
      ))}
    </select>
  );
}

function SectionCard({
  icon,
  title,
  subtitle,
  children,
}: {
  icon: string;
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="w-full rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm dark:border-neutral-800 dark:bg-neutral-900">
      <div className="mb-4 flex items-center gap-2.5">
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-indigo-50 text-base dark:bg-indigo-500/10">
          {icon}
        </span>
        <div>
          <h2 className="text-sm font-semibold text-neutral-800 dark:text-neutral-100">{title}</h2>
          {subtitle && (
            <p className="text-xs text-neutral-400 dark:text-neutral-500">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  );
}

export function GestureConfigForm({
  initialConfig,
  labels,
}: {
  initialConfig: GestureConfigValue;
  labels: GmailLabel[];
}) {
  const [config, setConfig] = useState<GestureConfigValue>(initialConfig);
  const [status, setStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  function update<K extends keyof GestureConfigValue>(key: K, value: GestureConfigValue[K]) {
    setConfig((prev) => ({ ...prev, [key]: value }));
    setStatus("idle");
  }

  function actionKey(dir: "left" | "right" | "up" | "down") {
    return `${dir}Action` as const;
  }
  function labelKey(dir: "left" | "right" | "up" | "down") {
    return `${dir}LabelId` as const;
  }

  async function handleSave() {
    setStatus("saving");
    setErrorMessage(null);
    try {
      const res = await fetch("/api/gesture-config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.error ?? "No se pudo guardar.");
      }
      setStatus("saved");
    } catch (err) {
      setStatus("error");
      setErrorMessage(err instanceof Error ? err.message : "Error desconocido.");
    }
  }

  return (
    <div className="flex w-full max-w-lg flex-col gap-5">
      <SectionCard icon="👆" title="Gestos → acción" subtitle="Qué pasa al arrastrar (o tocar el botón) en cada dirección">
        <div className="space-y-5">
          {DIRECTIONS.map(({ key, icon, title }) => {
            const isDown = key === "down";
            const enabled = isDown ? config.downEnabled : true;
            const action = isDown ? config.downAction : config[actionKey(key)];
            const labelId = isDown ? config.downLabelId : config[labelKey(key)];

            return (
              <div key={key} className="space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-2 text-sm font-medium text-neutral-600 dark:text-neutral-300">
                    <span>{icon}</span>
                    {title}
                  </span>
                  {isDown && (
                    <label className="flex items-center gap-1.5 text-xs text-neutral-500 dark:text-neutral-400">
                      <input
                        type="checkbox"
                        checked={config.downEnabled}
                        onChange={(e) => update("downEnabled", e.target.checked)}
                        className="h-4 w-4 accent-indigo-600"
                      />
                      Activar
                    </label>
                  )}
                </div>

                {enabled && (
                  <>
                    <select
                      value={action}
                      onChange={(e) =>
                        isDown
                          ? update("downAction", e.target.value as ActionType)
                          : update(actionKey(key), e.target.value as ActionType)
                      }
                      className={FIELD_CLASS}
                    >
                      {ACTION_OPTIONS.map((opt) => (
                        <option key={opt.value} value={opt.value}>
                          {opt.label}
                        </option>
                      ))}
                    </select>

                    {action === "label" && (
                      <LabelSelect
                        value={labelId}
                        onChange={(v) =>
                          isDown ? update("downLabelId", v) : update(labelKey(key), v)
                        }
                        labels={labels}
                      />
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>
      </SectionCard>

      <SectionCard icon="📮" title="Qué correos revisar" subtitle="El filtro que se usa para armar la cola de tarjetas">
        <div className="space-y-2.5">
          {(
            [
              { value: "inbox", label: "Toda la bandeja de entrada" },
              { value: "unread", label: "Solo no leídos" },
              { value: "label", label: "Una etiqueta concreta" },
              { value: "query", label: "Búsqueda personalizada de Gmail" },
            ] as { value: FilterType; label: string }[]
          ).map((opt) => (
            <label
              key={opt.value}
              className="flex cursor-pointer items-center gap-2.5 rounded-xl border border-transparent px-2 py-1.5 text-sm text-neutral-700 transition hover:bg-neutral-50 dark:text-neutral-300 dark:hover:bg-neutral-800/60"
            >
              <input
                type="radio"
                name="filterType"
                checked={config.filterType === opt.value}
                onChange={() => update("filterType", opt.value)}
                className="h-4 w-4 accent-indigo-600"
              />
              {opt.label}
            </label>
          ))}

          {config.filterType === "label" && (
            <LabelSelect
              value={config.filterLabelId}
              onChange={(v) => update("filterLabelId", v)}
              labels={labels}
            />
          )}

          {config.filterType === "query" && (
            <input
              type="text"
              value={config.filterQuery ?? ""}
              onChange={(e) => update("filterQuery", e.target.value)}
              placeholder='p.ej. "older_than:30d -label:importante"'
              className={FIELD_CLASS}
            />
          )}
        </div>
      </SectionCard>

      <div className="flex flex-col items-center gap-2 pb-1">
        <button
          onClick={handleSave}
          disabled={status === "saving"}
          className="w-full rounded-full bg-indigo-600 px-6 py-3 text-sm font-medium text-white shadow-sm shadow-indigo-600/20 transition hover:bg-indigo-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {status === "saving" ? "Guardando…" : "Guardar configuración"}
        </button>
        {status === "saved" && (
          <p className="text-xs font-medium text-green-600 dark:text-green-400">
            Guardado ✅
          </p>
        )}
        {status === "error" && <p className="text-xs text-red-500">{errorMessage}</p>}
      </div>
    </div>
  );
}
