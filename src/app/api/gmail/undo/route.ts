import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { getGmailClient, revertActionHistoryEntry } from "@/lib/gmailApi";
import { getEmailById } from "@/lib/gmailMessages";
import { gmailErrorResponse } from "@/lib/apiErrors";

// Deshace UNA acción (la más reciente sin deshacer) y devuelve la tarjeta
// del correo revertido para volver a mostrarla. Se puede llamar varias
// veces seguidas: cada click deshace un paso más hacia atrás — no es
// "un solo nivel", es la pila completa de ActionHistory.
export async function POST() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const last = await prisma.actionHistory.findFirst({
    where: { userId: session.user.id, undone: false },
    orderBy: { createdAt: "desc" },
  });

  if (!last) {
    return NextResponse.json({ error: "No hay ninguna acción para deshacer." }, { status: 400 });
  }

  try {
    const gmail = await getGmailClient(session.user.id);
    await revertActionHistoryEntry(gmail, last);
  } catch (err) {
    return gmailErrorResponse(err, "No se pudo deshacer la acción en Gmail.");
  }

  await prisma.actionHistory.update({
    where: { id: last.id },
    data: { undone: true },
  });

  const email = await getEmailById(session.user.id, last.gmailMessageId);
  const remaining = await prisma.actionHistory.count({
    where: { userId: session.user.id, undone: false },
  });

  return NextResponse.json({
    ok: true,
    email,
    gmailMessageId: last.gmailMessageId,
    remaining,
  });
}
