import { ITEMS } from "@/game/data";
import type { Engine, Snapshot } from "@/game/engine";
import { iconUrl } from "@/game/sprites";

function Bar({ value, max, color, icon, label }: { value: number; max: number; color: string; icon: string; label: string }) {
  const pct = Math.max(0, Math.min(100, (value / max) * 100));
  const low = pct < 25;
  return (
    <div className="flex items-center gap-1.5" title={label}>
      <span className={`w-4 text-center text-[13px] leading-none ${low ? "blink" : ""}`}>{icon}</span>
      <div className="bar h-[14px] w-[104px] sm:w-[132px]">
        <div className="bar-fill" style={{ width: `${pct}%`, background: color }} />
        <div className="ticks" />
        <div className="absolute inset-0 flex items-center justify-center text-[10px] tracking-wide text-white/90 drop-shadow-[0_1px_0_rgba(0,0,0,0.9)]">
          {Math.ceil(value)}
        </div>
      </div>
    </div>
  );
}

function Slot({
  index,
  id,
  n,
  active,
  onClick,
  showKey,
}: {
  index: number;
  id?: string;
  n?: number;
  active?: boolean;
  onClick?: () => void;
  showKey?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      title={id ? `${ITEMS[id as keyof typeof ITEMS].name} — ${ITEMS[id as keyof typeof ITEMS].desc}` : "Пусто"}
      className={`slot relative h-11 w-11 sm:h-12 sm:w-12 ${active ? "active" : ""} flex items-center justify-center`}
    >
      {showKey && <span className="absolute left-0.5 top-0 text-[9px] text-white/40">{index + 1}</span>}
      {id && <img src={iconUrl(id, 3)} className="pix h-8 w-8" alt={id} />}
      {n && n > 1 ? (
        <span className="absolute bottom-0 right-0.5 text-[10px] text-amber-200 drop-shadow-[0_1px_0_rgba(0,0,0,1)]">{n}</span>
      ) : null}
    </button>
  );
}

export function Hud({
  s,
  engine,
  onInv,
  onCraft,
}: {
  s: Snapshot;
  engine: Engine;
  onInv: () => void;
  onCraft: () => void;
}) {
  const hot = s.inv.slice(0, 6);
  const dayPct = Math.round(s.clock * 100);
  return (
    <>
      {/* stats */}
      <div className="pointer-events-none absolute left-2 top-2 flex flex-col gap-1">
        <div className="panel pointer-events-auto flex flex-col gap-1 px-2 py-2">
          <Bar value={s.hp} max={s.maxHp} color="linear-gradient(180deg,#ff7a7a,#c1303c)" icon="❤" label="Здоровье" />
          <Bar value={s.hunger} max={100} color="linear-gradient(180deg,#ffc46b,#c97a24)" icon="🍗" label="Сытость" />
          <Bar value={s.warmth} max={100} color="linear-gradient(180deg,#8fd6ff,#3a7fc1)" icon="🔥" label="Тепло" />
          <Bar value={s.stamina} max={100} color="linear-gradient(180deg,#a9f08c,#4f9d54)" icon="⚡" label="Выносливость" />
        </div>
      </div>

      {/* day / clock */}
      <div className="absolute right-2 top-2 flex flex-col items-end gap-1">
        <div className="panel flex items-center gap-2 px-3 py-2">
          <span className="text-[18px] leading-none">{s.isNight ? "🌙" : "☀"}</span>
          <div className="flex flex-col">
            <span className="text-[13px] leading-tight text-amber-200">ДЕНЬ {s.day}</span>
            <div className="bar mt-0.5 h-[6px] w-[86px]">
              <div
                className="bar-fill"
                style={{
                  width: `${dayPct}%`,
                  background: s.isNight ? "linear-gradient(90deg,#2b3b7a,#6b7ddb)" : "linear-gradient(90deg,#ffd45e,#ff9f43)",
                }}
              />
            </div>
          </div>
        </div>
        <div className="flex gap-1">
          <button className="btn px-2 py-1 text-[11px]" onClick={() => engine.toggleMute()} title="Звук (M)">
            {s.muted ? "🔇" : "🔊"}
          </button>
          <button className="btn px-2 py-1 text-[11px]" onClick={onCraft} title="Крафт (C)">
            🔨 КРАФТ
          </button>
          <button className="btn px-2 py-1 text-[11px]" onClick={onInv} title="Инвентарь (I)">
            🎒 СУМКА
          </button>
          <button className="btn px-2 py-1 text-[11px]" onClick={() => engine.togglePause()} title="Пауза (Esc)">
            ⏸
          </button>
        </div>
        <div className="panel px-2 py-1 text-[10px] text-white/60">
          {s.biome} · убито: <span className="text-rose-300">{s.kills}</span> · рекорд: <span className="text-amber-200">{s.best} дн.</span>
        </div>
      </div>

      {/* toasts */}
      <div className="pointer-events-none absolute left-1/2 top-3 flex w-[min(92vw,520px)] -translate-x-1/2 flex-col items-center gap-1">
        {s.toasts.map((t) => (
          <div
            key={t.id}
            className={`toast-in panel px-3 py-1.5 text-center text-[12px] ${
              t.kind === "bad" ? "text-rose-300" : t.kind === "good" ? "text-lime-300" : "text-sky-200"
            }`}
          >
            {t.text}
          </div>
        ))}
      </div>

      {/* hotbar */}
      <div className="absolute bottom-2 left-1/2 flex -translate-x-1/2 flex-col items-center gap-1">
        <div className="panel px-2 py-1 text-center text-[11px] text-white/65">{s.tip}</div>
        <div className="panel flex gap-1 p-1.5">
          {hot.map((slot, i) => (
            <Slot
              key={i}
              index={i}
              id={slot?.id}
              n={slot?.n}
              active={s.hotbar === i}
              showKey
              onClick={() => engine.selectHotbar(i)}
            />
          ))}
        </div>
      </div>
    </>
  );
}
