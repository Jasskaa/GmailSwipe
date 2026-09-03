"use client";

import { useEffect, useRef } from "react";
import { motion, useMotionValue, useTransform, animate, type MotionValue } from "framer-motion";
import { EmailCard, type SwipeEmail } from "@/components/EmailCard";
import { ACTION_TITLE, type Direction } from "@/lib/actionLabels";

const SWIPE_THRESHOLD = 120;
const VELOCITY_THRESHOLD = 500;
const SPRING_BACK = { type: "spring" as const, stiffness: 350, damping: 26 };

function flyTarget(direction: Direction): { x: number; y: number } {
  switch (direction) {
    case "left":
      return { x: -700, y: -30 };
    case "right":
      return { x: 700, y: -30 };
    case "up":
      return { x: 0, y: -700 };
    case "down":
      return { x: 0, y: 700 };
  }
}

function resolveDirection(
  offset: { x: number; y: number },
  velocity: { x: number; y: number },
  downEnabled: boolean
): Direction | null {
  const absX = Math.abs(offset.x);
  const absY = Math.abs(offset.y);

  if (absX >= absY) {
    if (offset.x <= -SWIPE_THRESHOLD || velocity.x <= -VELOCITY_THRESHOLD) return "left";
    if (offset.x >= SWIPE_THRESHOLD || velocity.x >= VELOCITY_THRESHOLD) return "right";
  } else {
    if (offset.y <= -SWIPE_THRESHOLD || velocity.y <= -VELOCITY_THRESHOLD) return "up";
    if (downEnabled && (offset.y >= SWIPE_THRESHOLD || velocity.y >= VELOCITY_THRESHOLD)) {
      return "down";
    }
  }
  return null;
}

type StampPosition = "left" | "right" | "up" | "down";

function Stamp({
  label,
  opacity,
  position,
}: {
  label: string;
  opacity: MotionValue<number>;
  position: StampPosition;
}) {
  const positionClasses: Record<StampPosition, string> = {
    left: "left-6 top-8 -rotate-12 border-red-500 text-red-500",
    right: "right-6 top-8 rotate-12 border-green-500 text-green-500",
    up: "left-1/2 top-4 -translate-x-1/2 border-blue-500 text-blue-500",
    down: "left-1/2 bottom-4 -translate-x-1/2 border-amber-500 text-amber-500",
  };
  return (
    <motion.div
      style={{ opacity }}
      className={`pointer-events-none absolute select-none rounded-lg border-4 px-3 py-1 text-lg font-black uppercase tracking-wide ${positionClasses[position]}`}
    >
      {label}
    </motion.div>
  );
}

export function SwipeCard({
  email,
  actionFor,
  downEnabled,
  isTop,
  stackIndex,
  externalTrigger,
  onCommit,
  onExpand,
}: {
  email: SwipeEmail;
  actionFor: (direction: Direction) => string;
  downEnabled: boolean;
  isTop: boolean;
  stackIndex: number;
  externalTrigger: { direction: Direction; nonce: number } | null;
  onCommit: (direction: Direction) => void;
  onExpand: () => void;
}) {
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotate = useTransform(x, [-250, 250], [-18, 18]);

  const leftOpacity = useTransform(x, [-140, -30], [1, 0]);
  const rightOpacity = useTransform(x, [30, 140], [0, 1]);
  const upOpacity = useTransform(y, [-140, -30], [1, 0]);
  const downOpacity = useTransform(y, [30, 140], [0, 1]);

  // Framer Motion puede disparar onTap justo después de un onDragEnd para el
  // mismo gesto (arrastrar y soltar cuenta, para el reconocedor de tap, como
  // "toque"). Este flag evita que un swipe abra el modal de correo completo.
  const draggedRef = useRef(false);

  function fling(direction: Direction) {
    const target = flyTarget(direction);
    animate(x, target.x, { duration: 0.35, ease: "easeOut" });
    animate(y, target.y, { duration: 0.35, ease: "easeOut" });
    onCommit(direction);
  }

  const DRAG_TAP_GUARD = 6; // px: por debajo de esto, se considera un tap

  function handleDrag(
    _event: unknown,
    info: { offset: { x: number; y: number } }
  ) {
    if (Math.abs(info.offset.x) > DRAG_TAP_GUARD || Math.abs(info.offset.y) > DRAG_TAP_GUARD) {
      draggedRef.current = true;
    }
  }

  function handleDragEnd(
    _event: unknown,
    info: { offset: { x: number; y: number }; velocity: { x: number; y: number } }
  ) {
    if (Math.abs(info.offset.x) > DRAG_TAP_GUARD || Math.abs(info.offset.y) > DRAG_TAP_GUARD) {
      draggedRef.current = true;
    }
    const direction = resolveDirection(info.offset, info.velocity, downEnabled);
    if (direction) {
      fling(direction);
    } else {
      animate(x, 0, SPRING_BACK);
      animate(y, 0, SPRING_BACK);
    }
  }

  // Disparo externo (botón circular) en vez de arrastre.
  useEffect(() => {
    if (!externalTrigger || !isTop) return;
    fling(externalTrigger.direction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [externalTrigger?.nonce]);

  return (
    <motion.div
      className="absolute inset-x-0 top-0 flex justify-center"
      initial={false}
      animate={
        isTop
          ? { scale: 1, y: 0, opacity: 1 }
          : { scale: 1 - stackIndex * 0.05, y: stackIndex * 14, opacity: 1 }
      }
      style={{ zIndex: 10 - stackIndex }}
    >
      <motion.div
        drag={isTop}
        dragElastic={0.7}
        style={isTop ? { x, y, rotate } : undefined}
        onDrag={isTop ? handleDrag : undefined}
        onDragEnd={isTop ? handleDragEnd : undefined}
        onTap={() => {
          if (draggedRef.current) {
            // Fue un arrastre, no un toque: lo consumimos y no expandimos.
            draggedRef.current = false;
            return;
          }
          if (isTop) onExpand();
        }}
        className="relative w-full max-w-md touch-none cursor-grab active:cursor-grabbing"
      >
        <EmailCard email={email} />

        {isTop && (
          <>
            <Stamp label={ACTION_TITLE[actionFor("right")] ?? "→"} opacity={rightOpacity} position="right" />
            <Stamp label={ACTION_TITLE[actionFor("left")] ?? "←"} opacity={leftOpacity} position="left" />
            <Stamp label={ACTION_TITLE[actionFor("up")] ?? "↑"} opacity={upOpacity} position="up" />
            {downEnabled && (
              <Stamp
                label={ACTION_TITLE[actionFor("down")] ?? "↓"}
                opacity={downOpacity}
                position="down"
              />
            )}
          </>
        )}
      </motion.div>
    </motion.div>
  );
}
