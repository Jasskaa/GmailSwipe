// Etiquetas/iconos compartidos entre la pantalla de swipe (tarjeta, sellos,
// botones) para no repetir los mismos mapas en varios componentes.

export type Direction = "left" | "right" | "up" | "down";

export const ACTION_ICON: Record<string, string> = {
  trash: "🗑️",
  archive: "📥",
  keep: "✅",
  label: "🏷️",
};

export const ACTION_TITLE: Record<string, string> = {
  trash: "Eliminar",
  archive: "Archivar",
  keep: "Mantener en bandeja",
  label: "Etiquetar",
};

export const DIRECTION_ARROW: Record<Direction, string> = {
  left: "⬅️",
  right: "➡️",
  up: "⬆️",
  down: "⬇️",
};
