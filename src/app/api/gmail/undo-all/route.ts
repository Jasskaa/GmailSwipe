import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGmailClient, revertActionHistoryEntry } from "@/lib/gmailApi";

// Cuántas acciones deshacemos como máximo por request, para no colgar la
// petición ni pegarle demasiado fuerte a la API de Gmail de una sola vez.
// El cliente llama de nuevo mientras `remaining > 0`.
const BATCH_SIZE = 40;

export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const pending = await prisma.actionHistory.findMany({
    where: { userId: session.user.id, undone: false },
    orderBy: { createdAt: "desc" },
    take: BATCH_SIZE,
  });

  if (pending.length === 0) {
    return NextResponse.json({ ok: true, undoneCount: 0, remaining: 0 });
  }

  const gmail = await getGmailClient(session.user.id);
  let undoneCount = 0;
  const failures: string[] = [];

  for (const entry of pending) {
    try {
      await revertActionHistoryEntry(gmail, entry);
      await prisma.actionHistory.update({ where: { id: entry.id }, data: { undone: true } });
      undoneCount++;
    } catch (err) {
      // No abortamos el lote entero por un mensaje problemático (p.ej. ya
      // borrado definitivamente); seguimos con el resto.
      console.error(`Error deshaciendo ${entry.gmailMessageId}:`, err);
      failures.push(entry.gmailMessageId);
    }
  }

  const remaining = await prisma.actionHistory.count({
    where: { userId: session.user.id, undone: false },
  });

  return NextResponse.json({ ok: true, undoneCount, remaining, failures });
}
