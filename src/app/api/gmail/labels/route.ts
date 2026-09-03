import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { listGmailLabels } from "@/lib/gmailApi";

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const labels = await listGmailLabels(session.user.id);
    return NextResponse.json({ labels });
  } catch (err) {
    console.error("Error listando labels de Gmail:", err);
    return NextResponse.json(
      { error: "No se pudieron obtener las etiquetas de Gmail." },
      { status: 502 }
    );
  }
}
