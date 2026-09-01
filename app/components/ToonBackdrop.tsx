// CSS-only backdrop for the toon theme: mint sky with vertical depth
// (deeper zenith to warm pale horizon), a soft amber sun bloom, the faint
// same-hue swirl hint, sparse pale "sea foam" dots, and a paper-grain
// overlay. Zero GPU cost — the WebGL canvas renders with alpha on top.

export default function ToonBackdrop() {
  return (
    // z-0 (not negative): body's own background paints ABOVE negative
    // z-index descendants, so -z-10 here would be swallowed by bg-black.
    // DOM order keeps the canvas (rendered after) on top.
    <>
      <div
        aria-hidden
        className="fixed inset-0 z-0"
        style={{
          backgroundImage: [
            // warm sun bloom, upper-right, matches the warm key light
            "radial-gradient(ellipse 48% 34% at 74% 12%, rgba(255,236,170,0.5), transparent 70%)",
            // faint swirl hint, top-left, same hue slightly lighter
            "radial-gradient(ellipse 42% 30% at 18% 12%, rgba(255,255,255,0.10), transparent 70%)",
            "radial-gradient(ellipse 30% 22% at 30% 22%, rgba(255,255,255,0.06), transparent 70%)",
            // sparse foam dots — two offset grids of tiny pale specks
            "radial-gradient(rgba(255,255,255,0.16) 1.2px, transparent 1.6px)",
            "radial-gradient(rgba(255,255,255,0.10) 1px, transparent 1.4px)",
            // vertical depth: deeper mint zenith to warm pale horizon
            "linear-gradient(to bottom, #4fadb8 0%, #66c4bd 52%, #cfe8d9 100%)",
          ].join(", "),
          backgroundSize:
            "100% 100%, 100% 100%, 100% 100%, 220px 220px, 140px 140px, 100% 100%",
          backgroundPosition: "0 0, 0 0, 0 0, 0 0, 70px 90px, 0 0",
        }}
      />
      {/* Paper-grain overlay: micro radial-dot pattern at very low opacity.
          Gives the backdrop a watercolour-paper tooth without any GPU cost.
          pointer-events-none so it doesn't block canvas interaction. */}
      <div
        aria-hidden
        className="fixed inset-0 pointer-events-none"
        style={{
          zIndex: 1,
          backgroundImage:
            "radial-gradient(circle, rgba(60,40,20,0.18) 1px, transparent 1px)",
          backgroundSize: "3px 3px",
          opacity: 0.045,
          mixBlendMode: "multiply",
        }}
      />
    </>
  );
}
