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
  const [started, setStarted] = useState(false);
  const [hud, setHud] = useState<JourneyHud | null>(null);
  const [outfit, setOutfit] = useState(0);
  const [muted, setMuted] = useState(false);
  const [stamps, setStamps] = useState<string[]>([]);
  const [modal, setModal] = useState<"passport" | "travel" | "photo" | "dialogue" | null>(null);
  const [photo, setPhoto] = useState<string | null>(null);
  const [photographing, setPhotographing] = useState(false);
  const [framing, setFraming] = useState(false);
  const [photoView, setPhotoView] = useState<"portrait" | "landmark">("landmark");
  const [composition, setComposition] = useState<{ person: boolean; dog: boolean; landmark: boolean } | null>(null);
  const [dialogue, setDialogue] = useState({ title: "", text: "", action: "继续" });
  const [scarf, setScarf] = useState(false);
  const [notice, setNotice] = useState("");
  const [fuel, setFuel] = useState(1);
  const [cameraOpen, setCameraOpen] = useState(false);

  useEffect(() => {
    try {
      const saved: unknown = JSON.parse(localStorage.getItem(STAMPS_KEY) || "[]");
      if (Array.isArray(saved)) setStamps(saved.filter((k): k is string => typeof k === "string" && DESTINATIONS.some(c => c.key === k)));
      const idx = Number(localStorage.getItem("earth-run:outfit"));
      if (Number.isInteger(idx) && idx >= 0 && idx < OUTFITS.length) setOutfit(idx);
      setScarf(localStorage.getItem("earth-run:tokyo-sakura-scarf:v1") === "1");
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
      musicRef.current?.dispose(); musicRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!started) return;
    const id = setInterval(() => {
      setHud(appRef.current?.journeyHud() ?? null);
      setFuel(appRef.current?.flightFuel() ?? 1);
      if (framing) setComposition(appRef.current?.photoComposition() ?? null);
    }, 100);
    return () => clearInterval(id);
  }, [started, framing]);
  useEffect(() => {
    appRef.current?.setPaused(!!modal || photographing || framing);
  }, [modal, photographing, framing]);
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
    if (hud?.discovery?.active) {
      const result = app.interactDiscovery();
      if (!result) return;
      setDialogue(result === "request" ? { title: "绫子的相机袋", text: "我刚在长椅旁拍了樱花，回来才发现相机袋不见了。你的小狗好像闻到了什么，可以帮我找找吗？", action: "让小狗帮忙找" }
        : result === "found" ? { title: "找到了！", text: "小狗在长椅旁找到了一个粉色相机袋。把它带回去交给绫子吧。", action: "带回给绫子" }
        : { title: "谢谢你们！", text: "里面都是我今天拍的照片。送你们一条樱花领巾，给这位小帮手戴上吧！", action: "戴好领巾，继续旅行" });
      if (result === "reward") setScarf(true);
      setModal("dialogue"); return;
    }
    if (hud?.stage === "departure") { setModal("travel"); return; }
    if (!app.openPhoto()) return;
    setPhotoView("landmark"); setComposition(null); setCameraOpen(false); setFraming(true);
  };
  const cancelFraming = () => { appRef.current?.closePhoto(); setFraming(false); };
  const takePhoto = () => {
    const app = appRef.current;
    if (!app || photographing) return;
    setPhotographing(true);
    try {
      const image = app.capturePostcard();
      if (!app.stampVisit()) { setNotice("请回到合影点再拍摄。"); return; }
      setPhoto(image);
      const key = app.journeyHud()!.key;
      setStamps(previous => {
        const next = [...new Set([...previous, key])];
        try { localStorage.setItem(STAMPS_KEY, JSON.stringify(next)); } catch { /* In-memory passport remains usable. */ }
        return next;
      });
      setFraming(false); setModal("photo");
    } catch { setNotice("照片暂时无法保存，请再试一次。"); }
    finally { setPhotographing(false); }
  };

  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (event.target instanceof HTMLInputElement || event.target instanceof HTMLSelectElement || event.target instanceof HTMLButtonElement) return;
      if (event.key.toLowerCase() === "e" && !event.repeat) interact();
      if (event.key === "Escape") { if (framing) cancelFraming(); else if (modal !== "photo") setModal(null); }
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  });
  const closePhoto = () => { setModal(null); appRef.current?.closePhoto(); setNotice("印章已收入旅行护照，小狗会带你去旅行站。"); };
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
    </main> : !framing ? <>
      <header className="fixed inset-x-4 top-4 z-30 mx-auto flex max-w-xl items-start justify-between gap-3 text-[#284d47]">
        <div className="rounded-2xl bg-[#fff9eb]/95 px-4 py-3 shadow-sm" aria-live="polite">
          <p className="text-xs opacity-70">{hud?.city ?? "正在抵达东京…"} · 与小狗的旅行</p>
          <p className="mt-1 font-semibold">{hud?.discovery?.active ? hud.discovery.label : hud?.stage === "departure" ? "前往旅行站 · 港口接驳" : `到${hud?.title ?? "东京塔"}合影`}</p>
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
      {!hud?.discovery || hud.discovery.state !== "noticed" ? notice && <p role="status" className="fixed inset-x-5 top-32 z-40 mx-auto max-w-md rounded-xl bg-[#315f59] px-4 py-3 text-center text-sm text-white">{notice}</p> : null}
      {hud?.discovery?.state === "noticed" && <aside className="fixed inset-x-4 top-48 z-40 mx-auto max-w-sm rounded-2xl bg-[#fff9eb]/95 p-4 text-[#284d47] shadow-md" aria-live="polite">
        <p className="font-semibold">小狗在岔路口停了下来</p><p className="mt-2 text-sm">它闻了闻地面，又回头望着你。旁边的居民似乎正在找东西。</p>
        <div className="mt-3 flex gap-2"><button className={primary} onClick={() => appRef.current?.investigateDiscovery()}>跟过去看看</button><button className={button} onClick={() => appRef.current?.skipDiscovery()}>先去景点</button></div>
      </aside>}
      {hud?.discovery?.state === "skipped" && <button className={button + " fixed left-4 top-32 z-30 text-[#284d47]"} onClick={() => appRef.current?.investigateDiscovery()}>回岔路看看</button>}
      {hud?.discovery?.active && <button className={button + " fixed left-4 top-32 z-30 text-[#284d47]"} onClick={() => appRef.current?.skipDiscovery()}>稍后再帮忙</button>}
      <div className="fixed bottom-5 left-4 z-30 flex flex-col gap-2 text-[#284d47]">
        <div className="flex gap-2"><button className={button} aria-label="向左转" {...movement(0, 1)}>↶</button><button className={button} aria-label="向前走" {...movement(1, 0)}>↑</button><button className={button} aria-label="向右转" {...movement(0, -1)}>↷</button></div>
        <button className={button} onClick={() => { const next = !muted; setMuted(next); musicRef.current?.setMuted(next); try { localStorage.setItem("earth-run:muted", next ? "1" : "0"); } catch {} }}>音乐 {muted ? "关" : "开"}</button>
      </div>
      <div className="fixed bottom-5 right-4 z-30 flex max-w-[55vw] flex-col gap-2 text-[#284d47]">
        <button className={primary} disabled={!hud || !!modal || photographing} onClick={() => appRef.current?.followDog()}>{hud?.following ? "停下来看看" : "跟随小狗"}</button>
        <button className={button} disabled={!hud?.ready || photographing} onClick={interact}>{photographing ? "正在取景…" : hud?.discovery?.active ? hud.discovery.action : hud?.stage === "departure" ? "选择下一站" : "打开相机"}</button>
        <button className={button} onClick={() => appRef.current?.toggleScenic()}>{hud?.scenic ? "回到人物" : "看看景点全貌"}</button>

      </div>
    </> : null}
    {framing && <div className="pointer-events-none fixed inset-0 z-40 text-[#284d47]">
      <div className="absolute inset-3 rounded-xl border border-white/60">
        <div className="absolute inset-y-0 left-1/3 border-l border-white/25" /><div className="absolute inset-y-0 right-1/3 border-l border-white/25" />
        <div className="absolute inset-x-0 top-1/3 border-t border-white/25" /><div className="absolute inset-x-0 bottom-1/3 border-t border-white/25" />
      </div>
      <div className="pointer-events-auto absolute inset-x-4 top-4 mx-auto max-w-md rounded-2xl bg-[#fff9eb]/95 p-4 text-center">
        <p className="font-semibold">{hud?.title} · 你的旅行镜头</p>
        <p className="mt-1 text-xs">{composition ? `人物${composition.person ? "✓" : "未完整入镜"} · 小狗${composition.dog ? "✓" : "未完整入镜"} · 地标${composition.landmark ? "✓" : "未完整入镜"}` : "正在取景…"}</p>
        <p className="mt-1 text-xs opacity-70">自由构图，不设评分；全景里的人物会很小。</p>
      </div>
      <div className="pointer-events-auto absolute inset-x-4 bottom-5 mx-auto flex max-w-md flex-col gap-2 rounded-2xl bg-[#fff9eb]/95 p-3">
        <div className="flex justify-center gap-2">{(["landmark", "portrait"] as const).map(view => <button key={view} className={photoView === view ? primary : button} onClick={() => { setPhotoView(view); appRef.current?.setPhotoView(view); }}>{view === "landmark" ? "地标全景" : "人物与小狗"}</button>)}</div>
        <div className="flex justify-center gap-1">
          <button className={button + " !px-3"} aria-label="取景左转" onClick={() => appRef.current?.cameraControl(-.12, 0)}>←</button>
          <button className={button + " !px-3"} aria-label="取景抬高" onClick={() => appRef.current?.tiltPhoto(.06)}>↑</button>
          <button className={button + " !px-3"} aria-label="取景降低" onClick={() => appRef.current?.tiltPhoto(-.06)}>↓</button>
          <button className={button + " !px-3"} aria-label="取景右转" onClick={() => appRef.current?.cameraControl(.12, 0)}>→</button>
          <button className={button + " !px-3"} aria-label="取景放大" onClick={() => appRef.current?.cameraControl(0, -.12)}>＋</button>
          <button className={button + " !px-3"} aria-label="取景缩小" onClick={() => appRef.current?.cameraControl(0, .12)}>−</button>
        </div>
        <div className="flex justify-center gap-2"><button className={button} onClick={cancelFraming}>取消</button><button className={primary} disabled={photographing} onClick={takePhoto}>{photographing ? "保存中…" : "按下快门 · 盖章"}</button></div>
      </div>
    </div>}
    {modal && <div className="fixed inset-0 z-50 flex items-center justify-center bg-[#183d38]/55 p-5 backdrop-blur-sm">
      <section role="dialog" aria-modal="true" aria-label={modal === "passport" ? "旅行护照" : modal === "travel" ? "选择下一站" : modal === "dialogue" ? dialogue.title : "旅行明信片"} className="max-h-[88vh] w-full max-w-xl overflow-y-auto rounded-3xl bg-[#fff9eb] p-6 text-[#284d47] shadow-xl">
        {modal === "dialogue" ? <>
          <p className="text-xs tracking-widest">TOKYO · A LITTLE KINDNESS</p><h2 className="mt-2 text-2xl font-semibold">{dialogue.title}</h2>
          <p className="my-5 leading-7">{dialogue.text}</p><button autoFocus className={primary + " w-full"} onClick={() => { setModal(null); appRef.current?.followDog(); }}>{dialogue.action}</button>
        </> : modal === "photo" ? <>
          <p className="text-xs tracking-widest">TRAVEL MEMORIES</p><h2 className="mt-2 text-2xl font-semibold">{hud?.city} · 到此一游</h2>
          {photo ? <img src={photo} alt={`${hud?.title}旅行明信片`} className="my-5 max-h-[42vh] w-full rounded-xl object-contain" /> : <p className="my-5">合影暂时无法生成，旅行印章已保存。</p>}
          <p className="text-sm">✓ {hud?.title}印章已收集。照片已按你的构图生成，可以下载保存。</p>
          <div className="mt-5 flex flex-wrap gap-3">{photo && <a className={button} href={photo} download={`earth-run-${hud?.key}.png`}>保存明信片</a>}<button className={primary} autoFocus onClick={closePhoto}>去旅行站 →</button></div>
        </> : <>
          <h2 className="text-2xl font-semibold">{modal === "passport" ? "你的旅行护照" : "下一站，去哪里？"}</h2>
          <p className="mb-5 mt-2 text-sm opacity-75">{modal === "passport" ? "每座城市留下一张合影、一枚印章。印章会保存在这台设备上。" : "旅行站接驳港口或机场，直接抵达下一座城市的步行路线。"}</p>
          {modal === "passport" && <div className="mb-4 rounded-xl bg-[#ead4db]/50 p-4 text-sm"><p className="font-semibold">{scarf ? "✓ 樱花领巾 · 小狗已佩戴" : "○ 东京纪念品 · 樱花领巾"}</p><p className="mt-1">{scarf ? "和小狗一起帮绫子找回了相机袋。" : "留意东京步道上的岔路和小狗的发现。"}</p></div>}
          <div className="grid grid-cols-2 gap-3">{DESTINATIONS.map(city => modal === "passport" ? <div key={city.key} className={`rounded-xl border p-4 ${stamps.includes(city.key) ? "border-[#b58a4a] bg-[#e9d7ac]/35" : "border-[#526b60]/15 opacity-60"}`}><p className="font-semibold">{stamps.includes(city.key) ? "✓ " : "○ "}{city.label}</p><p className="mt-1 text-xs">{city.title}</p></div> : <button key={city.key} disabled={city.key === hud?.key} className={button + " text-left"} onClick={() => { appRef.current?.travelTo(city.key); setModal(null); setNotice(`已抵达${city.label}，一起去${city.title}看看。`); }}><span className="block font-semibold">{city.label}{city.key === hud?.key ? " · 当前" : " →"}</span><span className="text-xs">{city.title}</span></button>)}</div>
          <button autoFocus className={button + " mt-5 w-full"} onClick={() => setModal(null)}>继续散步</button>
        </>}
      </section>
    </div>}
  </>;
}
