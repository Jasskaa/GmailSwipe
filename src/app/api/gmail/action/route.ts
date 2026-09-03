import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGmailClient, getOrCreateArchiveLabelId } from "@/lib/gmailApi";

const DIRECTIONS = ["left", "right", "up", "down"] as const;
type Direction = (typeof DIRECTIONS)[number];

function isDirection(v: unknown): v is Direction {
  return typeof v === "string" && (DIRECTIONS as readonly string[]).includes(v);
}

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const messageId = typeof body?.messageId === "string" ? body.messageId : null;
  const threadId = typeof body?.threadId === "string" ? body.threadId : null;
  const direction = body?.direction;

  if (!messageId || !isDirection(direction)) {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const config = await prisma.gestureConfig.upsert({
    where: { userId: session.user.id },
    update: {},
    create: { userId: session.user.id },
  });

  const resolved =
    direction === "left"
      ? { action: config.leftAction, labelId: config.leftLabelId, enabled: true }
      : direction === "right"
      ? { action: config.rightAction, labelId: config.rightLabelId, enabled: true }
      : direction === "up"
      ? { action: config.upAction, labelId: config.upLabelId, enabled: true }
      : { action: config.downAction, labelId: config.downLabelId, enabled: config.downEnabled };

  if (!resolved.enabled) {
    return NextResponse.json({ error: "Ese gesto no está activado." }, { status: 400 });
  }

  const gmail = await getGmailClient(session.user.id);

  let wasTrashed = false;
  let addedLabelIds: string[] = [];
  let removedLabelIds: string[] = [];

  try {
    switch (resolved.action) {
      case "trash":
        await gmail.users.messages.trash({ userId: "me", id: messageId });
        wasTrashed = true;
        break;
      case "archive": {
        // Además de sacarlo de la bandeja, lo etiquetamos con "Archivar"
        // (se crea la primera vez) para poder encontrarlo después. El id
        // queda cacheado en GestureConfig — sin esto, cada archivado le
        // pedía a Gmail la lista completa de etiquetas solo para volver a
        // encontrar la misma, y esa llamada de más era la causa principal
        // de la lentitud.
        let archiveLabelId = config.archiveLabelId;
        if (!archiveLabelId) {
          archiveLabelId = await getOrCreateArchiveLabelId(gmail);
          await prisma.gestureConfig.update({
            where: { userId: session.user.id },
            data: { archiveLabelId },
          });
        }
        await gmail.users.messages.modify({
          userId: "me",
          id: messageId,
          requestBody: { removeLabelIds: ["INBOX"], addLabelIds: [archiveLabelId] },
        });
        removedLabelIds = ["INBOX"];
        addedLabelIds = [archiveLabelId];
        break;
      }
      case "keep":
        // "Dejar en la bandeja" = se marca como revisado (leído) pero no se mueve.
        await gmail.users.messages.modify({
          userId: "me",
          id: messageId,
          requestBody: { removeLabelIds: ["UNREAD"] },
        });
        removedLabelIds = ["UNREAD"];
        break;
      case "label":
        if (!resolved.labelId) {
          return NextResponse.json(
            { error: "Falta la etiqueta configurada para este gesto." },
            { status: 400 }
          );
        }
        await gmail.users.messages.modify({
          userId: "me",
          id: messageId,
          requestBody: { addLabelIds: [resolved.labelId] },
        });
        addedLabelIds = [resolved.labelId];
        break;
      default:
        return NextResponse.json({ error: "Acción desconocida." }, { status: 400 });
    }
  } catch (err) {
    console.error("Error aplicando acción de Gmail:", err);
    return NextResponse.json({ error: "No se pudo aplicar la acción en Gmail." }, { status: 502 });
  }

  await prisma.actionHistory.create({
    data: {
      userId: session.user.id,
      gmailMessageId: messageId,
      gmailThreadId: threadId,
      gesture: direction,
      actionType: resolved.action,
      addedLabelIds: addedLabelIds.length ? JSON.stringify(addedLabelIds) : null,
      removedLabelIds: removedLabelIds.length ? JSON.stringify(removedLabelIds) : null,
      wasTrashed,
    },
  });

  return NextResponse.json({ ok: true });
}
