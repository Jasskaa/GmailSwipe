import { gmail_v1 } from "googleapis";
import { getGmailClient } from "@/lib/gmailApi";
import { prisma } from "@/lib/prisma";

export type NextEmail = {
  id: string;
  threadId: string;
  from: { name: string; email: string };
  subject: string;
  snippet: string;
  date: string;
  hasAttachments: boolean;
  isUnread: boolean;
};

type FilterConfig = {
  filterType: string;
  filterLabelId: string | null;
  filterQuery: string | null;
};

function buildListParams(config: FilterConfig): { labelIds?: string[]; q?: string } {
  switch (config.filterType) {
    case "unread":
      return { labelIds: ["INBOX", "UNREAD"] };
    case "label":
      return { labelIds: config.filterLabelId ? [config.filterLabelId] : ["INBOX"] };
    case "query":
      return { q: config.filterQuery ?? "" };
    case "inbox":
    default:
      return { labelIds: ["INBOX"] };
  }
}

function parseFromHeader(value: string | undefined): { name: string; email: string } {
  if (!value) return { name: "Desconocido", email: "" };
  const match = value.match(/^(.*)<(.+)>$/);
  if (match) {
    const name = match[1].trim().replace(/^"|"$/g, "");
    const email = match[2].trim();
    return { name: name || email, email };
  }
  return { name: value.trim(), email: value.trim() };
}

function getHeader(
  headers: gmail_v1.Schema$MessagePartHeader[] | undefined,
  name: string
): string | undefined {
  return headers?.find((h) => h.name?.toLowerCase() === name.toLowerCase())?.value ?? undefined;
}

// Cuántas páginas de resultados de Gmail estamos dispuestos a recorrer buscando
// un correo que todavía no hayamos triado (los que quedaron marcados como
// "keep" siguen en la bandeja y hay que saltarlos manualmente).
const MAX_PAGES = 8;
const PAGE_SIZE = 25;

/**
 * Devuelve el próximo correo a mostrar según el filtro configurado por el
 * usuario, saltando los que ya fueron triados (tabla ActionHistory).
 */
export async function getNextEmail(
  userId: string,
  excludeIds: string[] = []
): Promise<NextEmail | null> {
  const config = await prisma.gestureConfig.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const processedRows = await prisma.actionHistory.findMany({
    where: { userId, undone: false },
    select: { gmailMessageId: true },
  });
  const processed = new Set(processedRows.map((r) => r.gmailMessageId));
  // Correos ya entregados al cliente (prefetch) que todavía no se accionaron:
  // no están en ActionHistory pero tampoco hay que repetirlos en la cola.
  for (const id of excludeIds) processed.add(id);

  const gmail = await getGmailClient(userId);
  const listParams = buildListParams(config);

  let pageToken: string | undefined;
  for (let page = 0; page < MAX_PAGES; page++) {
    const listRes = await gmail.users.messages.list({
      userId: "me",
      maxResults: PAGE_SIZE,
      pageToken,
      ...listParams,
    });

    const candidates = (listRes.data.messages ?? []).filter(
      (m): m is { id: string } => Boolean(m.id) && !processed.has(m.id!)
    );

    for (const candidate of candidates) {
      const msgRes = await gmail.users.messages.get({
        userId: "me",
        id: candidate.id,
        format: "metadata",
        metadataHeaders: ["From", "Subject", "Date"],
      });
      const msg = msgRes.data;
      const headers = msg.payload?.headers ?? undefined;
      const hasAttachments = Boolean(
        msg.payload?.parts?.some((p) => p.filename && p.filename.length > 0)
      );

      return {
        id: msg.id ?? candidate.id,
        threadId: msg.threadId ?? candidate.id,
        from: parseFromHeader(getHeader(headers, "From")),
        subject: getHeader(headers, "Subject") ?? "(sin asunto)",
        snippet: msg.snippet ?? "",
        date: getHeader(headers, "Date") ?? new Date().toISOString(),
        hasAttachments,
        isUnread: (msg.labelIds ?? []).includes("UNREAD"),
      };
    }

    pageToken = listRes.data.nextPageToken ?? undefined;
    if (!pageToken) break;
  }

  return null;
}

/** Reconstruye una tarjeta (NextEmail) a partir de un id de mensaje conocido. */
export async function getEmailById(userId: string, messageId: string): Promise<NextEmail | null> {
  const gmail = await getGmailClient(userId);
  try {
    const msgRes = await gmail.users.messages.get({
      userId: "me",
      id: messageId,
      format: "metadata",
      metadataHeaders: ["From", "Subject", "Date"],
    });
    const msg = msgRes.data;
    const headers = msg.payload?.headers ?? undefined;
    const hasAttachments = Boolean(
      msg.payload?.parts?.some((p) => p.filename && p.filename.length > 0)
    );

    return {
      id: msg.id ?? messageId,
      threadId: msg.threadId ?? messageId,
      from: parseFromHeader(getHeader(headers, "From")),
      subject: getHeader(headers, "Subject") ?? "(sin asunto)",
      snippet: msg.snippet ?? "",
      date: getHeader(headers, "Date") ?? new Date().toISOString(),
      hasAttachments,
      isUnread: (msg.labelIds ?? []).includes("UNREAD"),
    };
  } catch (err) {
    // El mensaje puede haber sido borrado definitivamente entretanto.
    console.error(`No se pudo recuperar el mensaje ${messageId}:`, err);
    return null;
  }
}

function decodeBase64Url(data: string): string {
  const normalized = data.replace(/-/g, "+").replace(/_/g, "/");
  return Buffer.from(normalized, "base64").toString("utf8");
}

// Conversión muy básica de HTML a texto plano. No pretende ser un parser
// correcto: solo evita mostrarle al usuario las etiquetas crudas cuando el
// correo no tiene parte text/plain. IMPORTANTE: el resultado se renderiza
// siempre como texto (nunca con dangerouslySetInnerHTML), así que aunque el
// stripping sea imperfecto no hay riesgo de que se ejecute HTML/JS de un
// remitente — ver ExpandedEmailModal.
function htmlToPlainText(html: string): string {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, "")
    .replace(/<script[\s\S]*?<\/script>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<\/div>/gi, "\n")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function collectBody(part: gmail_v1.Schema$MessagePart | undefined): {
  plain: string;
  html: string;
} {
  let plain = "";
  let html = "";

  function walk(p: gmail_v1.Schema$MessagePart | undefined) {
    if (!p) return;
    if (p.mimeType === "text/plain" && p.body?.data) {
      plain += decodeBase64Url(p.body.data);
    } else if (p.mimeType === "text/html" && p.body?.data) {
      html += decodeBase64Url(p.body.data);
    }
    p.parts?.forEach(walk);
  }
  walk(part);

  if (!plain && !html && part?.body?.data && !part.parts) {
    if (part.mimeType === "text/html") html = decodeBase64Url(part.body.data);
    else plain = decodeBase64Url(part.body.data);
  }

  return { plain, html };
}

/** Cuerpo del correo como texto plano, para la vista expandida. */
export async function getEmailPlainTextBody(userId: string, messageId: string): Promise<string> {
  const gmail = await getGmailClient(userId);
  const res = await gmail.users.messages.get({ userId: "me", id: messageId, format: "full" });
  const { plain, html } = collectBody(res.data.payload);

  if (plain.trim()) return plain.trim();
  if (html.trim()) return htmlToPlainText(html);
  return res.data.snippet ?? "";
}

export type ProgressStats = {
  reviewed: number;
  remaining: number;
  total: number;
};

/**
 * Progreso aproximado para el contador ("124 de 700"). Gmail no tiene el
 * concepto de "correos ya triados en esta app", así que lo reconstruimos:
 * `reviewed` = cuántas acciones aplicamos (ActionHistory), `remaining` =
 * estimación de Gmail (`resultSizeEstimate`) de lo que todavía matchea el
 * filtro. `total` es la suma de ambos. Es una aproximación (Gmail mismo
 * documenta `resultSizeEstimate` como estimado, y el gesto "keep" no saca
 * el correo del filtro "bandeja", así que `remaining` no baja con ese
 * gesto) — suficiente para una barra de progreso, no para un conteo exacto.
 */
export async function getProgressStats(userId: string): Promise<ProgressStats> {
  const config = await prisma.gestureConfig.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });

  const gmail = await getGmailClient(userId);
  const listParams = buildListParams(config);
  const listRes = await gmail.users.messages.list({
    userId: "me",
    maxResults: 1,
    ...listParams,
  });
  const remaining = listRes.data.resultSizeEstimate ?? 0;

  const reviewed = await prisma.actionHistory.count({
    where: { userId, undone: false },
  });

  return { reviewed, remaining, total: reviewed + remaining };
}
