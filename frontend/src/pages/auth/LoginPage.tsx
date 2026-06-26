import { useEffect, useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Navigate } from 'react-router-dom';
import { useAuthStore } from '@/store/auth';
import { loginSchema, type LoginInput } from '@/features/auth/schemas';
import { useLogin } from '@/features/auth/useLogin';

interface Dot { x: number; y: number; vx: number; vy: number; r: number; }

export function LoginPage() {
    const user = useAuthStore(s => s.user);
    const { mutate, isPending, error, isError } = useLogin();

    const loginError = isError
      ? ((error as { response?: { data?: { errors?: { message: string }[] } } })
          ?.response?.data?.errors?.[0]?.message ?? 'Invalid email or password. Please try again.')
      : null;
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const panelRef = useRef<HTMLDivElement>(null);
    const [showLoader, setShowLoader] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const loaderTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const loaderStart = useRef<number | null>(null);

    useEffect(() => {
        if (isPending) {
            loaderStart.current = Date.now();
            setShowLoader(true);
        } else if (loaderStart.current !== null) {
            const elapsed = Date.now() - loaderStart.current;
            const remaining = Math.max(0, 3000 - elapsed);
            loaderTimer.current = setTimeout(() => {
                setShowLoader(false);
                loaderStart.current = null;
            }, remaining);
        }
        return () => { if (loaderTimer.current) clearTimeout(loaderTimer.current); };
    }, [isPending]);

    useEffect(() => {
        if (!isError) return;
        if (loaderTimer.current) clearTimeout(loaderTimer.current);
        setShowLoader(false);
        loaderStart.current = null;
    }, [isError]);

    const form = useForm<LoginInput>({
        resolver: zodResolver(loginSchema),
        defaultValues: { email: '', password: '' },
    });

    useEffect(() => {
        const canvas = canvasRef.current;
        const panel = panelRef.current;
        if (!canvas || !panel) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        let W = 0, H = 0, dots: Dot[] = [], raf: number;

        const resize = () => {
            W = panel.clientWidth;
            H = panel.clientHeight;
            canvas.width = W;
            canvas.height = H;
            const n = Math.max(Math.floor((W * H) / 11000), 50);
            dots = Array.from({ length: n }, () => ({
                x: Math.random() * W,
                y: Math.random() * H,
                vx: (Math.random() - 0.5) * 0.38,
                vy: (Math.random() - 0.5) * 0.38,
                r: Math.random() * 1.6 + 0.6,
            }));
        };

        const tick = () => {
            ctx.clearRect(0, 0, W, H);
            for (const d of dots) {
                d.x += d.vx; d.y += d.vy;
                if (d.x < 0) d.x = W; else if (d.x > W) d.x = 0;
                if (d.y < 0) d.y = H; else if (d.y > H) d.y = 0;
            }
            const MAX = 135;
            for (let i = 0; i < dots.length; i++) {
                for (let j = i + 1; j < dots.length; j++) {
                    const dx = dots[i].x - dots[j].x;
                    const dy = dots[i].y - dots[j].y;
                    const dist = Math.sqrt(dx * dx + dy * dy);
                    if (dist < MAX) {
                        const a = (1 - dist / MAX) * 0.22;
                        ctx.strokeStyle = `rgba(100,165,255,${a})`;
                        ctx.lineWidth = 0.7;
                        ctx.beginPath();
                        ctx.moveTo(dots[i].x, dots[i].y);
                        ctx.lineTo(dots[j].x, dots[j].y);
                        ctx.stroke();
                    }
                }
            }
            for (const d of dots) {
                ctx.fillStyle = 'rgba(145,195,255,0.78)';
                ctx.beginPath();
                ctx.arc(d.x, d.y, d.r, 0, Math.PI * 2);
                ctx.fill();
            }
            raf = requestAnimationFrame(tick);
        };

        window.addEventListener('resize', resize);
        resize();
        tick();
        return () => { window.removeEventListener('resize', resize); cancelAnimationFrame(raf); };
    }, []);

    if (user && !showLoader) return <Navigate to="/" replace />;

    return (
        <>
            <style>{`
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

        .lp-root {
          display: flex; height: 100vh; width: 100vw;
          overflow: hidden;
          font-family: 'Inter', system-ui, sans-serif;
        }

        /* ══════════ LEFT DARK BRAND PANEL ══════════ */
        .lp-brand {
          flex: 1.5;
          position: relative;
          background: #020c1e;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }

        /* animated aurora blobs */
        .lp-blob {
          position: absolute; border-radius: 50%;
          filter: blur(90px); pointer-events: none;
        }
        .lp-b1 {
          width: 640px; height: 640px;
          top: -220px; left: -180px;
          background: radial-gradient(circle, rgba(0,82,165,0.55) 0%, transparent 68%);
          animation: lb1 12s ease-in-out infinite alternate;
        }
        .lp-b2 {
          width: 520px; height: 520px;
          bottom: -180px; right: -140px;
          background: radial-gradient(circle, rgba(0,40,90,0.50) 0%, transparent 68%);
          animation: lb2 15s ease-in-out infinite alternate;
        }
        .lp-b3 {
          width: 400px; height: 400px;
          top: 38%; left: 28%;
          background: radial-gradient(circle, rgba(0,52,130,0.28) 0%, transparent 68%);
          animation: lb3 9s ease-in-out infinite alternate;
        }
        .lp-b4 {
          width: 320px; height: 320px;
          top: 10%; right: 5%;
          background: radial-gradient(circle, rgba(227,24,55,0.14) 0%, transparent 70%);
          animation: lb4 11s ease-in-out infinite alternate;
        }
        @keyframes lb1 { from{transform:translate(0,0) scale(1)} to{transform:translate(70px,90px) scale(1.18)} }
        @keyframes lb2 { from{transform:translate(0,0) scale(1)} to{transform:translate(-90px,-70px) scale(1.22)} }
        @keyframes lb3 { from{transform:translate(-50%,-50%) scale(0.85)} to{transform:translate(-50%,-50%) scale(1.15)} }
        @keyframes lb4 { from{transform:translate(0,0) scale(0.9)} to{transform:translate(-40px,60px) scale(1.1)} }

        /* top accent bar */
        .lp-topbar {
          position: absolute; top:0; left:0; right:0;
          height: 3px;
          background: linear-gradient(90deg, transparent, #0052A5, #E31837, #0052A5, transparent);
          z-index: 3;
        }

        /* decorative rings */
        .lp-ring {
          position: absolute; border-radius: 50%;
          border: 1px solid rgba(255,255,255,0.05);
          pointer-events: none;
        }
        .lp-r1 { width:700px; height:700px; bottom:-300px; right:-300px; }
        .lp-r2 { width:480px; height:480px; bottom:-160px; right:-160px; border-color:rgba(0,82,165,0.14); }
        .lp-r3 { width:260px; height:260px; bottom:-20px;  right:-20px;  border-color:rgba(255,255,255,0.08); }

        /* canvas */
        .lp-canvas {
          position: absolute; inset:0;
          width:100%; height:100%;
          z-index: 1; pointer-events:none;
        }

        /* content wrapper */
        .lp-content {
          position: relative; z-index:2;
          flex:1; display:flex;
          flex-direction:column;
          justify-content:space-between;
          padding: 52px 60px;
        }

        /* brand mark */
        .lp-brandmark { display:flex; align-items:center; gap:18px; }
        .lp-bm-logo {
          height:56px; width:auto; flex-shrink:0;
          display:block;
          filter: brightness(0) invert(1);
        }
        .lp-bm-divider {
          width:1.5px; height:48px; flex-shrink:0;
          background:rgba(255,255,255,0.22);
        }
        .lp-bm-name {
          font-family:'Adani',sans-serif;
          font-size:26px; font-weight:800;
          color:#fff; letter-spacing:0.04em; line-height:1;
        }
        .lp-bm-sub {
          display:block; font-size:12px; font-weight:600;
          color:rgba(255,255,255,0.45);
          letter-spacing:0.1em; text-transform:uppercase;
          margin-top:6px;
        }

        /* center section */
        .lp-center { flex:1; display:flex; flex-direction:column; justify-content:center; }

        .lp-pill {
          display: inline-flex; align-items:center; gap:8px;
          padding: 6px 14px;
          background: rgba(0,82,165,0.18);
          border: 1px solid rgba(0,82,165,0.38);
          border-radius: 20px;
          font-size: 11px; font-weight:700;
          letter-spacing: 0.12em; text-transform:uppercase;
          color: #80B8E8; margin-bottom:28px; width:max-content;
          animation: fadeUp 0.9s cubic-bezier(0.16,1,0.3,1) both;
        }
        .lp-pill-dot {
          width:6px; height:6px; border-radius:50%;
          background:#E31837;
          animation: pulse 2s ease-in-out infinite;
        }
        @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.3} }

        .lp-headline {
          font-family: 'Plus Jakarta Sans', sans-serif;
          font-size: 62px; font-weight:800;
          line-height: 1.05; letter-spacing:-0.03em;
          color: #fff;
          margin-bottom: 22px;
          animation: fadeUp 0.9s 0.08s cubic-bezier(0.16,1,0.3,1) both;
        }
        .lp-headline em {
          font-style:normal;
          background: linear-gradient(125deg, #E31837 0%, #C41230 100%);
          -webkit-background-clip:text;
          -webkit-text-fill-color:transparent;
          background-clip:text;
        }
        @keyframes fadeUp {
          from { opacity:0; transform:translateY(22px); }
          to   { opacity:1; transform:translateY(0); }
        }

        .lp-desc {
          font-size:15px; line-height:1.75;
          color:rgba(255,255,255,0.52);
          max-width:400px; font-weight:400;
          animation: fadeUp 0.9s 0.16s cubic-bezier(0.16,1,0.3,1) both;
        }

        /* feature list */
        .lp-feats {
          display:flex; flex-direction:column; gap:12px;
          animation: fadeUp 0.9s 0.28s cubic-bezier(0.16,1,0.3,1) both;
        }
        .lp-feat {
          display:flex; align-items:center; gap:14px;
          font-size:14px; color:rgba(255,255,255,0.68);
          font-weight:500;
        }
        .lp-feat-ic {
          width:36px; height:36px; flex-shrink:0;
          border-radius:10px;
          background:rgba(255,255,255,0.06);
          border:1px solid rgba(255,255,255,0.1);
          display:flex; align-items:center; justify-content:center;
          color:rgba(140,190,255,0.9);
        }

        /* ══════════ RIGHT FORM PANEL ══════════ */
        .lp-right {
          flex: 1;
          display:flex; align-items:center; justify-content:center;
          background:#EBF3FB;
          position:relative;
          padding:40px 28px;
          border-left:1px solid rgba(0,82,165,0.10);
          overflow:hidden;
        }

        /* dot-grid texture */
        .lp-right::after {
          content:''; position:absolute; inset:0;
          background-image: radial-gradient(circle, rgba(0,82,165,0.13) 1px, transparent 1px);
          background-size: 28px 28px;
          pointer-events:none; z-index:0;
        }

        /* soft animated blobs */
        .lp-rb1 {
          position:absolute; border-radius:50%; pointer-events:none; z-index:1;
          width:480px; height:480px; top:-160px; right:-160px;
          background:radial-gradient(circle, rgba(0,82,165,0.13) 0%, transparent 65%);
          filter:blur(40px);
          animation:rblob1 14s ease-in-out infinite alternate;
        }
        .lp-rb2 {
          position:absolute; border-radius:50%; pointer-events:none; z-index:1;
          width:380px; height:380px; bottom:-120px; left:-100px;
          background:radial-gradient(circle, rgba(227,24,55,0.09) 0%, transparent 65%);
          filter:blur(50px);
          animation:rblob2 18s ease-in-out infinite alternate;
        }
        .lp-rb3 {
          position:absolute; border-radius:50%; pointer-events:none; z-index:1;
          width:280px; height:280px; top:45%; left:50%;
          background:radial-gradient(circle, rgba(0,40,90,0.07) 0%, transparent 65%);
          filter:blur(35px);
          animation:rblob3 10s ease-in-out infinite alternate;
        }
        @keyframes rblob1 { from{transform:translate(0,0) scale(1)} to{transform:translate(-50px,60px) scale(1.2)} }
        @keyframes rblob2 { from{transform:translate(0,0) scale(1)} to{transform:translate(60px,-50px) scale(1.15)} }
        @keyframes rblob3 { from{transform:translate(-50%,-50%) scale(0.9)} to{transform:translate(-50%,-50%) scale(1.25)} }

        /* decorative rings — slow spin */
        .lp-deco {
          position:absolute; top:-160px; right:-160px;
          width:420px; height:420px; border-radius:50%;
          border:1px solid rgba(0,82,165,0.12);
          pointer-events:none; z-index:1;
          animation:deco-spin 40s linear infinite;
        }
        .lp-deco::after {
          content:''; position:absolute;
          top:20px; left:20px; right:20px; bottom:20px;
          border-radius:50%;
          border:1px dashed rgba(0,82,165,0.07);
        }
        .lp-deco2 {
          position:absolute; bottom:-110px; left:-110px;
          width:320px; height:320px; border-radius:50%;
          border:1px solid rgba(227,24,55,0.10);
          pointer-events:none; z-index:1;
          animation:deco-spin 55s linear infinite reverse;
        }
        .lp-deco2::after {
          content:''; position:absolute;
          top:18px; left:18px; right:18px; bottom:18px;
          border-radius:50%;
          border:1px dashed rgba(227,24,55,0.05);
        }
        @keyframes deco-spin { to { transform:rotate(360deg); } }

        /* floating badge */
        .lp-float-badge {
          position:absolute; z-index:2; pointer-events:none;
          top:14%; right:6%;
          display:flex; align-items:center; gap:8px;
          background:rgba(255,255,255,0.85);
          backdrop-filter:blur(10px);
          border:1px solid rgba(0,82,165,0.14);
          border-radius:40px;
          padding:8px 14px 8px 10px;
          box-shadow:0 4px 20px rgba(0,82,165,0.10);
          animation:fbadge-float 6s ease-in-out infinite;
        }
        .lp-float-badge2 {
          position:absolute; z-index:2; pointer-events:none;
          bottom:18%; left:5%;
          display:flex; align-items:center; gap:8px;
          background:rgba(255,255,255,0.85);
          backdrop-filter:blur(10px);
          border:1px solid rgba(227,24,55,0.12);
          border-radius:40px;
          padding:8px 14px 8px 10px;
          box-shadow:0 4px 20px rgba(227,24,55,0.08);
          animation:fbadge-float 7s ease-in-out infinite 1.5s;
        }
        @keyframes fbadge-float {
          0%,100%{transform:translateY(0px)}
          50%{transform:translateY(-8px)}
        }
        .lp-fb-icon {
          width:28px; height:28px; border-radius:50%;
          display:flex; align-items:center; justify-content:center;
          flex-shrink:0;
        }
        .lp-fb-icon.blue { background:rgba(0,82,165,0.12); color:#0052A5; }
        .lp-fb-icon.red  { background:rgba(227,24,55,0.10); color:#E31837; }
        .lp-fb-label { font-size:11px; font-weight:700; color:#00285A; line-height:1.2; }
        .lp-fb-sub   { font-size:10px; color:#5A7A9A; font-weight:500; }

        .lp-card {
          width:100%; max-width:520px;
          position:relative; z-index:3;
          animation: cardIn 0.8s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes cardIn {
          from { opacity:0; transform:translateY(28px) scale(0.98); }
          to   { opacity:1; transform:translateY(0) scale(1); }
        }

        /* form card container */
        .lp-form-box {
          background:rgba(255,255,255,0.92);
          backdrop-filter:blur(20px);
          -webkit-backdrop-filter:blur(20px);
          border-radius:24px;
          border:1px solid rgba(255,255,255,0.95);
          box-shadow:
            0 8px 48px rgba(0,82,165,0.12),
            0 2px 8px rgba(0,82,165,0.06),
            inset 0 1px 0 rgba(255,255,255,1);
          overflow:hidden;
        }
        .lp-form-accent {
          height:4px;
          position:relative;
          overflow:hidden;
          background:linear-gradient(90deg, #0052A5 0%, #003F8A 25%, #E31837 60%, #C41230 80%, #0052A5 100%);
          background-size:200% 100%;
          animation:accent-flow 3s linear infinite;
        }
        .lp-form-accent::after {
          content:'';
          position:absolute;
          top:0; bottom:0;
          width:80px;
          background:linear-gradient(90deg,
            transparent 0%,
            rgba(255,255,255,0.25) 30%,
            rgba(255,255,255,0.75) 50%,
            rgba(255,255,255,0.25) 70%,
            transparent 100%
          );
          animation:beam-sweep 2s ease-in-out infinite;
        }
        @keyframes accent-flow {
          0%   { background-position:0% 0%; }
          100% { background-position:200% 0%; }
        }
        @keyframes beam-sweep {
          0%   { left:-80px; }
          100% { left:calc(100% + 80px); }
        }
        .lp-form-inner {
          padding:42px 44px 38px;
        }

        /* form header */
        .lp-fhead { margin-bottom:30px; }
        .lp-logo-dark {
          height:38px; width:auto; display:block;
          margin:0 auto 20px;
        }
        .lp-ftitle {
          font-family:'Plus Jakarta Sans', sans-serif;
          font-size:28px; font-weight:800;
          color:#020c1e; letter-spacing:-0.03em;
          line-height:1.15; margin-bottom:8px;
          text-align:center;
        }
        .lp-fsub {
          font-size:13.5px; color:#64748b;
          font-weight:400; line-height:1.6;
          text-align:center;
        }

        /* fields */
        .lp-field { margin-bottom:18px; }
        .lp-lbl {
          display:block; font-size:12.5px; font-weight:600;
          color:#1e293b; margin-bottom:7px; letter-spacing:0.02em;
          text-transform:uppercase;
        }
        .lp-inp-wrap { position:relative; }
        .lp-inp {
          width:100%; height:50px; padding:0 16px 0 20px;
          border:1.5px solid #C5D8EC;
          border-radius:10px;
          font-family:'Barlow', sans-serif;
          font-size:14px; color:#0f172a;
          background:#fff;
          transition:border-color 0.2s, box-shadow 0.2s, padding-left 0.2s;
          font-weight:500; appearance:none;
        }
        .lp-inp.has-toggle { padding-right:46px; }
        .lp-inp::placeholder { color:#94a3b8; font-weight:400; }
        .lp-inp-wrap { position:relative; }
        .lp-inp-wrap::before {
          content:''; position:absolute;
          left:0; top:6px; bottom:6px;
          width:3px; border-radius:0 3px 3px 0;
          background:linear-gradient(to bottom, #0052A5, #E31837);
          opacity:0; transform:scaleY(0.4);
          transition:opacity 0.2s, transform 0.2s;
          pointer-events:none; z-index:1;
        }
        .lp-inp-wrap:focus-within::before {
          opacity:1; transform:scaleY(1);
        }
        .lp-inp:focus {
          outline:none;
          border-color:#0052A5;
          box-shadow:0 0 0 3.5px rgba(0,82,165,0.10), 0 2px 12px rgba(0,82,165,0.08);
          background:#FAFCFF;
        }
        .lp-toggle {
          position:absolute; right:14px; top:50%; transform:translateY(-50%);
          background:none; border:none; cursor:pointer; padding:4px;
          color:#94a3b8; display:flex; align-items:center; justify-content:center;
          transition:color 0.2s;
        }
        .lp-toggle:hover { color:#0052A5; }
        .lp-err {
          display:block; font-size:12px;
          color:#ef4444; margin-top:5px; font-weight:500;
        }

        /* submit */
        .lp-btn {
          width:100%; height:50px;
          background:linear-gradient(135deg, #00285A 0%, #0052A5 55%, #1A69C4 100%);
          color:#fff; border:none; border-radius:10px;
          font-family:'Barlow', sans-serif;
          font-size:15px; font-weight:600; letter-spacing:0.01em;
          cursor:pointer; position:relative; overflow:hidden;
          transition:transform 0.25s, box-shadow 0.25s, letter-spacing 0.25s;
          box-shadow:0 4px 22px rgba(0,82,165,0.38);
          display:flex; align-items:center; justify-content:center; gap:0;
        }
        /* shimmer sweep */
        .lp-btn::after {
          content:''; position:absolute;
          top:0; left:-100%;
          width:100%; height:100%;
          background:linear-gradient(90deg, transparent, rgba(255,255,255,0.18), transparent);
          transition:left 0.55s ease;
        }
        /* arrow icon — hidden by default, slides in on hover */
        .lp-btn-arrow {
          display:inline-flex; align-items:center;
          max-width:0; overflow:hidden;
          opacity:0; margin-left:0;
          transition:max-width 0.3s ease, opacity 0.3s ease, margin-left 0.3s ease;
        }
        .lp-btn:hover:not(:disabled) .lp-btn-arrow {
          max-width:24px; opacity:1; margin-left:8px;
        }
        /* ripple */
        .lp-btn .lp-ripple {
          position:absolute; border-radius:50%;
          background:rgba(255,255,255,0.3);
          transform:scale(0); pointer-events:none;
          animation:ripple-out 0.6s linear;
        }
        @keyframes ripple-out {
          to { transform:scale(4); opacity:0; }
        }
        .lp-btn:hover:not(:disabled) { transform:translateY(-2px); box-shadow:0 8px 30px rgba(0,82,165,0.50); letter-spacing:0.03em; }
        .lp-btn:hover:not(:disabled)::after { left:100%; }
        .lp-btn:active:not(:disabled) { transform:translateY(0); box-shadow:0 2px 8px rgba(0,82,165,0.2); }
        .lp-btn:disabled { opacity:0.6; cursor:not-allowed; }
        .lp-btn.loading { color:transparent; pointer-events:none; }
        .lp-btn.loading::before {
          content:''; position:absolute;
          width:20px; height:20px;
          border:2.5px solid rgba(255,255,255,0.3);
          border-top-color:#fff; border-radius:50%;
          animation:lp-spin 0.75s linear infinite;
          top:50%; left:50%; margin:-10px 0 0 -10px;
        }
        @keyframes lp-spin { to { transform:rotate(360deg); } }

        /* divider */
        .lp-divider {
          display:flex; align-items:center; gap:12px; margin:22px 0;
        }
        .lp-divider::before,.lp-divider::after {
          content:''; flex:1; height:1px; background:#DDE9F5;
        }
        .lp-divider span {
          font-size:11px; font-weight:600; color:#94a3b8;
          text-transform:uppercase; letter-spacing:0.08em; white-space:nowrap;
        }

        /* sso */
        .lp-sso {
          width:100%; height:50px; background:#fff;
          border:1.5px solid #C5D8EC; border-radius:10px;
          font-family:'Barlow', sans-serif;
          font-size:14px; font-weight:600; color:#334155;
          cursor:pointer; display:flex; align-items:center;
          justify-content:center; gap:10px;
          transition:all 0.2s ease;
        }
        .lp-sso:hover {
          background:#EBF3FB; border-color:#A3C4E0;
          transform:translateY(-1px);
          box-shadow:0 4px 18px rgba(0,82,165,0.08);
        }

        /* footer */
        .lp-foot {
          text-align:center; margin-top:20px;
          font-size:13px; color:#94a3b8;
        }
        .lp-foot a {
          color:#0052A5; font-weight:600;
          text-decoration:none; transition:color 0.2s;
        }
        .lp-foot a:hover { color:#E31837; }

        /* ══════════ CORNER ACCENT SHAPES ══════════ */
        .lp-corner-tl {
          position:absolute; top:0; left:0;
          width:120px; height:120px;
          pointer-events:none; z-index:1; overflow:hidden;
        }
        .lp-corner-tl::before {
          content:''; position:absolute;
          top:-60px; left:-60px;
          width:140px; height:140px;
          background:linear-gradient(135deg, rgba(0,82,165,0.18) 0%, transparent 60%);
          transform:rotate(0deg);
          clip-path:polygon(0 0, 100% 0, 0 100%);
        }
        .lp-corner-tl::after {
          content:''; position:absolute;
          top:0; left:0;
          width:0; height:0;
          border-style:solid;
          border-width:56px 56px 0 0;
          border-color:rgba(0,82,165,0.10) transparent transparent transparent;
        }
        .lp-corner-br {
          position:absolute; bottom:0; right:0;
          width:140px; height:140px;
          pointer-events:none; z-index:1;
        }
        .lp-corner-br::before {
          content:''; position:absolute;
          bottom:0; right:0;
          width:0; height:0;
          border-style:solid;
          border-width:0 0 70px 70px;
          border-color:transparent transparent rgba(227,24,55,0.09) transparent;
        }
        .lp-corner-br::after {
          content:''; position:absolute;
          bottom:16px; right:16px;
          width:0; height:0;
          border-style:solid;
          border-width:0 0 44px 44px;
          border-color:transparent transparent rgba(0,82,165,0.07) transparent;
        }

        /* ══════════ STAT STRIP ══════════ */
        .lp-stats {
          position:absolute; bottom:0; left:0; right:0;
          z-index:3; pointer-events:none;
          display:flex; align-items:stretch;
          border-top:1px solid rgba(0,82,165,0.10);
          background:rgba(255,255,255,0.55);
          backdrop-filter:blur(12px);
          -webkit-backdrop-filter:blur(12px);
        }
        .lp-stat {
          flex:1; display:flex; flex-direction:column;
          align-items:center; justify-content:center;
          padding:14px 8px;
          gap:3px;
        }
        .lp-stat + .lp-stat {
          border-left:1px solid rgba(0,82,165,0.08);
        }
        .lp-stat-val {
          font-family:'Adani',sans-serif;
          font-size:20px; font-weight:800;
          color:#0052A5; line-height:1;
          letter-spacing:-0.02em;
        }
        .lp-stat-lbl {
          font-size:10px; font-weight:600;
          color:#5A7A9A; text-transform:uppercase;
          letter-spacing:0.08em;
        }
        .lp-stat-dot {
          display:inline-block; width:6px; height:6px;
          border-radius:50%; margin-right:4px; vertical-align:middle;
        }

        /* count-up animation */
        @keyframes countUp {
          from { opacity:0; transform:translateY(8px); }
          to   { opacity:1; transform:translateY(0); }
        }
        .lp-stat-val { animation: countUp 0.7s cubic-bezier(0.16,1,0.3,1) both; }
        .lp-stat:nth-child(2) .lp-stat-val { animation-delay:0.1s; }
        .lp-stat:nth-child(3) .lp-stat-val { animation-delay:0.2s; }

        @media (max-width:860px) {
          .lp-brand { display:none; }
          .lp-right  { flex:1; }
        }

        /* ══════════ LOADING SCREEN ══════════ */
        .ls-overlay {
          position:fixed; inset:0; z-index:9999;
          background:#020c1e;
          display:flex; align-items:center; justify-content:center;
          animation:ls-in 0.25s ease both;
          overflow:hidden;
        }
        @keyframes ls-in { from{opacity:0} to{opacity:1} }

        .ls-glow {
          position:absolute; border-radius:50%;
          filter:blur(110px); pointer-events:none;
        }
        .ls-g1 {
          width:540px; height:540px; top:-180px; left:-150px;
          background:radial-gradient(circle, rgba(0,82,165,0.55) 0%, transparent 70%);
          animation:lb1 11s ease-in-out infinite alternate;
        }
        .ls-g2 {
          width:420px; height:420px; bottom:-140px; right:-120px;
          background:radial-gradient(circle, rgba(227,24,55,0.28) 0%, transparent 70%);
          animation:lb2 14s ease-in-out infinite alternate;
        }
        .ls-g3 {
          width:300px; height:300px; top:40%; left:35%;
          background:radial-gradient(circle, rgba(0,40,130,0.22) 0%, transparent 70%);
          animation:lb3 8s ease-in-out infinite alternate;
        }

        .ls-center {
          position:relative; z-index:2;
          display:flex; flex-direction:column;
          align-items:center; gap:44px;
          animation:ls-up 0.5s 0.1s cubic-bezier(0.16,1,0.3,1) both;
        }
        @keyframes ls-up {
          from{opacity:0;transform:translateY(20px)}
          to{opacity:1;transform:translateY(0)}
        }

        .ls-ring-wrap {
          position:relative; width:168px; height:168px;
        }
        .ls-ring-wrap::before {
          content:''; position:absolute; inset:-6px; border-radius:50%;
          background:conic-gradient(from 0deg,
            rgba(227,24,55,0.5) 0%,
            rgba(0,82,165,0.4) 45%,
            transparent 75%
          );
          animation:ls-spin 1.5s linear infinite;
          filter:blur(14px);
        }
        .ls-ring {
          position:absolute; inset:0; border-radius:50%;
          background:conic-gradient(from 0deg,
            #E31837 0%,
            #C41230 12%,
            #0052A5 40%,
            #00285A 60%,
            rgba(0,40,90,0.15) 80%,
            rgba(0,40,90,0) 100%
          );
          animation:ls-spin 1.5s linear infinite;
          mask:radial-gradient(farthest-side, transparent 64%, black 65%);
          -webkit-mask:radial-gradient(farthest-side, transparent 64%, black 65%);
        }
        @keyframes ls-spin { to{transform:rotate(360deg)} }

        .ls-inner {
          position:absolute; inset:10px; border-radius:50%;
          background:#020c1e;
          display:flex; align-items:center; justify-content:center;
        }
        .ls-logo-img { width:88px; height:auto; }

        .ls-text { display:flex; flex-direction:column; align-items:center; gap:10px; }
        .ls-title {
          font-family:'Plus Jakarta Sans', sans-serif;
          font-size:20px; font-weight:700;
          color:#fff; letter-spacing:-0.01em;
        }
        .ls-dots { display:inline-flex; gap:4px; margin-left:2px; }
        .ls-dot {
          width:4px; height:4px; border-radius:50%; background:#E31837;
          animation:ls-blink 1.4s ease-in-out infinite;
          opacity:0;
        }
        .ls-dot:nth-child(2){ animation-delay:0.22s; }
        .ls-dot:nth-child(3){ animation-delay:0.44s; }
        @keyframes ls-blink { 0%,100%{opacity:0;transform:scale(0.7)} 50%{opacity:1;transform:scale(1)} }
        .ls-sub {
          font-size:13px; color:rgba(255,255,255,0.38);
          font-weight:400; letter-spacing:0.02em;
        }
      `}</style>

            <div className="lp-root">

                {/* ── LEFT: Dark Brand Panel ─────────────────── */}
                <div className="lp-brand" ref={panelRef}>
                    <div className="lp-topbar" />
                    <div className="lp-blob lp-b1" />
                    <div className="lp-blob lp-b2" />
                    <div className="lp-blob lp-b3" />
                    <div className="lp-blob lp-b4" />
                    <div className="lp-ring lp-r1" />
                    <div className="lp-ring lp-r2" />
                    <div className="lp-ring lp-r3" />
                    <canvas ref={canvasRef} className="lp-canvas" />

                    <div className="lp-content">
                        {/* Brand mark */}
                        <div className="lp-brandmark">
                            <img src={`${import.meta.env.BASE_URL}adani-logo-white.svg`} alt="Adani" className="lp-bm-logo" />
                            <div className="lp-bm-divider" />
                            <div>
                                <span className="lp-bm-name">ACLP</span>
                                <span className="lp-bm-sub">Training Portal</span>
                            </div>
                        </div>

                        {/* Headline */}
                        <div className="lp-center">
                            <div className="lp-pill">
                                <span className="lp-pill-dot" />
                                ACLP Training Portal
                            </div>
                            <h1 className="lp-headline">
                                Build the<br />workforce<br />of <em>tomorrow.</em>
                            </h1>
                            <p className="lp-desc">
                                Empowering employees with structured learning paths, real-time tracking, and measurable professional growth.
                            </p>
                        </div>

                        {/* Features */}
                        <div className="lp-feats">
                            <div className="lp-feat">
                                <span className="lp-feat-ic">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
                                    </svg>
                                </span>
                                Training Content Management
                            </div>
                            <div className="lp-feat">
                                <span className="lp-feat-ic">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                        <circle cx="12" cy="12" r="9" />
                                        <path d="M12 7v5l3 3" />
                                    </svg>
                                </span>
                                Live Attendance Tracking
                            </div>
                            <div className="lp-feat">
                                <span className="lp-feat-ic">
                                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                                        <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                    </svg>
                                </span>
                                Reporting and Assessment
                            </div>
                        </div>
                    </div>
                </div>

                {/* ── RIGHT: Form Panel ─────────────────────── */}
                <div className="lp-right">
                    {/* animated blobs */}
                    <div className="lp-rb1" />
                    <div className="lp-rb2" />
                    <div className="lp-rb3" />
                    {/* spinning rings */}
                    <div className="lp-deco" />
                    <div className="lp-deco2" />
                    {/* corner accent shapes */}
                    <div className="lp-corner-tl" />
                    <div className="lp-corner-br" />

                    <div className="lp-card">
                        <div className="lp-form-box">
                            <div className="lp-form-accent" />
                            <div className="lp-form-inner">
                                <div className="lp-fhead">
                                    <img src={`${import.meta.env.BASE_URL}adani-logo.svg`} alt="Adani" className="lp-logo-dark" />
                                    <h2 className="lp-ftitle">Welcome back</h2>
                                    <p className="lp-fsub">Sign in to access your ACLP training account</p>
                                </div>

                                <form onSubmit={form.handleSubmit(d => mutate(d))} noValidate>
                                    <div className="lp-field">
                                        <label className="lp-lbl" htmlFor="email">Corporate Email</label>
                                        <div className="lp-inp-wrap">
                                            <input
                                                type="email" id="email"
                                                className="lp-inp"
                                                placeholder="you@adani.com"
                                                {...form.register('email')}
                                            />
                                        </div>
                                        {form.formState.errors.email && (
                                            <span className="lp-err">{form.formState.errors.email.message}</span>
                                        )}
                                    </div>

                                    <div className="lp-field">
                                        <label className="lp-lbl" htmlFor="password">Password</label>
                                        <div className="lp-inp-wrap">
                                            <input
                                                type={showPassword ? 'text' : 'password'}
                                                id="password"
                                                className="lp-inp has-toggle"
                                                placeholder="••••••••"
                                                {...form.register('password')}
                                            />
                                            <button
                                                type="button"
                                                className="lp-toggle"
                                                tabIndex={-1}
                                                onClick={() => setShowPassword(v => !v)}
                                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                            >
                                                {showPassword ? (
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
                                                        <line x1="1" y1="1" x2="23" y2="23" />
                                                    </svg>
                                                ) : (
                                                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                                        <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                                                        <circle cx="12" cy="12" r="3" />
                                                    </svg>
                                                )}
                                            </button>
                                        </div>
                                        {form.formState.errors.password && (
                                            <span className="lp-err">{form.formState.errors.password.message}</span>
                                        )}
                                    </div>

                                    {loginError && (
                                        <div style={{
                                            marginBottom: '16px',
                                            padding: '11px 14px',
                                            background: 'rgba(239,68,68,0.07)',
                                            border: '1.5px solid rgba(239,68,68,0.28)',
                                            borderRadius: '10px',
                                            fontSize: '13px',
                                            fontWeight: 500,
                                            color: '#dc2626',
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '9px',
                                            lineHeight: 1.5,
                                        }}>
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                                                 stroke="currentColor" strokeWidth="2" strokeLinecap="round"
                                                 strokeLinejoin="round" style={{ flexShrink: 0 }}>
                                                <circle cx="12" cy="12" r="10" />
                                                <line x1="12" y1="8" x2="12" y2="12" />
                                                <line x1="12" y1="16" x2="12.01" y2="16" />
                                            </svg>
                                            {loginError}
                                        </div>
                                    )}

                                    <button
                                        type="submit"
                                        className={`lp-btn ${isPending ? 'loading' : ''}`}
                                        disabled={isPending}
                                        onClick={(e) => {
                                            if (isPending) return;
                                            const btn = e.currentTarget;
                                            const rect = btn.getBoundingClientRect();
                                            const ripple = document.createElement('span');
                                            const size = Math.max(rect.width, rect.height);
                                            ripple.className = 'lp-ripple';
                                            ripple.style.cssText = `width:${size}px;height:${size}px;left:${e.clientX - rect.left - size / 2}px;top:${e.clientY - rect.top - size / 2}px`;
                                            btn.appendChild(ripple);
                                            setTimeout(() => ripple.remove(), 600);
                                        }}
                                    >
                                        Sign In
                                        <span className="lp-btn-arrow">
                                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                                                <line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/>
                                            </svg>
                                        </span>
                                    </button>
                                </form>

                                <div className="lp-divider"><span>or continue with</span></div>

                                <button type="button" className="lp-sso">
                                    <svg viewBox="0 0 21 21" width="18" height="18" fill="none">
                                        <rect x="1"  y="1"  width="9" height="9" rx="1" fill="#f25022" />
                                        <rect x="11" y="1"  width="9" height="9" rx="1" fill="#7fba00" />
                                        <rect x="1"  y="11" width="9" height="9" rx="1" fill="#00a4ef" />
                                        <rect x="11" y="11" width="9" height="9" rx="1" fill="#ffb900" />
                                    </svg>
                                    Microsoft SSO
                                </button>

                                <p className="lp-foot">
                                    Need portal access? <a href="#">Contact Administrator</a>
                                </p>
                            </div>
                        </div>
                    </div>

                </div>

            </div>

            {/* ── LOADING SCREEN ───────────────────────────── */}
            {showLoader && (
                <div className="ls-overlay">
                    <div className="ls-glow ls-g1" />
                    <div className="ls-glow ls-g2" />
                    <div className="ls-glow ls-g3" />

                    <div className="ls-center">
                        <div className="ls-ring-wrap">
                            <div className="ls-ring" />
                            <div className="ls-inner">
                                <img src={`${import.meta.env.BASE_URL}adani-logo-white.svg`} alt="Adani" className="ls-logo-img" />
                            </div>
                        </div>

                        <div className="ls-text">
                            <p className="ls-title">
                                Verifying credentials
                                <span className="ls-dots">
                                    <span className="ls-dot" />
                                    <span className="ls-dot" />
                                    <span className="ls-dot" />
                                </span>
                            </p>
                            <p className="ls-sub">Please wait a moment</p>
                        </div>
                    </div>
                </div>
            )}
        </>
    );
}
