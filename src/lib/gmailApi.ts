import { google, gmail_v1 } from "googleapis";
import type { ActionHistory } from "@prisma/client";
import { getAuthorizedGmailClient } from "@/lib/gmailAuth";

/** Cliente de la API de Gmail (googleapis) ya autenticado para este usuario. */
export async function getGmailClient(userId: string): Promise<gmail_v1.Gmail> {
  const auth = await getAuthorizedGmailClient(userId);
  return google.gmail({ version: "v1", auth });
}

export type GmailLabel = {
  id: string;
  name: string;
  type: "system" | "user";
};

// Labels de sistema que no tienen sentido ni como destino de una etiqueta
// asignable por gesto ni como filtro de "qué correos revisar" (borradores,
// enviados, chats...). SPAM e IMPORTANT sí se dejan: son un filtro válido
// ("revisar solo el spam", "solo lo importante").
const NOISY_SYSTEM_LABELS = new Set(["DRAFT", "SENT", "TRASH", "CHAT"]);

/** Lista las etiquetas de Gmail del usuario, filtrando las que no son útiles en la UI. */
export async function listGmailLabels(userId: string): Promise<GmailLabel[]> {
  const gmail = await getGmailClient(userId);
  const res = await gmail.users.labels.list({ userId: "me" });

  const labels = (res.data.labels ?? [])
    .filter((l): l is gmail_v1.Schema$Label & { id: string; name: string } => Boolean(l.id && l.name))
    .filter((l) => !NOISY_SYSTEM_LABELS.has(l.id))
    .map((l) => ({
      id: l.id,
      name: l.name,
      type: (l.type === "system" ? "system" : "user") as "system" | "user",
    }));

  labels.sort((a, b) => {
    if (a.type !== b.type) return a.type === "user" ? -1 : 1;
    return a.name.localeCompare(b.name, "es");
  });

  return labels;
}

const ARCHIVE_LABEL_NAME = "Archivar";

/**
 * Devuelve el id de la etiqueta "Archivar" del usuario, creándola en Gmail
 * si todavía no existe. Se usa para que archivar un correo desde la app
 * (gesto "archive") además lo etiquete, y así se pueda encontrar después.
 */
export async function getOrCreateArchiveLabelId(gmail: gmail_v1.Gmail): Promise<string> {
  const res = await gmail.users.labels.list({ userId: "me" });
  const existing = (res.data.labels ?? []).find(
    (l) => l.name?.toLowerCase() === ARCHIVE_LABEL_NAME.toLowerCase()
  );
  if (existing?.id) return existing.id;

  const created = await gmail.users.labels.create({
    userId: "me",
    requestBody: {
      name: ARCHIVE_LABEL_NAME,
      labelListVisibility: "labelShow",
      messageListVisibility: "show",
    },
  });
  if (!created.data.id) {
    throw new Error("Gmail no devolvió un id para la etiqueta 'Archivar' recién creada.");
  }
  return created.data.id;
}

/**
 * Revierte en Gmail una fila de ActionHistory: si fue un trash, la
 * des-papelera; si no, invierte exactamente las etiquetas que se
 * añadieron/quitaron en su momento. Compartido entre /api/gmail/undo
 * (uno a la vez) y /api/gmail/undo-all (en lote, para recuperarse de un
 * bug que haya aplicado acciones de más).
 */
export async function revertActionHistoryEntry(
  gmail: gmail_v1.Gmail,
  entry: Pick<ActionHistory, "gmailMessageId" | "wasTrashed" | "addedLabelIds" | "removedLabelIds">
): Promise<void> {
  if (entry.wasTrashed) {
    await gmail.users.messages.untrash({ userId: "me", id: entry.gmailMessageId });
    return;
  }

  const addLabelIds: string[] = entry.removedLabelIds ? JSON.parse(entry.removedLabelIds) : [];
  const removeLabelIds: string[] = entry.addedLabelIds ? JSON.parse(entry.addedLabelIds) : [];
  if (addLabelIds.length || removeLabelIds.length) {
    await gmail.users.messages.modify({
      userId: "me",
      id: entry.gmailMessageId,
      requestBody: { addLabelIds, removeLabelIds },
    });
  }
}
