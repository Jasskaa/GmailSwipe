import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getProgressStats } from "@/lib/gmailMessages";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const stats = await getProgressStats(session.user.id);
    return NextResponse.json(stats);
  } catch (err) {
    console.error("Error calculando el progreso:", err);
    return NextResponse.json({ error: "No se pudo calcular el progreso." }, { status: 502 });
  }
}
