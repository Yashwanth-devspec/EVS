import React, { useRef, useState, useCallback } from 'react';
import { prefersReducedMotion } from '../../utils';

interface InteractiveTicketProps {
  soloFareText: string;
  perPersonText: string;
  savingText: string;
  destination?: string;
  flightCode?: string;
  className?: string;
}

export const InteractiveTicket: React.FC<InteractiveTicketProps> = ({
  soloFareText,
  perPersonText,
  savingText,
  destination = 'Jayanagar',
  flightCode = 'BLR · ARRIVALS',
  className = '',
}) => {
  const cardRef = useRef<HTMLDivElement>(null);
  const [transform, setTransform] = useState<string>('perspective(1000px) rotateX(0deg) rotateY(0deg)');
  const [glare, setGlare] = useState<{ x: number; y: number; opacity: number }>({ x: 50, y: 50, opacity: 0 });
  const reduced = prefersReducedMotion();

  const handlePointerMove = useCallback((e: React.PointerEvent<HTMLDivElement>) => {
    if (reduced || !cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const centerX = rect.width / 2;
    const centerY = rect.height / 2;

    // Max rotation 8 degrees for tasteful, subtle physical feel
    const rotateX = ((y - centerY) / centerY) * -7;
    const rotateY = ((x - centerX) / centerX) * 7;

    setTransform(`perspective(1000px) rotateX(${rotateX.toFixed(2)}deg) rotateY(${rotateY.toFixed(2)}deg) translateY(-2px)`);
    setGlare({
      x: (x / rect.width) * 100,
      y: (y / rect.height) * 100,
      opacity: 0.16,
    });
  }, [reduced]);

  const handlePointerLeave = useCallback(() => {
    setTransform('perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0px)');
    setGlare((prev) => ({ ...prev, opacity: 0 }));
  }, []);

  return (
    <div
      ref={cardRef}
      onPointerMove={handlePointerMove}
      onPointerLeave={handlePointerLeave}
      style={{
        transform,
        transition: 'transform 0.35s cubic-bezier(0.16, 1, 0.3, 1)',
        transformStyle: 'preserve-3d',
      }}
      className={`ticket-card relative overflow-hidden p-6 sm:p-7 select-none cursor-pointer group shadow-2xl ${className}`}
      data-demo="hero-stat"
    >
      {/* Specular Hologram Light Sheen */}
      <div
        className="pointer-events-none absolute inset-0 z-20 transition-opacity duration-300"
        style={{
          opacity: glare.opacity,
          background: `radial-gradient(circle 320px at ${glare.x}% ${glare.y}%, rgba(255, 255, 255, 0.8) 0%, rgba(255, 215, 0, 0.25) 30%, transparent 70%)`,
        }}
      />

      {/* Header Band */}
      <div className="flex items-center justify-between text-xs font-semibold tracking-wider text-on-paper/70">
        <span className="font-cockpit flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-green-ink inline-block" />
          {flightCode}
        </span>
        <span className="rounded bg-on-paper/10 px-2 py-0.5 font-cockpit text-[11px] font-bold">Fare split pass · est.</span>
      </div>

      <div className="mt-3 flex items-baseline justify-between border-b border-on-paper/10 pb-3">
        <div>
          <span className="text-xs tracking-wide text-on-paper/60">Destination</span>
          <p className="text-lg font-extrabold text-on-paper leading-tight">Airport → {destination}</p>
        </div>
        <div className="text-right">
          <span className="text-xs tracking-wide text-on-paper/60">Estimated saving</span>
          <p className="font-cockpit text-lg font-bold text-green-ink">{savingText}</p>
        </div>
      </div>

      {/* Price Comparison Block */}
      <div className="mt-4 grid grid-cols-2 gap-4">
        <div>
          <div className="text-xs font-medium tracking-wide text-on-paper/60">Alone</div>
          <div className="text-3xl font-bold tabular-nums text-on-paper line-through decoration-on-paper/40 decoration-2">
            {soloFareText}
          </div>
          <span className="text-[11px] text-on-paper/50">Full airport road alone</span>
        </div>
        <div>
          <div className="text-xs font-semibold tracking-wide text-green-ink">With 3 people, each</div>
          <div className="text-3xl font-extrabold tabular-nums text-green-ink">
            {perPersonText}
          </div>
          <span className="text-[11px] font-medium text-green-ink/80">Each passenger pays</span>
        </div>
      </div>

      {/* Perforation Tear-Line */}
      <div className="my-5 relative flex items-center justify-center">
        <div className="w-full border-t-2 border-dashed border-on-paper/25" />
      </div>

      {/* Bottom info & Barcode */}
      <div className="flex items-end justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-on-paper/85 leading-snug">
            That’s <b className="text-green-ink font-bold">{savingText}</b> back in your pocket, and two fewer cabs on the airport road.
          </p>
          <p className="text-[11px] text-on-paper/50">Estimated from our fare model. The cab app sets the real price.</p>
        </div>

        {/* Vintage Boarding Pass Barcode */}
        <div className="hidden sm:flex flex-col items-center shrink-0 opacity-80" aria-hidden="true">
          <div className="h-9 w-28 bg-[repeating-linear-gradient(90deg,#0E1210,#0E1210_2px,transparent_2px,transparent_4px,#0E1210_4px,#0E1210_7px,transparent_7px,transparent_9px,#0E1210_9px,#0E1210_10px,transparent_10px,transparent_12px)] rounded-sm" />
          <span className="mt-1 font-cockpit text-[9px] tracking-widest text-on-paper/60">BLR-T1-POOL</span>
        </div>
      </div>
    </div>
  );
};
