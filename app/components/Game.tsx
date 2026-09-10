"use client";

import { useEffect, useRef, useState } from "react";
import { EarthRunApp } from "@/lib/three/game-app";
import { OUTFITS } from "@/lib/three/runner";
import { DESTINATIONS, type JourneyHud } from "@/lib/three/journey";
import ToonBackdrop from "./ToonBackdrop";

const STAMPS_KEY = "earth-run:travel-stamps:v1";
const button = "rounded-xl border border-[#526b60]/30 bg-[#fff9eb]/95 px-4 py-3 text-sm font-medium shadow-sm transition hover:bg-white disabled:opacity-40 disabled:cursor-not-allowed";
const primary = button + " !bg-[#315f59] !text-[#fff9eb]";

export default function Game() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const appRef = useRef<EarthRunApp | null>(null);
  const musicRef = useRef<{ setMuted(value: boolean): void; dispose(): void } | null>(null);
  const photoTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [started, setStarted] = useState(false);
  const [hud, setHud] = useState<JourneyHud | null>(null);
  const [outfit, setOutfit] = useState(0);
  const [muted, setMuted] = useState(false);
  const [stamps, setStamps] = useState<string[]>([]);
  const [modal, setModal] = useState<"passport" | "travel" | "photo" | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photographing, setPhotographing] = useState(false);
  const [notice, setNotice] = useState("");
  const [fuel, setFuel] = useState(1);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STAMPS_KEY) || "[]");
      if (Array.isArray(saved)) setStamps(saved.filter((k): k is string => typeof k === "string" && DESTINATIONS.some(c => c.key === k)));
      const idx = Number(localStorage.getItem("earth-run:outfit"));
      if (Number.isInteger(idx) && idx >= 0 && idx < OUTFITS.length) setOutfit(idx);
      setMuted(localStorage.getItem("earth-run:muted") === "1");
    } catch { /* Storage is optional in private browsing. */ }
    const app = new EarthRunApp({ canvas: canvasRef.current! });
    appRef.current = app;
    let disposePane: (() => void) | undefined;
    if (new URLSearchParams(location.search).get("debug") === "1") {
      import("@/lib/three/debug-pane").then(async ({ mountDebugPane }) => {
        if (appRef.current === app) disposePane = await mountDebugPane(app);
      });
    }
    return () => {
      appRef.current = null; disposePane?.(); app.dispose();
      if (photoTimer.current) clearTimeout(photoTimer.current);
      musicRef.current?.dispose(); musicRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      setHud(appRef.current?.journeyHud() ?? null);
      setFuel(appRef.current?.flightFuel() ?? 1);
    }, 100);
    return () => clearInterval(id);
  }, [started]);
  useEffect(() => {
    appRef.current?.setPaused(!!modal || photographing);
  }, [modal, photographing]);
  useEffect(() => {
    if (!notice) return;
    const id = setTimeout(() => setNotice(""), 3500);
    return () => clearTimeout(id);
  }, [notice]);

  const begin = () => {
    appRef.current?.startGame(OUTFITS[outfit]); setStarted(true);
    void import("@/lib/three/music").then(({ startMusic }) => {
      if (!appRef.current || musicRef.current) return;
      musicRef.current = startMusic(); musicRef.current.setMuted(muted);
    });
  };
  const interact = () => {
    const app = appRef.current;
    if (!app || modal || photographing || !app.journeyHud()?.ready) return;
    if (hud?.stage === "departure") { setModal("travel"); return; }
    if (!app.stampVisit()) return;
    const key = hud!.key;
    setStamps(previous => {
      const next = [...new Set([...previous, key])];
      try { localStorage.setItem(STAMPS_KEY, JSON.stringify(next)); } catch { /* In-memory passport remains usable. */ }
      return next;
    });
    if (!hud?.scenic) app.toggleScenic();
    setPhotographing(true);
    photoTimer.current = setTimeout(() => {
      if (!appRef.current) return;
      try { setPhoto(appRef.current.capturePostcard()); } catch { setPhoto(null); }
      setPhotographing(false); setModal("photo");
    }, 1200);
  };
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement) return;
      if (event.key.toLowerCase() === "e" && !event.repeat) interact();
      if (event.key === "Escape" && modal !== "photo") setModal(null);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const closePhoto = () => { setModal(null); if (appRef.current?.journeyHud()?.scenic) appRef.current.toggleScenic(); setNotice("印章已收入旅行护照，小狗会带你去旅行站。"); };
  const movement = (forward: number, turn: number) => ({
    onPointerDown: (event: React.PointerEvent<HTMLButtonElement>) => {
      event.preventDefault(); event.currentTarget.setPointerCapture(event.pointerId);
      appRef.current?.moveControl(forward, turn);
    },
    onPointerUp: () => appRef.current?.moveControl(0, 0),
    onPointerCancel: () => appRef.current?.moveControl(0, 0),
    onLostPointerCapture: () => appRef.current?.moveControl(0, 0),
  });

  return <>
    <ToonBackdrop />
    <canvas ref={canvasRef} className="fixed inset-0 h-full w-full touch-none" aria-label="Earth Run 旅行世界" />
    {!started ? <main className="pointer-events-none fixed inset-0 z-30 flex flex-col items-center justify-between px-6 py-12 text-[#284d47]">
      <div className="text-center"><p className="text-xs tracking-[.35em]">EARTH RUN</p><h1 className="mt-3 text-4xl font-semibold sm:text-5xl">和小狗，一起看世界</h1><p className="mt-3 text-sm">第一站 · 东京 / 散步、合影、收集旅行印章</p></div>
      <div className="pointer-events-auto flex max-w-sm flex-col items-center gap-5 rounded-3xl bg-[#fff9eb]/90 p-6 shadow-sm">
        <div className="flex gap-4">{OUTFITS.map((o, i) => <button key={o.label} aria-label={`选择服装 ${o.label}`} aria-pressed={outfit === i} onClick={() => { setOutfit(i); try { localStorage.setItem("earth-run:outfit", String(i)); } catch {} }} style={{ backgroundColor: o.jacket }} className={`h-9 w-9 rounded-full border-2 ${outfit === i ? "border-[#d9a352] ring-2 ring-[#d9a352]/40" : "border-transparent"}`} />)}</div>
        <button className={primary + " w-full"} onClick={begin}>出发去东京 →</button>
        <p className="text-center text-xs leading-6">WASD / 方向键移动 · 空格跳跃<br />也可以点「跟随小狗」，轻松到达目的地。</p>
      </div>
    </main> : <>
      <header className="fixed inset-x-4 top-4 z-30 mx-auto flex max-w-xl items-start justify-between gap-3 text-[#284d47]">
        <div className="rounded-2xl bg-[#fff9eb]/95 px-4 py-3 shadow-sm" aria-live="polite">
          <p className="text-xs opacity-70">{hud?.city ?? "正在抵达东京…"} · 与小狗的旅行</p>
          <p className="mt-1 font-semibold">{hud?.stage === "departure" ? "前往旅行站 · 港口接驳" : `到${hud?.title ?? "东京塔"}合影`}</p>
          {hud && <p className="mt-1 text-xs">{hud.ready ? "已到达 · 可以互动" : `沿金色标记前进 · ${hud.distance} 米`}</p>}
        </div>
        <button className={button} onClick={() => setModal("passport")}>护照 {stamps.length}/11</button>
      </header>
      <div className="fixed right-4 top-32 z-30 flex flex-col items-end gap-2 text-[#284d47]">
        <button className={button} aria-expanded={cameraOpen} onClick={() => setCameraOpen(!cameraOpen)}>镜头 / 操作</button>
        {cameraOpen && <div className="rounded-2xl bg-[#fff9eb]/95 p-2 shadow-sm">
        <div className="flex justify-end gap-1">
          <button className={button + " !px-3"} aria-label="镜头左转" onClick={() => appRef.current?.cameraControl(-.35, 0)}>‹</button>
          <button className={button + " !px-3"} aria-label="拉近镜头" onClick={() => appRef.current?.cameraControl(0, -.2)}>＋</button>
          <button className={button + " !px-3"} aria-label="拉远镜头" onClick={() => appRef.current?.cameraControl(0, .2)}>−</button>
          <button className={button + " !px-3"} aria-label="镜头右转" onClick={() => appRef.current?.cameraControl(.35, 0)}>›</button>
        </div>
        <button className={button} onPointerDown={e => { e.preventDefault(); e.currentTarget.setPointerCapture(e.pointerId); appRef.current?.pressJump(); appRef.current?.setJumpHeld(true); }} onPointerUp={() => appRef.current?.setJumpHeld(false)} onPointerCancel={() => appRef.current?.setJumpHeld(false)} onLostPointerCapture={() => appRef.current?.setJumpHeld(false)}>跳跃 / 按住飞行{fuel < 1 ? ` · ${Math.round(fuel * 100)}%` : ""}</button>
        </div>}
      </div>
      {notice && <p role="status" className="fixed inset-x-5 top-32 z-40 mx-auto max-w-md rounded-xl bg-[#315f59] px-4 py-3 text-center text-sm text-white">{notice}</p>}
      <div className="fixed bottom-5 left-4 z-30 flex flex-col gap-2 text-[#284d47]">
        <div className="flex gap-2"><button className={button} aria-label="向左转" {...movement(0, 1)}>↶</button><button className={button} aria-label="向前走" {...movement(1, 0)}>↑</button><button className={button} aria-label="向右转" {...movement(0, -1)}>↷</button></div>
        <button className={button} onClick={() => { const next = !muted; setMuted(next); musicRef.current?.setMuted(next); try { localStorage.setItem("earth-run:muted", next ? "1" : "0"); } catch {} }}>音乐 {muted ? "关" : "开"}</button>
      </div>
      <div className="fixed bottom-5 right-4 z-30 flex max-w-[55vw] flex-col gap-2 text-[#284d47]">
        <button className={primary} disabled={!hud || !!modal || photographing} onClick={() => appRef.current?.followDog()}>{hud?.following ? "停下来看看" : "跟随小狗"}</button>
        <button className={button} disabled={!hud?.ready || photographing} onClick={interact}>{photographing ? "正在取景…" : hud?.stage === "departure" ? "选择下一站" : "合影并盖章"}</button>
        <button className={button} onClick={() => appRef.current?.toggleScenic()}>{hud?.scenic ? "回到人物" : "看看景点全貌"}</button>

      </div>
    </>}
    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#183d38]/55 p-5 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-label={modal === "passport" ? "旅行护照" : modal === "travel" ? "选择下一站" : "旅行明信片"} className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-[#fff9eb] p-6 text-[#284d47] shadow-xl">
        {modal === "photo" ? <>
          <p className="text-xs tracking-widest">TRAVEL MEMORIES</p><h2 className="mt-2 text-2xl font-semibold">{hud?.city} · 到此一游</h2>
          {photo ? <img src={photo} alt={`${hud?.title}旅行全景明信片`} className="my-5 max-h-[42vh] w-full rounded-xl object-contain" /> : <p className="my-5">合影暂时无法生成，旅行印章已保存。</p>}
          <p className="text-sm">✓ {hud?.title}印章已收集。全景保持实际比例，高大地标旁的人物会很小。</p>
          <div className="mt-5 flex flex-wrap gap-3">{photo && <a className={button} href={photo} download={`earth-run-${hud?.key}.png`}>保存明信片</a>}<button className={primary} autoFocus onClick={closePhoto}>去旅行站 →</button></div>
        </> : <>
          <h2 className="text-2xl font-semibold">{modal === "passport" ? "你的旅行护照" : "下一站，去哪里？"}</h2>
          <p className="mb-5 mt-2 text-sm opacity-75">{modal === "passport" ? "每座城市留下一张合影、一枚印章。印章会保存在这台设备上。" : "旅行站接驳港口或机场，直接抵达下一座城市的步行路线。"}</p>
          <div className="grid grid-cols-2 gap-3">{DESTINATIONS.map(city => modal === "passport" ? <div key={city.key} className={`rounded-xl border p-4 ${stamps.includes(city.key) ? "border-[#b58a4a] bg-[#e9d7ac]/35" : "border-[#526b60]/15 opacity-60"}`}><p className="font-semibold">{stamps.includes(city.key) ? "✓ " : "○ "}{city.label}</p><p className="mt-1 text-xs">{city.title}</p></div> : <button key={city.key} disabled={city.key === hud?.key} className={button + " text-left"} onClick={() => { appRef.current?.travelTo(city.key); setModal(null); setNotice(`已抵达${city.label}，一起去${city.title}看看。`); }}><span className="block font-semibold">{city.label}{city.key === hud?.key ? " · 当前" : " →"}</span><span className="text-xs">{city.title}</span></button>)}</div>
          <button autoFocus className={button + " mt-5 w-full"} onClick={() => setModal(null)}>继续散步</button>
        </>}
      </section>
    </div>}
  </>;
}
