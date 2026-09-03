import { formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

export type SwipeEmail = {
  id: string;
  threadId: string;
  from: { name: string; email: string };
  subject: string;
  snippet: string;
  date: string;
  hasAttachments: boolean;
  isUnread: boolean;
};

function initials(name: string, email: string): string {
  const source = (name || email || "?").trim();
  const parts = source.split(/\s+/).filter(Boolean);
  const letters = parts.slice(0, 2).map((p) => p[0]?.toUpperCase() ?? "");
  return letters.join("") || "?";
}

function relativeDate(dateStr: string): string {
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return "";
  try {
    return formatDistanceToNow(d, { addSuffix: true, locale: es });
  } catch {
    return "";
  }
}

export function EmailCard({ email }: { email: SwipeEmail }) {
  return (
    <div className="flex w-full max-w-md flex-col gap-4 rounded-3xl border border-neutral-200 bg-white p-6 shadow-xl shadow-neutral-900/5 ring-1 ring-black/[0.03] dark:border-neutral-800 dark:bg-neutral-900 dark:shadow-black/20">
      <div className="flex items-center gap-3">
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-full bg-indigo-100 text-sm font-semibold text-indigo-700 dark:bg-indigo-500/20 dark:text-indigo-300">
          {initials(email.from.name, email.from.email)}
        </div>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-medium text-neutral-900 dark:text-neutral-100">
            {email.from.name}
          </p>
          <p className="truncate text-xs text-neutral-500 dark:text-neutral-400">
            {email.from.email}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5 text-xs text-neutral-400 dark:text-neutral-500">
          {email.hasAttachments && <span title="Tiene adjuntos">📎</span>}
          {email.isUnread && (
            <span className="h-2 w-2 rounded-full bg-blue-500" title="No leído" />
          )}
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold leading-snug text-neutral-900 dark:text-neutral-100">
          {email.subject}
        </h2>
        <p className="mt-1 text-xs text-neutral-400 dark:text-neutral-500">
          {relativeDate(email.date)}
        </p>
      </div>

      <p className="line-clamp-4 text-sm text-neutral-600 dark:text-neutral-400">
        {email.snippet}
      </p>
    </div>
  );
}
