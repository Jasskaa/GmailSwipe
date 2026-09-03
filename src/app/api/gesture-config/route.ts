import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const ACTIONS = ["trash", "archive", "keep", "label"] as const;
const FILTER_TYPES = ["inbox", "unread", "label", "query"] as const;
type Action = (typeof ACTIONS)[number];
type FilterType = (typeof FILTER_TYPES)[number];

function isAction(v: unknown): v is Action {
  return typeof v === "string" && (ACTIONS as readonly string[]).includes(v);
}
function isFilterType(v: unknown): v is FilterType {
  return typeof v === "string" && (FILTER_TYPES as readonly string[]).includes(v);
}
function isNullableString(v: unknown): v is string | null {
  return v === null || typeof v === "string";
}

export async function GET() {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const config = await prisma.gestureConfig.upsert({
    where: { userId: session.user.id },
    update: {},
    create: { userId: session.user.id },
  });

  return NextResponse.json({ config });
}

export async function PUT(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.user) {
    return NextResponse.json({ error: "No autenticado." }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "Body inválido." }, { status: 400 });
  }

  const {
    leftAction,
    leftLabelId,
    rightAction,
    rightLabelId,
    upAction,
    upLabelId,
    downEnabled,
    downAction,
    downLabelId,
    filterType,
    filterLabelId,
    filterQuery,
  } = body as Record<string, unknown>;

  if (
    !isAction(leftAction) ||
    !isAction(rightAction) ||
    !isAction(upAction) ||
    !isAction(downAction) ||
    !isFilterType(filterType) ||
    typeof downEnabled !== "boolean" ||
    !isNullableString(leftLabelId) ||
    !isNullableString(rightLabelId) ||
    !isNullableString(upLabelId) ||
    !isNullableString(downLabelId) ||
    !isNullableString(filterLabelId) ||
    !isNullableString(filterQuery)
  ) {
    return NextResponse.json({ error: "Campos inválidos." }, { status: 400 });
  }

  // Cada acción "label" necesita su labelId; y el filtro "label"/"query" necesitan su valor.
  const pairsNeedingLabel: [Action, string | null][] = [
    [leftAction, leftLabelId],
    [rightAction, rightLabelId],
    [upAction, upLabelId],
    ...(downEnabled ? ([[downAction, downLabelId]] as [Action, string | null][]) : []),
  ];
  if (pairsNeedingLabel.some(([action, labelId]) => action === "label" && !labelId)) {
    return NextResponse.json(
      { error: "Falta elegir una etiqueta para algún gesto configurado como 'Etiquetar'." },
      { status: 400 }
    );
  }
  if (filterType === "label" && !filterLabelId) {
    return NextResponse.json({ error: "Falta elegir la etiqueta a revisar." }, { status: 400 });
  }
  if (filterType === "query" && !filterQuery?.trim()) {
    return NextResponse.json({ error: "Falta la búsqueda de Gmail a usar." }, { status: 400 });
  }

  const config = await prisma.gestureConfig.upsert({
    where: { userId: session.user.id },
    update: {
      leftAction,
      leftLabelId,
      rightAction,
      rightLabelId,
      upAction,
      upLabelId,
      downEnabled,
      downAction,
      downLabelId,
      filterType,
      filterLabelId,
      filterQuery,
    },
    create: {
      userId: session.user.id,
      leftAction,
      leftLabelId,
      rightAction,
      rightLabelId,
      upAction,
      upLabelId,
      downEnabled,
      downAction,
      downLabelId,
      filterType,
      filterLabelId,
      filterQuery,
    },
  });

  return NextResponse.json({ config });
}
