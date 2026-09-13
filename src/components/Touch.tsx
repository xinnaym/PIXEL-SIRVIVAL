import { useRef, useState } from "react";
import type { Engine } from "@/game/engine";

export function TouchControls({ engine }: { engine: Engine }) {
  const base = useRef<HTMLDivElement>(null);
  const [knob, setKnob] = useState({ x: 0, y: 0 });
  const idRef = useRef<number | null>(null);

  const move = (e: React.PointerEvent) => {
    const el = base.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cx = r.left + r.width / 2;
    const cy = r.top + r.height / 2;
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const max = r.width / 2;
    const len = Math.hypot(dx, dy) || 1;
    if (len > max) {
      dx = (dx / len) * max;
      dy = (dy / len) * max;
    }
    setKnob({ x: dx, y: dy });
    engine.setMove(dx / max, dy / max);
  };

  const end = () => {
    idRef.current = null;
    setKnob({ x: 0, y: 0 });
    engine.setMove(0, 0);
  };

  return (
    <div className="pointer-events-none absolute inset-0 z-20 select-none">
      <div
        ref={base}
        onPointerDown={(e) => {
          idRef.current = e.pointerId;
          (e.target as HTMLElement).setPointerCapture(e.pointerId);
          move(e);
        }}
        onPointerMove={(e) => {
          if (idRef.current === e.pointerId) move(e);
        }}
        onPointerUp={end}
        onPointerCancel={end}
        className="pointer-events-auto absolute bottom-24 left-4 h-32 w-32 rounded-full border-2 border-white/20 bg-black/35"
      >
        <div
          className="absolute left-1/2 top-1/2 h-14 w-14 rounded-full border-2 border-white/40 bg-white/20"
          style={{ transform: `translate(calc(-50% + ${knob.x}px), calc(-50% + ${knob.y}px))` }}
        />
      </div>

      <div className="pointer-events-auto absolute bottom-24 right-4 flex flex-col items-end gap-2">
        <div className="flex gap-2">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              className="btn h-11 w-11 rounded-full text-[12px]"
              onPointerDown={(e) => {
                e.preventDefault();
                engine.selectHotbar(i);
              }}
            >
              {i + 1}
            </button>
          ))}
        </div>
        <div className="flex items-end gap-2">
          <button
            className="btn h-14 w-14 rounded-full text-[11px]"
            onPointerDown={(e) => {
              e.preventDefault();
              engine.interactPublic();
            }}
          >
            E
          </button>
          <button
            className="btn h-14 w-14 rounded-full text-[11px]"
            onPointerDown={(e) => {
              e.preventDefault();
              engine.eatPublic();
            }}
          >
            F
          </button>
          <button
            className="btn btn-danger h-20 w-20 rounded-full text-[13px]"
            onPointerDown={(e) => {
              e.preventDefault();
              engine.setAttackHeld(true);
            }}
            onPointerUp={() => engine.setAttackHeld(false)}
            onPointerCancel={() => engine.setAttackHeld(false)}
          >
            УДАР
          </button>
        </div>
      </div>
    </div>
  );
}
