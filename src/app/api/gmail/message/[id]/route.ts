import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getEmailPlainTextBody } from "@/lib/gmailMessages";
import { gmailErrorResponse } from "@/lib/apiErrors";

// Devuelve el cuerpo del correo como TEXTO PLANO (nunca HTML) para que el
// cliente lo renderice como texto sin riesgo de inyectar HTML/JS de un
// remitente. Ver src/lib/gmailMessages.ts (getEmailPlainTextBody).
export async function GET(_req: Request, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  try {
    const body = await getEmailPlainTextBody(session.user.id, params.id);
    return NextResponse.json({ body });
  } catch (err) {
    return gmailErrorResponse(err, "No se pudo cargar el correo completo.");
  }
}
