"use client";

// React shell: canvas + minimal HUD. Title screen gets fancier in a later
// step; for now a single BEGIN button drops you onto the planet, and a
// round JUMP button serves touch players.

import { useEffect, useRef, useState } from "react";
import { EarthRunApp } from "@/lib/three/game-app";
import { OUTFITS } from "@/lib/three/runner";
import type { RaceHud } from "@/lib/three/race";
import ToonBackdrop from "./ToonBackdrop";

const OUTFIT_KEY = "earth-run:outfit";

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
  const [outfitIdx, setOutfitIdx] = useState(0);
  const [landmark, setLandmark] = useState<string | null>(null);
  const [banner, setBanner] = useState<string | null>(null);
  const lastLandmarkRef = useRef<string | null>(null);
  const bannerTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = Number(localStorage.getItem(OUTFIT_KEY));
    if (Number.isInteger(saved) && saved >= 0 && saved < OUTFITS.length) {
      setOutfitIdx(saved);
    }
  }, []);

  // Poll the race HUD at 10Hz while playing.
  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      const h = appRef.current?.raceHud();
      if (h) setHud(h);
      const lm = appRef.current?.nearbyLandmark() ?? null;
      setLandmark(lm);
      // Arriving at a NEW landmark → big title card for 3.5s.
      if (lm && lm !== lastLandmarkRef.current) {
        lastLandmarkRef.current = lm;
        setBanner(lm);
        if (bannerTimerRef.current) clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = setTimeout(() => setBanner(null), 3500);
      }
      if (!lm) lastLandmarkRef.current = null;
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
    appRef.current?.startGame(OUTFITS[outfitIdx]);
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
        <div className="pointer-events-none fixed inset-x-0 bottom-[10%] z-40 flex flex-col items-center gap-5">
          <div className="pointer-events-auto flex items-center gap-3">
            {OUTFITS.map((o, i) => (
              <button
                key={o.label}
                type="button"
                aria-label={`Outfit ${o.label}`}
                title={o.label}
                onClick={() => {
                  setOutfitIdx(i);
                  try {
                    localStorage.setItem(OUTFIT_KEY, String(i));
                  } catch {
                    // private mode — selection just isn't remembered
                  }
                }}
                className={
                  "relative h-9 w-9 rounded-full border-2 transition-transform " +
                  (i === outfitIdx
                    ? "scale-110 border-[#22302c] shadow-[0_3px_0_rgba(34,48,44,0.5)]"
                    : "border-[#22302c]/40 opacity-75 hover:opacity-100")
                }
                style={{ backgroundColor: o.jacket }}
              >
                <span
                  className="absolute left-1/2 top-0.5 h-2.5 w-2.5 -translate-x-1/2 rounded-sm"
                  style={{ backgroundColor: o.crest }}
                />
              </button>
            ))}
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
            WASD / arrows to run · space to jump · E to chop trees · touch:
            left = stick, buttons = jump / chop
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
          <button
            type="button"
            aria-label="Chop"
            onPointerDown={(e) => {
              e.preventDefault();
              appRef.current?.pressChop();
            }}
            className="fixed bottom-28 right-8 z-40 h-14 w-14 select-none rounded-full border-2 border-[#22302c] bg-[#efece3]/85 font-mono text-[10px] font-bold uppercase tracking-widest text-[#22302c] shadow-[0_4px_0_rgba(34,44,44,0.45)] active:translate-y-0.5 md:hidden"
          >
            Chop
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
          {banner ? (
            <div className="pointer-events-none fixed inset-x-0 top-[18%] z-40 flex justify-center px-4">
              <div className="select-none rounded-lg border-[3px] border-[#22302c] bg-[#efece3]/95 px-8 py-4 text-center shadow-[5px_5px_0_rgba(34,48,44,0.4)]">
                <div className="font-mono text-[10px] uppercase tracking-[0.35em] text-[#22302c]/60">
                  You've reached
                </div>
                <div className="mt-1 font-serif text-2xl font-semibold italic text-[#22302c] md:text-3xl">
                  {banner}
                </div>
              </div>
            </div>
          ) : landmark ? (
            <div className="pointer-events-none fixed inset-x-0 bottom-24 z-30 flex justify-center md:bottom-28">
              <div className="select-none rounded-md border-2 border-[#22302c] bg-[#efece3]/90 px-4 py-1.5 text-center font-serif text-sm italic text-[#22302c] shadow-[3px_3px_0_rgba(34,48,44,0.35)]">
                {landmark}
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
