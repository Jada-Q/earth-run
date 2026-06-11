"use client";

// React shell: canvas + minimal HUD. Title screen gets fancier in a later
// step; for now a single BEGIN button drops you onto the planet, and a
// round JUMP button serves touch players.

import { useEffect, useRef, useState } from "react";
import { EarthRunApp } from "@/lib/three/game-app";
import type { RaceHud } from "@/lib/three/race";
import ToonBackdrop from "./ToonBackdrop";

function fmt(ms: number): string {
  const t = Math.max(0, Math.round(ms));
  const m = Math.floor(t / 60000);
  const s = Math.floor((t % 60000) / 1000);
  const d = Math.floor((t % 1000) / 100);
  return `${m}:${s.toString().padStart(2, "0")}.${d}`;
}

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<EarthRunApp | null>(null);
  const [started, setStarted] = useState(false);
  const [hud, setHud] = useState<RaceHud | null>(null);

  // Poll the race HUD at 10Hz while playing.
  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      const h = appRef.current?.raceHud();
      if (h) setHud(h);
    }, 100);
    return () => clearInterval(id);
  }, [started]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const app = new EarthRunApp({ canvas });
    appRef.current = app;
    let disposePane: (() => void) | null = null;
    const debugFlag =
      new URLSearchParams(window.location.search).get("debug") === "1";
    if (process.env.NODE_ENV === "development" || debugFlag) {
      (window as unknown as { __gameApp?: EarthRunApp }).__gameApp = app;
      import("@/lib/three/debug-pane").then(async ({ mountDebugPane }) => {
        if (appRef.current === app) disposePane = await mountDebugPane(app);
      });
    }
    return () => {
      appRef.current = null;
      disposePane?.();
      app.dispose();
    };
  }, []);

  const handleBegin = () => {
    setStarted(true);
    appRef.current?.startGame();
  };

  return (
    <>
      <ToonBackdrop />
      <canvas
        ref={canvasRef}
        className="fixed inset-0 h-full w-full touch-none"
        aria-label="Earth Run"
      />
      {!started ? (
        <div className="pointer-events-none fixed inset-x-0 bottom-[12%] z-40 flex flex-col items-center gap-6">
          <div className="select-none text-center font-mono text-4xl font-bold uppercase tracking-[0.35em] text-[#22302c] md:text-5xl">
            Earth Run
          </div>
          <button
            type="button"
            onClick={handleBegin}
            autoFocus
            className="pointer-events-auto select-none rounded-[4px] border-2 border-[#22302c] bg-[#e8ab3c] px-8 py-2.5 font-mono text-sm font-bold uppercase tracking-[0.3em] text-[#22302c] shadow-[0_5px_0_rgba(34,48,44,0.55)] transition-transform duration-150 hover:scale-105 active:translate-y-1 active:shadow-[0_2px_0_rgba(34,48,44,0.55)] md:text-base"
          >
            Begin
          </button>
          <div className="select-none text-center font-serif text-xs italic text-[#22302c]/70">
            WASD / arrows to run · space to jump · touch: left = stick,
            button = jump
          </div>
        </div>
      ) : (
        <>
          <button
            type="button"
            aria-label="Jump"
            onPointerDown={(e) => {
              e.preventDefault();
              appRef.current?.pressJump();
            }}
            className="fixed bottom-8 right-8 z-40 h-16 w-16 select-none rounded-full border-2 border-[#22302c] bg-[#efece3]/85 font-mono text-[11px] font-bold uppercase tracking-widest text-[#22302c] shadow-[0_4px_0_rgba(34,44,44,0.45)] active:translate-y-0.5 md:hidden"
          >
            Jump
          </button>
          {hud && hud.state !== "finished" ? (
            <div className="pointer-events-none fixed inset-x-0 top-5 z-40 flex justify-center">
              <div className="select-none rounded-md border-2 border-[#22302c] bg-[#efece3]/90 px-4 py-1.5 text-center text-[#22302c] shadow-[3px_3px_0_rgba(34,48,44,0.35)]">
                <span className="font-mono text-lg font-bold tabular-nums">
                  {fmt(hud.elapsedMs)}
                </span>
                <span className="ml-3 font-mono text-xs">
                  {hud.index}/{hud.total}
                </span>
                <span className="ml-3 font-serif text-xs italic">
                  → {hud.targetName}
                </span>
                {hud.bestMs !== null ? (
                  <span className="ml-3 font-mono text-[10px] opacity-60">
                    best {fmt(hud.bestMs)}
                  </span>
                ) : null}
              </div>
            </div>
          ) : null}
          {hud && hud.state === "finished" ? (
            <div className="pointer-events-none fixed inset-x-0 top-[30%] z-40 flex flex-col items-center gap-4">
              <div className="select-none rounded-md border-2 border-[#22302c] bg-[#efece3] px-7 py-4 text-center text-[#22302c] shadow-[4px_4px_0_rgba(34,48,44,0.4)]">
                <div className="font-mono text-[11px] uppercase tracking-[0.3em] opacity-70">
                  Around the world in
                </div>
                <div className="mt-1 font-mono text-3xl font-bold tabular-nums">
                  {fmt(hud.elapsedMs)}
                </div>
                {hud.newRecord ? (
                  <div className="mt-1 font-mono text-xs font-bold uppercase tracking-[0.25em]">
                    ★ new record
                  </div>
                ) : hud.bestMs !== null ? (
                  <div className="mt-1 font-mono text-[11px] opacity-60">
                    best {fmt(hud.bestMs)}
                  </div>
                ) : null}
              </div>
              <button
                type="button"
                onClick={() => appRef.current?.restartRace()}
                className="pointer-events-auto select-none rounded-[4px] border-2 border-[#22302c] bg-[#e8ab3c] px-6 py-2 font-mono text-sm font-bold uppercase tracking-[0.25em] text-[#22302c] shadow-[0_4px_0_rgba(34,48,44,0.55)] transition-transform duration-150 hover:scale-105 active:translate-y-1"
              >
                Run again
              </button>
            </div>
          ) : null}
        </>
      )}
    </>
  );
}
