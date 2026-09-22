import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { getNextEmail } from "@/lib/gmailMessages";
import { gmailErrorResponse } from "@/lib/apiErrors";

export async function GET(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const url = new URL(req.url);
  const excludeParam = url.searchParams.get("exclude");
  const excludeIds = excludeParam ? excludeParam.split(",").filter(Boolean) : [];

  try {
    const message = await getNextEmail(session.user.id, excludeIds);
    return NextResponse.json({ message });
  } catch (err) {
    return gmailErrorResponse(err, "No se pudo obtener el siguiente correo.");
  }
}
