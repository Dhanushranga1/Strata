'use client';

import clsx from 'clsx';

type Variant = 'aurora' | 'neon' | 'mono';
type Size = 'sm' | 'md' | 'lg';

export default function BrandWordmark({
  variant = 'aurora',
  size = 'lg',
  align = 'center',
  showTM = true,
}: {
  variant?: Variant;
  size?: Size;
  align?: 'left' | 'center' | 'right';
  showTM?: boolean;
}) {
  const sizeClasses: Record<Size, string> = {
    sm: 'text-3xl md:text-4xl',
    md: 'text-4xl md:text-5xl',
    lg: 'text-5xl md:text-6xl',
  };

  return (
    <div
      className={clsx(
        'relative mx-auto mb-8 w-fit select-none',
        align === 'left' && 'ml-0 mr-auto',
        align === 'right' && 'mr-0 ml-auto'
      )}
      aria-label="TicketPilot wordmark"
    >
      {/* subtle aurora halo (safe for all variants) */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-x-24 -top-10 h-24 -z-10 rounded-full blur-3xl opacity-60"
        style={{
          background:
            'radial-gradient(60% 60% at 50% 50%, rgba(99,102,241,.14) 0%, rgba(59,130,246,.10) 40%, rgba(236,72,153,.0) 70%)',
        }}
      />

      {variant === 'aurora' && (
        <Aurora sizeClasses={sizeClasses[size]} showTM={showTM} />
      )}
      {variant === 'neon' && (
        <Neon sizeClasses={sizeClasses[size]} showTM={showTM} />
      )}
      {variant === 'mono' && (
        <Mono sizeClasses={sizeClasses[size]} showTM={showTM} />
      )}

      {/* local keyframes to avoid global CSS bloat */}
      <style jsx>{`
        @keyframes tpSheen {
          0% {
            -webkit-mask-position: -20% 0%;
            mask-position: -20% 0%;
          }
          100% {
            -webkit-mask-position: 120% 0%;
            mask-position: 120% 0%;
          }
        }
        @keyframes tpMoveGrad {
          0% {
            background-position: 0% 50%;
          }
          100% {
            background-position: 100% 50%;
          }
        }
      `}</style>
    </div>
  );
}

/* ——— VARIANT A: AURORA ———
   Glass plaque + premium gradient fill + subtle sheen.
   Great when you want "crafted" without looking neon. */
function Aurora({
  sizeClasses,
  showTM,
}: {
  sizeClasses: string;
  showTM: boolean;
}) {
  return (
    <div className="relative">
      {/* glass plaque */}
      <div className="absolute -inset-x-4 -inset-y-2 -z-10 rounded-2xl border border-white/10 bg-white/5 backdrop-blur-md [box-shadow:0_8px_40px_rgba(30,64,175,.25)]" />
      <span
        className={clsx(
          'relative inline-block font-extrabold leading-none tracking-wide',
          'bg-clip-text text-transparent',
          sizeClasses
        )}
        style={{
          backgroundImage:
            'linear-gradient(90deg,#93c5fd 0%,#38bdf8 25%,#a78bfa 60%,#f472b6 100%)',
          backgroundSize: '220% 100%',
          WebkitTextStroke: '1px rgba(255,255,255,.35)',
          textShadow:
            '0 1px 0 rgba(255,255,255,.05), 0 18px 40px rgba(99,102,241,.18), 0 10px 24px rgba(236,72,153,.18)',
          animation: 'tpMoveGrad 9s linear infinite',
        }}
      >
        TicketPilot
        {showTM && (
          <sup className="ml-1 align-super text-xs text-white/70">™</sup>
        )}
        {/* gentle light sweep */}
        <span
          aria-hidden
          className="pointer-events-none absolute inset-0 opacity-80"
          style={{
            background:
              'linear-gradient(0deg,rgba(255,255,255,.5),rgba(255,255,255,.08))',
            WebkitMaskImage:
              'linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.9) 50%, transparent 80%)',
            maskImage:
              'linear-gradient(90deg, transparent 20%, rgba(255,255,255,0.9) 50%, transparent 80%)',
            WebkitMaskSize: '220% 100%',
            maskSize: '220% 100%',
            WebkitMaskRepeat: 'no-repeat',
            maskRepeat: 'no-repeat',
            animation: 'tpSheen 3.4s ease-in-out infinite',
          }}
        />
      </span>
    </div>
  );
}

/* ——— VARIANT B: NEON ———
   Crisp outline with soft bloom; more punchy but still tasteful. */
function Neon({
  sizeClasses,
  showTM,
}: {
  sizeClasses: string;
  showTM: boolean;
}) {
  return (
    <span
      className={clsx(
        'relative inline-block font-extrabold leading-none',
        sizeClasses
      )}
    >
      {/* glow layer */}
      <span
        aria-hidden
        className="absolute inset-0 blur-[10px] opacity-90"
        style={{
          backgroundImage:
            'linear-gradient(90deg,#60a5fa 0%,#22d3ee 25%,#a78bfa 60%,#fb7185 100%)',
          WebkitBackgroundClip: 'text',
          backgroundClip: 'text',
          color: 'transparent',
          filter:
            'drop-shadow(0 8px 28px rgba(59,130,246,.45)) drop-shadow(0 4px 14px rgba(236,72,153,.42))',
        }}
      />
      {/* stroke + fill */}
      <span
        className="relative bg-clip-text text-transparent"
        style={{
          backgroundImage:
            'linear-gradient(90deg,#dbeafe 0%,#7dd3fc 25%,#c4b5fd 60%,#fda4af 100%)',
          WebkitTextStroke: '1.25px rgba(255,255,255,.55)',
        }}
      >
        TicketPilot
        {showTM && (
          <sup className="ml-1 align-super text-xs text-white/80">™</sup>
        )}
      </span>
    </span>
  );
}

/* ——— VARIANT C: MONO ———
   Minimal, typographic mark: "Ticket" neutral, "Pilot" branded. */
function Mono({
  sizeClasses,
  showTM,
}: {
  sizeClasses: string;
  showTM: boolean;
}) {
  return (
    <span
      className={clsx(
        'inline-flex items-baseline gap-1.5 leading-none',
        sizeClasses
      )}
    >
      <span className="font-semibold text-white/90">Ticket</span>
      <span
        className="font-extrabold bg-clip-text text-transparent"
        style={{
          backgroundImage:
            'linear-gradient(90deg,#60a5fa 0%,#a78bfa 60%,#f472b6 100%)',
        }}
      >
        Pilot
      </span>
      {showTM && <sup className="align-super text-xs text-white/60">™</sup>}
    </span>
  );
}
