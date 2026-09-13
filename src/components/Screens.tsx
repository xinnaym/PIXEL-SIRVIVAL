import type { Engine, Snapshot } from "@/game/engine";
import { iconUrl } from "@/game/sprites";

const KEYS: [string, string][] = [
  ["W A S D / ←↑→↓", "движение"],
  ["Shift", "бег (тратит выносливость)"],
  ["Пробел / мышь", "удар, рубка, добыча"],
  ["E", "поставить предмет / дрова в костёр"],
  ["F", "съесть еду"],
  ["1 – 6", "выбрать предмет пояса"],
  ["I · C", "инвентарь · крафт"],
  ["Esc", "пауза"],
];

export function MenuScreen({ s, engine }: { s: Snapshot; engine: Engine }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#080a12]/85 p-3">
      <div className="panel w-[min(96vw,640px)] p-5 text-center">
        <div className="float-up mb-1 flex items-center justify-center gap-3">
          <img src={iconUrl("axe", 4)} className="pix h-12 w-12" alt="" />
          <h1 className="title-glow text-3xl leading-none tracking-wider text-lime-300 sm:text-4xl">ПИКСЕЛЬ&nbsp;ВЫЖИВАНИЕ</h1>
          <img src={iconUrl("sword", 4)} className="pix h-12 w-12" alt="" />
        </div>
        <p className="mx-auto mb-4 max-w-[440px] text-[12px] leading-relaxed text-white/65">
          Остров, топор и голод. Руби деревья, добывай камень, строй костёр и держись до рассвета — ночью из тьмы лезут упыри,
          слизни и летучие мыши.
        </p>

        <div className="mx-auto mb-4 grid max-w-[460px] grid-cols-1 gap-x-4 gap-y-1 text-left text-[11px] sm:grid-cols-2">
          {KEYS.map(([k, v]) => (
            <div key={k} className="flex items-center justify-between gap-2 border-b border-white/5 pb-0.5">
              <span className="text-amber-200">{k}</span>
              <span className="text-white/55">{v}</span>
            </div>
          ))}
        </div>

        <div className="mb-4 flex flex-wrap items-center justify-center gap-3 text-[11px] text-white/55">
          <span className="slot px-2 py-1">🍗 следи за сытостью</span>
          <span className="slot px-2 py-1">🔥 ночью нужен костёр</span>
          <span className="slot px-2 py-1">⚔ рекорд: {s.best} дн.</span>
        </div>

        <button className="btn btn-accent px-8 py-3 text-[16px] tracking-wider" onClick={() => engine.start()}>
          ▶ НАЧАТЬ ВЫЖИВАНИЕ
        </button>
      </div>
    </div>
  );
}

export function DeathScreen({ s, engine }: { s: Snapshot; engine: Engine }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-[#1a0508]/80 p-3">
      <div className="panel w-[min(94vw,440px)] p-6 text-center">
        <div className="mb-2 text-5xl">💀</div>
        <h2 className="title-glow mb-2 text-3xl tracking-wider text-rose-400">ТЫ ПОГИБ</h2>
        <p className="mb-4 text-[12px] text-white/60">Остров забрал ещё одного искателя приключений.</p>
        <div className="mb-5 grid grid-cols-3 gap-2 text-[12px]">
          <div className="slot py-2">
            <div className="text-amber-200">{Math.max(0, s.day - 1)}</div>
            <div className="text-[10px] text-white/45">дней прожито</div>
          </div>
          <div className="slot py-2">
            <div className="text-rose-300">{s.kills}</div>
            <div className="text-[10px] text-white/45">тварей убито</div>
          </div>
          <div className="slot py-2">
            <div className="text-lime-300">{s.best}</div>
            <div className="text-[10px] text-white/45">рекорд</div>
          </div>
        </div>
        <button className="btn btn-accent px-6 py-3 text-[14px] tracking-wider" onClick={() => engine.restart()}>
          ⟳ НОВЫЙ ОСТРОВ
        </button>
      </div>
    </div>
  );
}

export function PauseScreen({ engine }: { engine: Engine }) {
  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center bg-black/70 p-3">
      <div className="panel w-[min(92vw,340px)] p-5 text-center">
        <h2 className="mb-4 text-2xl tracking-widest text-sky-200">ПАУЗА</h2>
        <div className="flex flex-col gap-2">
          <button className="btn btn-accent py-2.5 text-[13px]" onClick={() => engine.togglePause()}>
            ПРОДОЛЖИТЬ
          </button>
          <button className="btn py-2.5 text-[13px]" onClick={() => engine.toggleMute()}>
            ЗВУК ВКЛ/ВЫКЛ
          </button>
          <button className="btn btn-danger py-2.5 text-[13px]" onClick={() => engine.restart()}>
            НАЧАТЬ ЗАНОВО
          </button>
        </div>
      </div>
    </div>
  );
}
