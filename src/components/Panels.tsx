import { ITEMS, RECIPES, type ItemId } from "@/game/data";
import type { Engine, Snapshot } from "@/game/engine";
import { iconUrl } from "@/game/sprites";

function InvGrid({ s, engine }: { s: Snapshot; engine: Engine }) {
  return (
    <div>
      <div className="mb-2 text-[11px] text-white/50">
        Клик по предмету: еда — съесть, вещь — переложить в пояс. Пояс — первые 6 ячеек.
      </div>
      <div className="grid grid-cols-6 gap-1">
        {s.inv.map((slot, i) => (
          <button
            key={i}
            onClick={() => engine.useSlot(i)}
            title={slot ? `${ITEMS[slot.id].name} — ${ITEMS[slot.id].desc}` : "Пусто"}
            className={`slot relative flex h-12 w-full items-center justify-center ${i < 6 ? "border-amber-300/40" : ""} ${
              s.hotbar === i ? "active" : ""
            }`}
          >
            {i < 6 && <span className="absolute left-0.5 top-0 text-[9px] text-amber-200/60">{i + 1}</span>}
            {slot && <img src={iconUrl(slot.id, 3)} className="pix h-8 w-8" alt={slot.id} />}
            {slot && slot.n > 1 && (
              <span className="absolute bottom-0 right-0.5 text-[10px] text-amber-200 drop-shadow-[0_1px_0_rgba(0,0,0,1)]">
                {slot.n}
              </span>
            )}
          </button>
        ))}
      </div>
    </div>
  );
}

function CraftList({ s, engine }: { s: Snapshot; engine: Engine }) {
  const have = (id: ItemId) => {
    let n = 0;
    for (const sl of s.inv) if (sl && sl.id === id) n += sl.n;
    return n;
  };
  return (
    <div className="flex flex-col gap-1.5">
      {RECIPES.map((r, i) => {
        const costs = Object.entries(r.cost) as [ItemId, number][];
        const ok = costs.every(([id, n]) => have(id) >= n) && (!r.needFire || s.nearFire);
        const def = ITEMS[r.out];
        return (
          <div key={i} className={`slot flex items-center gap-2 p-1.5 ${ok ? "" : "opacity-70"}`}>
            <img src={iconUrl(r.out, 3)} className="pix h-8 w-8 shrink-0" alt={r.out} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-1.5">
                <span className="text-[13px] text-amber-100">{def.name}</span>
                {r.count > 1 && <span className="text-[11px] text-white/50">×{r.count}</span>}
              </div>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px]">
                {costs.map(([id, n]) => (
                  <span key={id} className={have(id) >= n ? "text-lime-300" : "text-rose-300"}>
                    {ITEMS[id].name} {have(id)}/{n}
                  </span>
                ))}
                {r.needFire && <span className={s.nearFire ? "text-lime-300" : "text-rose-300"}>нужен костёр</span>}
              </div>
            </div>
            <button className="btn btn-accent shrink-0 px-2.5 py-1.5 text-[11px]" disabled={!ok} onClick={() => engine.craft(i)}>
              СОЗДАТЬ
            </button>
          </div>
        );
      })}
    </div>
  );
}

export function Panels({
  s,
  engine,
  tab,
  setTab,
  onClose,
}: {
  s: Snapshot;
  engine: Engine;
  tab: "inv" | "craft";
  setTab: (t: "inv" | "craft") => void;
  onClose: () => void;
}) {
  return (
    <div className="absolute inset-0 z-30 flex items-center justify-center bg-black/55 p-3" onClick={onClose}>
      <div className="panel w-[min(96vw,560px)] p-3" onClick={(e) => e.stopPropagation()}>
        <div className="mb-2 flex items-center gap-1">
          <button
            className={`btn px-3 py-1.5 text-[12px] ${tab === "inv" ? "btn-accent" : ""}`}
            onClick={() => setTab("inv")}
          >
            🎒 ИНВЕНТАРЬ
          </button>
          <button
            className={`btn px-3 py-1.5 text-[12px] ${tab === "craft" ? "btn-accent" : ""}`}
            onClick={() => setTab("craft")}
          >
            🔨 КРАФТ
          </button>
          <div className="flex-1" />
          <button className="btn px-3 py-1.5 text-[12px]" onClick={onClose}>
            ✕
          </button>
        </div>
        <div className="max-h-[62vh] overflow-y-auto pr-1">
          {tab === "inv" ? <InvGrid s={s} engine={engine} /> : <CraftList s={s} engine={engine} />}
        </div>
        <div className="mt-2 text-center text-[10px] text-white/40">Игра на паузе, пока открыто окно · Esc — закрыть</div>
      </div>
    </div>
  );
}
