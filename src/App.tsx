import { useEffect, useRef, useState } from "react";
import { Hud } from "@/components/Hud";
import { Panels } from "@/components/Panels";
import { DeathScreen, MenuScreen, PauseScreen } from "@/components/Screens";
import { TouchControls } from "@/components/Touch";
import { Engine, type Snapshot } from "@/game/engine";
import { initSprites } from "@/game/sprites";

export default function App() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const engineRef = useRef<Engine | null>(null);
  const [snap, setSnap] = useState<Snapshot | null>(null);
  const [panel, setPanel] = useState<"inv" | "craft" | null>(null);
  const [touch, setTouch] = useState(false);

  useEffect(() => {
    initSprites();
    setTouch(window.matchMedia("(pointer: coarse)").matches);
    const engine = new Engine();
    engineRef.current = engine;
    engine.onSync = (s) => setSnap(s);
    if (canvasRef.current) engine.mount(canvasRef.current);
    engine.sync();
    return () => {
      engine.unmount();
      engineRef.current = null;
    };
  }, []);

  // UI hotkeys
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const engine = engineRef.current;
      if (!engine) return;
      const k = e.key.toLowerCase();
      if (k === "tab" || k === "i" || k === "ш") {
        e.preventDefault();
        if (engine.phase !== "play") return;
        setPanel((p) => (p === "inv" ? null : "inv"));
      } else if (k === "c" || k === "с") {
        if (engine.phase !== "play") return;
        setPanel((p) => (p === "craft" ? null : "craft"));
      } else if (k === "escape" || k === "p" || k === "з") {
        if (engine.phase !== "play") return;
        setPanel((p) => {
          if (p) return null;
          engine.togglePause();
          return null;
        });
      } else if (k === "enter" && engine.phase === "menu") {
        engine.start();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  useEffect(() => {
    engineRef.current?.setUiPause(panel !== null);
  }, [panel]);

  useEffect(() => {
    if (snap && snap.phase !== "play" && panel) setPanel(null);
  }, [snap, panel]);

  const engine = engineRef.current;

  return (
    <div className="relative h-screen w-screen overflow-hidden bg-[#0b0d16]">
      <canvas ref={canvasRef} className="absolute inset-0 block h-full w-full touch-none" />
      <div className="scanline" />
      <div className="vignette" />

      {engine && snap && snap.phase === "play" && (
        <>
          <Hud
            s={snap}
            engine={engine}
            onInv={() => setPanel((p) => (p === "inv" ? null : "inv"))}
            onCraft={() => setPanel((p) => (p === "craft" ? null : "craft"))}
          />
          {touch && !panel && !snap.paused && <TouchControls engine={engine} />}
        </>
      )}

      {engine && snap && panel && (
        <Panels s={snap} engine={engine} tab={panel} setTab={setPanel} onClose={() => setPanel(null)} />
      )}

      {engine && snap && snap.phase === "menu" && <MenuScreen s={snap} engine={engine} />}
      {engine && snap && snap.phase === "dead" && <DeathScreen s={snap} engine={engine} />}
      {engine && snap && snap.phase === "play" && snap.paused && <PauseScreen engine={engine} />}
    </div>
  );
}
