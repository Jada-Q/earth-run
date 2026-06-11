"use client";

// Thin React shell — mounts EarthRunApp on a fullscreen canvas. HUD, title
// screen and touch joystick arrive with the race systems.

import { useEffect, useRef } from "react";
import { EarthRunApp } from "@/lib/three/game-app";
import ToonBackdrop from "./ToonBackdrop";

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<EarthRunApp | null>(null);

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

  return (
    <>
      <ToonBackdrop />
      <canvas
        ref={canvasRef}
        className="fixed inset-0 h-full w-full cursor-grab active:cursor-grabbing"
        aria-label="Earth Run"
      />
    </>
  );
}
