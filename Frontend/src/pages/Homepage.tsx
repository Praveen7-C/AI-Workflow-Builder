import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

/* Animated counter on scroll*/
function useCountUp(target: number, duration = 1800) {
  const [count, setCount] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const started = useRef(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting || started.current) return;
        started.current = true;
        const t0 = performance.now();
        const tick = (now: number) => {
          const p = Math.min((now - t0) / duration, 1);
          const ease = 1 - Math.pow(1 - p, 3);
          setCount(Math.round(ease * target));
          if (p < 1) requestAnimationFrame(tick);
        };
        requestAnimationFrame(tick);
      },
      { threshold: 0.4 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, [target, duration]);
  return { count, ref };
}

/* Animated SVG workflow pipeline */
const PipelineViz: React.FC = () => (
  <svg viewBox="0 0 680 200" fill="none" xmlns="http://www.w3.org/2000/svg"
    style={{ width: "100%", maxWidth: 680, height: "auto" }}>
    <defs>
      <linearGradient id="lq" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#14b8a6" stopOpacity="0.8"/>
        <stop offset="100%" stopColor="#22c55e" stopOpacity="0.8"/>
      </linearGradient>
      <linearGradient id="lk" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#22c55e" stopOpacity="0.8"/>
        <stop offset="100%" stopColor="#3b82f6" stopOpacity="0.8"/>
      </linearGradient>
      <linearGradient id="ll" x1="0" y1="0" x2="1" y2="0">
        <stop offset="0%" stopColor="#3b82f6" stopOpacity="0.8"/>
        <stop offset="100%" stopColor="#a855f7" stopOpacity="0.8"/>
      </linearGradient>
      <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="3" result="blur"/>
        <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <style>{`
        @keyframes dash { from{stroke-dashoffset:40} to{stroke-dashoffset:0} }
        @keyframes pop  { 0%,100%{opacity:1;transform:scale(1)} 50%{opacity:.65;transform:scale(.95)} }
        .line1{stroke-dasharray:6 5;animation:dash 1.6s linear infinite}
        .line2{stroke-dasharray:6 5;animation:dash 1.6s .5s linear infinite}
        .line3{stroke-dasharray:6 5;animation:dash 1.6s 1s linear infinite}
        .n1{animation:pop 3s ease-in-out infinite}
        .n2{animation:pop 3s .9s ease-in-out infinite}
        .n3{animation:pop 3s 1.8s ease-in-out infinite}
        .n4{animation:pop 3s 2.4s ease-in-out infinite}
      `}</style>
    </defs>

    {/* Connector lines */}
    {/* Query → Knowledge Base */}
    <path d="M170 100 L230 100" stroke="url(#lq)" strokeWidth="2" className="line1"/>

    {/* Knowledge Base → LLM Engine */}
    <path d="M360 100 L420 100" stroke="url(#lk)" strokeWidth="2" className="line2"/>

    {/* LLM Engine → Output */}
    <path d="M550 100 L600 80"  stroke="url(#ll)" strokeWidth="2" className="line3"/>
    <path d="M550 100 L600 120" stroke="url(#ll)" strokeWidth="2" className="line3"/>

    {/* Flow arrow heads on connector lines */}
    {/* Arrow on Query→KB line */}
    <polygon points="228,95 228,105 238,100" fill="#22c55e" opacity="0.85"/>
    {/* Arrow on KB→LLM line */}
    <polygon points="418,95 418,105 428,100" fill="#3b82f6" opacity="0.85"/>

    {/* Animated flow dots on connector lines */}
    <circle r="4" fill="#14b8a6" opacity="0.9">
      <animateMotion dur="1.2s" repeatCount="indefinite" path="M170,100 L230,100"/>
    </circle>
    <circle r="4" fill="#22c55e" opacity="0.9">
      <animateMotion dur="1.2s" begin="0.4s" repeatCount="indefinite" path="M360,100 L420,100"/>
    </circle>
    <circle r="3.5" fill="#3b82f6" opacity="0.85">
      <animateMotion dur="1.2s" begin="0.8s" repeatCount="indefinite" path="M550,100 L600,80"/>
    </circle>
    <circle r="3.5" fill="#3b82f6" opacity="0.85">
      <animateMotion dur="1.2s" begin="1s" repeatCount="indefinite" path="M550,100 L600,120"/>
    </circle>

    {/* Node 1 – User Query (teal) */}
    <g className="n1" filter="url(#glow)">
      <rect x="20" y="62" width="150" height="76" rx="12" fill="#0c1f1c" stroke="#14b8a6" strokeWidth="1.5"/>
      <rect x="20" y="62" width="150" height="24" rx="12" fill="#14b8a6" fillOpacity=".18"/>
      <rect x="20" y="74" width="150" height="12" fill="#14b8a6" fillOpacity=".18"/>
      <circle cx="36" cy="74" r="5" fill="#14b8a6"/>
      <text x="47" y="78" fontSize="9" fill="#5eead4" fontWeight="600" fontFamily="system-ui, sans-serif">User Query</text>
      <rect x="30" y="96" width="110" height="7" rx="3.5" fill="#134e4a" opacity=".7"/>
      <rect x="30" y="110" width="80"  height="7" rx="3.5" fill="#134e4a" opacity=".45"/>
      {/* Handle right */}
      <circle cx="170" cy="100" r="5" fill="#14b8a6" stroke="#0c1f1c" strokeWidth="2"/>
    </g>

    {/* Node 2 – Knowledge Base (green) */}
    <g className="n2" filter="url(#glow)">
      <rect x="230" y="62" width="130" height="76" rx="12" fill="#0c1f14" stroke="#22c55e" strokeWidth="1.5"/>
      <rect x="230" y="62" width="130" height="24" rx="12" fill="#22c55e" fillOpacity=".18"/>
      <rect x="230" y="74" width="130" height="12" fill="#22c55e" fillOpacity=".18"/>
      <circle cx="246" cy="74" r="5" fill="#22c55e"/>
      <text x="257" y="78" fontSize="9" fill="#86efac" fontWeight="600" fontFamily="system-ui, sans-serif">Knowledge Base</text>
      <rect x="240" y="96" width="100" height="7" rx="3.5" fill="#14532d" opacity=".7"/>
      <rect x="240" y="110" width="72"  height="7" rx="3.5" fill="#14532d" opacity=".45"/>
      <circle cx="230" cy="100" r="5" fill="#22c55e" stroke="#0c1f14" strokeWidth="2"/>
      <circle cx="360" cy="100" r="5" fill="#22c55e" stroke="#0c1f14" strokeWidth="2"/>
    </g>

    {/* Node 3 – LLM Engine (blue) */}
    <g className="n3" filter="url(#glow)">
      <rect x="420" y="62" width="130" height="76" rx="12" fill="#0c1422" stroke="#3b82f6" strokeWidth="1.5"/>
      <rect x="420" y="62" width="130" height="24" rx="12" fill="#3b82f6" fillOpacity=".18"/>
      <rect x="420" y="74" width="130" height="12" fill="#3b82f6" fillOpacity=".18"/>
      <circle cx="436" cy="74" r="5" fill="#3b82f6"/>
      <text x="447" y="78" fontSize="9" fill="#93c5fd" fontWeight="600" fontFamily="system-ui, sans-serif">LLM Engine</text>
      <rect x="430" y="96" width="100" height="7" rx="3.5" fill="#1e3a5f" opacity=".7"/>
      <rect x="430" y="110" width="72"  height="7" rx="3.5" fill="#1e3a5f" opacity=".45"/>
      <circle cx="420" cy="100" r="5" fill="#3b82f6" stroke="#0c1422" strokeWidth="2"/>
      <circle cx="550" cy="100" r="5" fill="#3b82f6" stroke="#0c1422" strokeWidth="2"/>
    </g>

    {/* Node 4a – Output top (purple) */}
    <g className="n4" filter="url(#glow)">
      <rect x="600" y="52" width="64" height="38" rx="10" fill="#150c22" stroke="#a855f7" strokeWidth="1.5"/>
      <circle cx="616" cy="68" r="9" fill="#a855f7" fillOpacity=".2"/>
      <circle cx="616" cy="68" r="4" fill="#a855f7"/>
      <text x="627" y="72" fontSize="8" fill="#d8b4fe" fontWeight="600" fontFamily="system-ui, sans-serif">Output</text>
    </g>
    {/* Node 4b – Output bottom */}
    <g className="n4" filter="url(#glow)">
      <rect x="600" y="104" width="64" height="38" rx="10" fill="#150c22" stroke="#a855f7" strokeWidth="1.5"/>
      <rect x="610" y="114" width="44" height="6" rx="3" fill="#a855f7" opacity=".55"/>
      <rect x="610" y="124" width="30" height="6" rx="3" fill="#a855f7" opacity=".35"/>
    </g>
  </svg>
);

/* Feature cards data*/
const FEATURES = [
  {
    color: "#14b8a6",
    bg: "rgba(20,184,166,0.08)",
    border: "rgba(20,184,166,0.2)",
    title: "Visual Pipeline Builder",
    desc: "Drag nodes onto the canvas and wire them together — no code. Build complex RAG pipelines in minutes.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
        <rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/>
        <rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/>
        <line x1="7" y1="10" x2="7" y2="14"/><line x1="17" y1="10" x2="17" y2="14"/>
        <line x1="10" y1="7" x2="14" y2="7"/>
      </svg>
    ),
  },
  {
    color: "#22c55e",
    bg: "rgba(34,197,94,0.08)",
    border: "rgba(34,197,94,0.2)",
    title: "RAG Knowledge Base",
    desc: "Upload PDFs and power your AI with real documents via Gemini embeddings + ChromaDB vector store.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
        <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414A1 1 0 0119 8.414V19a2 2 0 01-2 2z"/>
      </svg>
    ),
  },
  {
    color: "#f59e0b",
    bg: "rgba(245,158,11,0.08)",
    border: "rgba(245,158,11,0.2)",
    title: "Gemini-Powered LLM",
    desc: "Gemini 2.5 Flash drives generation with automatic model fallback — zero downtime, always responsive.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
        <path d="M13 10V3L4 14h7v7l9-11h-7z"/>
      </svg>
    ),
  },
  {
    color: "#3b82f6",
    bg: "rgba(59,130,246,0.08)",
    border: "rgba(59,130,246,0.2)",
    title: "Live Web Search",
    desc: "Augment every response with real-time SerpAPI results or free Wikipedia fallback. Always current.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
        <circle cx="11" cy="11" r="8"/><path d="M21 21l-4.35-4.35"/>
      </svg>
    ),
  },
  {
    color: "#a855f7",
    bg: "rgba(168,85,247,0.08)",
    border: "rgba(168,85,247,0.2)",
    title: "Built-in Chat Interface",
    desc: "Chat with your workflow directly. Test queries, inspect context, and iterate — all in one place.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z"/>
      </svg>
    ),
  },
  {
    color: "#ec4899",
    bg: "rgba(236,72,153,0.08)",
    border: "rgba(236,72,153,0.2)",
    title: "Real-Time Execution Logs",
    desc: "Watch every node execute step by step. Identify bottlenecks and debug with surgical precision.",
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round">
        <path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/>
      </svg>
    ),
  },
];

/* Stat card */
function StatCard({ target, suffix, label, prefix = "" }: { target: number; suffix: string; label: string; prefix?: string }) {
  const { count, ref } = useCountUp(target);
  return (
    <div ref={ref} style={{
      padding: "32px 24px",
      background: "rgba(15,42,36,.55)",
      borderRadius: 16,
      border: "1px solid rgba(20,184,166,.14)",
      backdropFilter: "blur(14px)",
      textAlign: "center",
    }}>
      <div style={{
        fontFamily: "'DM Sans', sans-serif",
        fontSize: "clamp(2rem,3.5vw,2.8rem)",
        fontWeight: 700,
        color: "#14b8a6",
        letterSpacing: "-.02em",
        lineHeight: 1,
        marginBottom: 8,
      }}>
        {prefix}{count}{suffix}
      </div>
      <div style={{ fontSize: ".8rem", color: "#5eead4", fontWeight: 400, letterSpacing: ".04em" }}>
        {label}
      </div>
    </div>
  );
}

/* Main */
const HomePage: React.FC = () => {
  const navigate = useNavigate();
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const fn = () => setScrolled(window.scrollY > 24);
    window.addEventListener("scroll", fn, { passive: true });
    return () => window.removeEventListener("scroll", fn);
  }, []);

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@400;600;700;800&family=DM+Sans:ital,wght@0,300;0,400;0,500;1,300&display=swap');

        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .hp { font-family: 'DM Sans', sans-serif; background: #040d0b; color: #dff5ef; min-height: 100vh; overflow-x: hidden; }

        /* layered background */
        .hp-bg {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background:
            radial-gradient(ellipse 100% 65% at 0% -5%,  rgba(20,184,166,.20) 0%, transparent 55%),
            radial-gradient(ellipse 55% 45% at 100% 10%,  rgba(16,185,129,.10) 0%, transparent 50%),
            radial-gradient(ellipse 70% 55% at 50% 105%,  rgba(20,184,166,.09) 0%, transparent 55%),
            #040d0b;
        }
        .hp-grid {
          position: fixed; inset: 0; z-index: 0; pointer-events: none;
          background-image:
            linear-gradient(rgba(20,184,166,.055) 1px, transparent 1px),
            linear-gradient(90deg, rgba(20,184,166,.055) 1px, transparent 1px);
          background-size: 52px 52px;
        }
        .hp-body { position: relative; z-index: 1; }

        /* NAV */
        .hp-nav {
          position: sticky; top: 0; z-index: 200;
          display: flex; align-items: center; justify-content: space-between;
          padding: 0 52px; height: 68px;
          transition: background .3s, border-color .3s, box-shadow .3s;
        }
        .hp-nav.stuck {
          background: rgba(4,13,11,.90);
          border-bottom: 1px solid rgba(20,184,166,.13);
          box-shadow: 0 4px 40px rgba(0,0,0,.45);
          backdrop-filter: blur(22px);
        }

        /* Logo button */
        .logo-btn {
          display: flex; align-items: center; gap: 11px;
          background: none; border: none; padding: 0; cursor: pointer;
          text-decoration: none;
        }
        .logo-img {
          height: 38px; width: auto; display: block;
          filter: drop-shadow(0 0 10px rgba(20,184,166,.55)) brightness(1.15);
          transition: filter .25s;
        }
        .logo-btn:hover .logo-img {
          filter: drop-shadow(0 0 18px rgba(20,184,166,.85)) brightness(1.3);
        }
        .logo-wordmark {
          font-family: 'DM Sans', sans-serif; font-weight: 600; font-size: 1.05rem;
          color: #dff5ef; letter-spacing: -.01em; white-space: nowrap;
        }
        .logo-wordmark em { font-style: normal; color: #14b8a6; }

        /* Nav links */
        .nav-links { display: flex; align-items: center; gap: 34px; }
        .nav-link {
          display: flex; align-items: center; gap: 4px;
          font-size: .875rem; color: rgba(223,245,239,.5);
          background: none; border: none; cursor: pointer;
          transition: color .2s;
        }
        .nav-link:hover { color: #dff5ef; }
        .nav-right { display: flex; align-items: center; gap: 16px; }
        .nav-signin {
          font-size: .875rem; color: #5eead4; font-weight: 500;
          background: none; border: none; cursor: pointer; transition: color .2s;
        }
        .nav-signin:hover { color: #99f6e4; }
        .nav-cta {
          padding: 9px 22px; border-radius: 9px;
          font-family: 'DM Sans', sans-serif; font-size: .875rem; font-weight: 600;
          background: #14b8a6; color: #030d0b; border: none; cursor: pointer;
          transition: background .2s, transform .15s, box-shadow .2s;
        }
        .nav-cta:hover { background: #2dd4bf; transform: translateY(-1px); box-shadow: 0 6px 28px rgba(20,184,166,.38); }

        /* HERO */
        .hp-hero {
          min-height: calc(100vh - 68px);
          display: flex; flex-direction: column; align-items: center; justify-content: center;
          padding: 90px 24px 70px; text-align: center; position: relative;
        }

        @keyframes fadeUp { from{opacity:0;transform:translateY(22px)} to{opacity:1;transform:translateY(0)} }
        .a0{animation:fadeUp .65s .05s ease both}
        .a1{animation:fadeUp .65s .18s ease both}
        .a2{animation:fadeUp .65s .32s ease both}
        .a3{animation:fadeUp .65s .46s ease both}
        .a4{animation:fadeUp .65s .62s ease both}
        .a5{animation:fadeUp .65s .80s ease both}

        .hero-badge {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 6px 18px; border-radius: 999px;
          border: 1px solid rgba(20,184,166,.38);
          background: rgba(20,184,166,.07);
          font-size: .72rem; font-weight: 600; color: #5eead4;
          letter-spacing: .12em; text-transform: uppercase; margin-bottom: 30px;
        }
        @keyframes blink{0%,100%{opacity:1}50%{opacity:.25}}
        .badge-dot { width:6px;height:6px;border-radius:50%;background:#14b8a6;animation:blink 2.2s ease-in-out infinite; }

        .hero-h1 {
          font-family: 'DM Sans', sans-serif; font-weight: 700;
          font-size: clamp(2.7rem,5.5vw,5.2rem);
          line-height: 1.06; letter-spacing: -.03em; color: #dff5ef;
          max-width: 800px; margin: 0 auto 22px;
        }
        .hero-h1 .gr {
          background: linear-gradient(135deg, #14b8a6 0%, #34d399 45%, #a3e635 100%);
          -webkit-background-clip: text; -webkit-text-fill-color: transparent; background-clip: text;
        }
        .hero-sub {
          font-size: clamp(.95rem,1.8vw,1.15rem);
          color: rgba(223,245,239,.5); max-width: 510px;
          line-height: 1.76; margin: 0 auto 50px; font-weight: 300;
        }

        .cta-row { display:flex;align-items:center;justify-content:center;gap:14px;margin-bottom:68px;flex-wrap:wrap; }

        .btn-primary {
          display: inline-flex; align-items: center; gap: 9px;
          padding: 14px 36px; border-radius: 10px;
          font-family: 'DM Sans', sans-serif; font-size: .95rem; font-weight: 600;
          background: #14b8a6; color: #030d0b; border: none; cursor: pointer;
          transition: background .2s, transform .15s, box-shadow .2s; letter-spacing: .01em;
        }
        .btn-primary:hover { background:#2dd4bf;transform:translateY(-2px);box-shadow:0 10px 38px rgba(20,184,166,.42); }
        .btn-primary svg { transition: transform .2s; }
        .btn-primary:hover svg { transform: translateX(3px); }

        .btn-ghost {
          display: inline-flex; align-items: center; gap: 8px;
          padding: 13px 28px; border-radius: 10px; font-size: .95rem; font-weight: 500;
          background: transparent; color: rgba(223,245,239,.7);
          border: 1px solid rgba(20,184,166,.18); cursor: pointer;
          transition: border-color .2s, color .2s, background .2s, transform .15s;
        }
        .btn-ghost:hover { border-color:rgba(20,184,166,.48);color:#dff5ef;background:rgba(20,184,166,.07);transform:translateY(-2px); }

        /* Pipeline card */
        .pipeline-card {
          width: 100%; max-width: 700px; margin: 0 auto 76px;
          padding: 28px 28px 22px;
          background: rgba(10,28,24,.72);
          border: 1px solid rgba(20,184,166,.14);
          border-radius: 20px;
          backdrop-filter: blur(18px);
          box-shadow: 0 0 0 1px rgba(20,184,166,.07), 0 32px 80px rgba(0,0,0,.5), inset 0 1px 0 rgba(20,184,166,.09);
        }
        .pipeline-label {
          display: flex; align-items: center; gap: 7px; margin-bottom: 18px;
          font-size: .68rem; font-weight: 600; letter-spacing: .12em;
          text-transform: uppercase; color: rgba(94,234,212,.45);
        }
        .pipeline-label-dot { width:6px;height:6px;border-radius:50%;background:#14b8a6;opacity:.6; }

        /* Stats */
        .stats-grid {
          display: grid; grid-template-columns: repeat(3,1fr); gap: 14px;
          width: 100%; max-width: 680px; margin: 0 auto;
        }

        /* FEATURES SECTION */
        .features-wrap { padding: 110px 52px; max-width: 1180px; margin: 0 auto; }
        .section-eyebrow {
          display: inline-flex; align-items: center; gap: 10px;
          font-size: .7rem; font-weight: 600; letter-spacing: .15em;
          text-transform: uppercase; color: #14b8a6; margin-bottom: 16px;
        }
        .section-eyebrow::before { content:'';display:block;width:22px;height:2px;background:#14b8a6;border-radius:1px; }
        .section-h2 {
          font-family: 'DM Sans', sans-serif; font-weight: 700;
          font-size: clamp(1.75rem,3vw,2.65rem); letter-spacing: -.025em;
          color: #dff5ef; line-height: 1.1; max-width: 520px; margin-bottom: 58px;
        }
        .section-h2 span { color: #14b8a6; }

        .feat-grid { display:grid;grid-template-columns:repeat(auto-fit,minmax(290px,1fr));gap:20px; }
        .feat-card {
          padding: 32px 28px; border-radius: 16px;
          background: rgba(9,26,22,.65);
          border: 1px solid rgba(20,184,166,.09);
          transition: transform .25s, border-color .25s, box-shadow .25s;
          position: relative; overflow: hidden;
        }
        .feat-card::after {
          content:'';position:absolute;top:0;left:0;right:0;height:1px;
          background:linear-gradient(90deg,transparent,currentColor,transparent);
          opacity:0;transition:opacity .3s;
        }
        .feat-card:hover { transform:translateY(-5px);border-color:rgba(20,184,166,.26);box-shadow:0 22px 60px rgba(0,0,0,.45); }
        .feat-card:hover::after { opacity:1; }
        .feat-icon {
          width:46px;height:46px;border-radius:12px;
          display:flex;align-items:center;justify-content:center;
          margin-bottom:20px;transition:transform .2s;
        }
        .feat-card:hover .feat-icon { transform:scale(1.08); }
        .feat-title { font-family:'DM Sans',sans-serif;font-size:1rem;font-weight:600;color:#dff5ef;margin-bottom:10px;letter-spacing:-.01em; }
        .feat-desc { font-size:.875rem;color:rgba(223,245,239,.45);line-height:1.68;font-weight:300; }

        /* HOW IT WORKS */
        .how-wrap { padding:80px 52px 110px;max-width:920px;margin:0 auto;text-align:center; }
        .steps-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:0;margin-top:56px;position:relative; }
        .steps-grid::before {
          content:'';position:absolute;top:27px;left:12%;right:12%;height:1px;
          background:linear-gradient(90deg,transparent,rgba(20,184,166,.28),transparent);
        }
        .step { display:flex;flex-direction:column;align-items:center;padding:0 14px;position:relative; }
        .step-num {
          width:54px;height:54px;border-radius:50%;
          display:flex;align-items:center;justify-content:center;
          font-family:'DM Sans',sans-serif;font-weight:700;font-size:1rem;color:#14b8a6;
          background:#040d0b;border:1px solid rgba(20,184,166,.28);
          position:relative;z-index:1;margin-bottom:20px;
          transition:background .25s,box-shadow .25s;
          backdrop-filter:blur(8px);
        }
        .step:hover .step-num { background:rgba(20,184,166,.12);box-shadow:0 0 26px rgba(20,184,166,.3); }
        .step-title { font-family:'DM Sans',sans-serif;font-size:.93rem;font-weight:600;color:#dff5ef;margin-bottom:8px;letter-spacing:-.01em; }
        .step-desc { font-size:.8rem;color:rgba(223,245,239,.42);line-height:1.62; }

        /* CTA BANNER */
        .cta-banner {
          margin:0 52px 100px;border-radius:24px;padding:80px 52px;
          text-align:center;position:relative;overflow:hidden;
          background:radial-gradient(ellipse 80% 80% at 50% 0%,rgba(20,184,166,.16) 0%,transparent 68%),rgba(9,24,20,.92);
          border:1px solid rgba(20,184,166,.18);
        }
        .cta-banner::before {
          content:'';position:absolute;top:0;left:0;right:0;height:1px;
          background:linear-gradient(90deg,transparent,#14b8a6,transparent);opacity:.55;
        }
        .cta-banner h2 {
          font-family:'DM Sans',sans-serif;font-size:clamp(1.6rem,3vw,2.5rem);
          font-weight:700;color:#dff5ef;letter-spacing:-.025em;margin-bottom:14px;
        }
        .cta-banner p { font-size:1rem;color:rgba(223,245,239,.45);margin-bottom:36px;font-weight:300; }

        /* FOOTER */
        .hp-footer {
          border-top:1px solid rgba(20,184,166,.09);
          padding:36px 52px;display:flex;align-items:center;
          justify-content:space-between;flex-wrap:wrap;gap:16px;
        }
        .footer-copy { font-size:.78rem;color:rgba(223,245,239,.28); }
        .footer-trust {
          font-size:.78rem;color:rgba(223,245,239,.28);
          display:flex;align-items:center;gap:8px;
        }
        .footer-trust::before { content:'';width:6px;height:6px;border-radius:50%;background:#14b8a6;opacity:.45; }

        @media(max-width:768px){
          .hp-nav{padding:0 20px;}
          .nav-links{display:none;}
          .features-wrap,.how-wrap{padding:70px 24px;}
          .cta-banner{margin:0 20px 70px;padding:48px 28px;}
          .hp-footer{padding:28px 24px;flex-direction:column;align-items:flex-start;}
          .stats-grid{grid-template-columns:1fr;}
          .steps-grid{grid-template-columns:1fr 1fr;gap:32px;}
          .steps-grid::before{display:none;}
        }
        @media(max-width:480px){
          .steps-grid{grid-template-columns:1fr;}
        }
      `}</style>

      <div className="hp">
        <div className="hp-bg" />
        <div className="hp-grid" />

        <div className="hp-body">

          {/* NAV */}
          <nav className={`hp-nav${scrolled ? " stuck" : ""}`}>
            {/* Logo → homepage */}
            <button className="logo-btn" onClick={() => navigate("/")}>
              <img
                src="https://framerusercontent.com/images/pFpeWgK03UT38AQl5d988Epcsc.svg?scale-down-to=512"
                alt="AI Planet Logo"
                className="logo-img"
              />
            </button>

            <div className="nav-links">
              {["Products", "Models", "Solutions"].map((n) => (
                <button key={n} className="nav-link">
                  {n}
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7"/>
                  </svg>
                </button>
              ))}
              <button className="nav-link">Community</button>
            </div>

            <div className="nav-right">
              <button className="nav-cta" onClick={() => navigate("/stacks")}>Get Started</button>
            </div>
          </nav>

          {/* HERO */}
          <section className="hp-hero">
            <div className="hero-badge a0">
              <span className="badge-dot" />
              GenAI Workflow Platform
            </div>

            <h1 className="hero-h1 a1">
              Build & Deploy{" "}
              <span className="gr">GenAI Apps</span>
              <br />in Minutes, Not Months
            </h1>

            <p className="hero-sub a2">
              Visual RAG pipeline builder powered by Gemini, ChromaDB and live web search.
              No code. Enterprise-ready from day one.
            </p>

            <div className="cta-row a3">
              <button
                className="btn-primary"
                onClick={() => navigate("/stacks")}
              >
                Get Started Free
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
                </svg>
              </button>
            </div>

            {/* Animated pipeline visualization */}
            <div className="pipeline-card a4">
              <div className="pipeline-label">
                <span className="pipeline-label-dot" />
                Live Pipeline Preview
              </div>
              <PipelineViz />
            </div>

            {/* Stats */}
            <div className="stats-grid a5">
              <StatCard target={20}  suffix="x"         label="Faster Deployment" />
              <StatCard target={30}  suffix="x" prefix="up to " label="Infra Cost Savings" />
              <StatCard target={10}  suffix="x"         label="Productivity Gains" />
            </div>
          </section>

          {/* FEATURES */}
          <section className="features-wrap">
            <div className="section-eyebrow">Platform Capabilities</div>
            <h2 className="section-h2">
              Everything to ship<br />
              <span>production-ready AI</span>
            </h2>
            <div className="feat-grid">
              {FEATURES.map((f) => (
                <div key={f.title} className="feat-card" style={{ color: f.color }}>
                  <div
                    className="feat-icon"
                    style={{ background: f.bg, border: `1px solid ${f.border}`, color: f.color }}
                  >
                    {f.icon}
                  </div>
                  <div className="feat-title">{f.title}</div>
                  <div className="feat-desc">{f.desc}</div>
                </div>
              ))}
            </div>
          </section>

          {/* HOW IT WORKS */}
          <section className="how-wrap">
            <div className="section-eyebrow" style={{ justifyContent: "center" }}>How It Works</div>
            <h2 className="section-h2" style={{ margin: "0 auto 0", textAlign: "center", maxWidth: 560 }}>
              From idea to <span>deployed AI</span><br />in four steps
            </h2>
            <div className="steps-grid">
              {[
                { n: "01", t: "Create a Stack",    d: "Name your workflow and initialise it in seconds." },
                { n: "02", t: "Add Nodes",          d: "Drag Query, KB, LLM and Output nodes onto the canvas." },
                { n: "03", t: "Upload Documents",   d: "Feed PDFs to the knowledge base for RAG retrieval." },
                { n: "04", t: "Run & Chat",          d: "Execute the pipeline and chat with your AI instantly." },
              ].map((s) => (
                <div key={s.n} className="step">
                  <div className="step-num">{s.n}</div>
                  <div className="step-title">{s.t}</div>
                  <div className="step-desc">{s.d}</div>
                </div>
              ))}
            </div>
          </section>

          {/* CTA BANNER */}
          <div className="cta-banner">
            <h2>Ready to build your first AI workflow?</h2>
            <p>Join 300,000+ developers and enterprises already deploying GenAI solutions with AI Planet.</p>
            <button className="btn-primary" onClick={() => navigate("/stacks")}>
              Start Building Now
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6"/>
              </svg>
            </button>
          </div>

          {/* FOOTER */}
          <footer className="hp-footer">
            <button className="logo-btn" onClick={() => navigate("/")}>
              <img
                src="https://framerusercontent.com/images/pFpeWgK03UT38AQl5d988Epcsc.svg?scale-down-to=512"
                alt="AI Planet Logo"
                className="logo-img"
                style={{ height: 28 }}
              />
            </button>
            <div className="footer-copy">© 2025 AI Planet. All rights reserved.</div>
            <div className="footer-trust">Trusted by 300k+ global community</div>
          </footer>
        </div>
      </div>
    </>
  );
};

export default HomePage;