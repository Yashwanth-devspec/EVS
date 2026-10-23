import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { DigitRoll } from './DigitRoll';

export const ConvergenceMap: React.FC<{
  mode?: 'today' | 'shared';
  onModeChange?: (mode: 'today' | 'shared') => void;
  className?: string;
}> = ({
  mode: controlledMode,
  onModeChange,
  className = '',
}) => {
  const [internalMode, setInternalMode] = useState<'today' | 'shared'>('today');
  const [hoveredStop, setHoveredStop] = useState<string | null>(null);
  const currentMode = controlledMode ?? internalMode;
  const rootRef = useRef<HTMLDivElement>(null);
  const flipped = useRef(false);

  // Show "Today" first, then flip to the shared corridors once, a moment after it scrolls into view
  useEffect(() => {
    const el = rootRef.current;
    if (!el || controlledMode) return;
    let timer: number;
    const io = new IntersectionObserver(([e]) => {
      if (e.isIntersecting && !flipped.current) {
        flipped.current = true;
        timer = window.setTimeout(() => setInternalMode('shared'), 2400);
      }
    }, { threshold: 0.5 });
    io.observe(el);
    return () => {
      io.disconnect();
      window.clearTimeout(timer);
    };
  }, [controlledMode]);

  const setMode = (m: 'today' | 'shared') => {
    if (onModeChange) onModeChange(m);
    else setInternalMode(m);
  };

  // Airport Origin coordinate (projected)
  const airport = { x: 480, y: 70, name: 'BLR Airport' };

  // 12 key zones partitioned into the 4 fixed corridors
  const clusters = [
    {
      id: 'south-west',
      name: 'South Corridor',
      corridorWaypoints: 'M 480 70 C 440 140, 360 210, 340 350 S 330 380, 300 395',
      stops: [
        { name: 'Jayanagar', x: 340, y: 350, soloD: 'M 480 70 C 450 160, 370 260, 340 350' },
        { name: 'JP Nagar', x: 340, y: 400, soloD: 'M 480 70 C 450 170, 370 290, 340 400' },
        { name: 'Banashankari', x: 280, y: 375, soloD: 'M 480 70 C 430 180, 330 280, 280 375' },
      ],
    },
    {
      id: 'south-east',
      name: 'South-East Corridor',
      corridorWaypoints: 'M 480 70 C 450 150, 400 250, 390 330 S 380 360, 420 385',
      stops: [
        { name: 'Koramangala', x: 390, y: 330, soloD: 'M 480 70 C 460 160, 410 250, 390 330' },
        { name: 'BTM', x: 360, y: 370, soloD: 'M 480 70 C 450 170, 390 270, 360 370' },
        { name: 'HSR', x: 430, y: 385, soloD: 'M 480 70 C 470 170, 430 280, 430 385' },
      ],
    },
    {
      id: 'east',
      name: 'East Corridor',
      corridorWaypoints: 'M 480 70 C 470 150, 430 230, 410 270 S 460 290, 530 310',
      stops: [
        { name: 'Indiranagar', x: 410, y: 270, soloD: 'M 480 70 C 460 140, 420 200, 410 270' },
        { name: 'Marathahalli', x: 480, y: 290, soloD: 'M 480 70 C 480 150, 470 220, 480 290' },
        { name: 'Whitefield', x: 540, y: 310, soloD: 'M 480 70 C 510 150, 520 230, 540 310' },
      ],
    },
    {
      id: 'north-west',
      name: 'North-West Corridor',
      corridorWaypoints: 'M 480 70 C 430 130, 360 180, 360 210 S 340 240, 300 260',
      stops: [
        { name: 'Hebbal', x: 360, y: 210, soloD: 'M 480 70 C 430 120, 380 160, 360 210' },
        { name: 'Malleshwaram', x: 320, y: 240, soloD: 'M 480 70 C 420 130, 350 190, 320 240' },
        { name: 'Rajajinagar', x: 280, y: 265, soloD: 'M 480 70 C 410 140, 340 200, 280 265' },
      ],
    },
  ];

  // Key primary zones shown by default without cluttering
  const keyZoneNames = new Set(['Jayanagar', 'Koramangala', 'Indiranagar', 'Whitefield', 'Hebbal']);

  return (
    <div ref={rootRef} className={`relative w-full rounded-2xl bg-ink-900 border border-ink-800 overflow-hidden ${className}`}>
      {/* City glow backdrop */}
      <div className="absolute inset-0 amber-glow pointer-events-none" />

      {/* Header Bar with Toggle & Live Stats */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 p-5 sm:p-6 border-b border-ink-800">
        <div>
          <span className="text-sm text-secondary block">
            Illustration: 12 people landing within 30 minutes
          </span>
          <div className="flex items-baseline gap-3 mt-1">
            <span className="text-2xl sm:text-3xl font-bold text-primary font-sans">
              <DigitRoll value={currentMode === 'today' ? 12 : 4} suffix=" cabs" />
            </span>
            <span className="text-sm text-secondary font-medium">
              {currentMode === 'today'
                ? 'each on the same airport road'
                : 'sharing four routes into the city'}
            </span>
          </div>
        </div>

        {/* State Toggle */}
        <div
          role="radiogroup"
          aria-label="Simulation state toggle"
          className="inline-flex rounded-full bg-ink-950 p-1 border border-ink-700"
        >
          <button
            type="button"
            role="radio"
            aria-checked={currentMode === 'today'}
            onClick={() => setMode('today')}
            className={`tap-target px-4 py-2 rounded-full text-sm font-medium transition-all ${
              currentMode === 'today'
                ? 'bg-ink-800 text-amber font-bold shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            Today
          </button>
          <button
            type="button"
            role="radio"
            aria-checked={currentMode === 'shared'}
            onClick={() => setMode('shared')}
            className={`tap-target px-4 py-2 rounded-full text-sm font-medium transition-all ${
              currentMode === 'shared'
                ? 'bg-green/20 text-green font-bold shadow-sm'
                : 'text-secondary hover:text-primary'
            }`}
          >
            With EcoRide
          </button>
        </div>
      </div>

      {/* SVG Map Canvas */}
      <div className="relative w-full aspect-[4/5] sm:aspect-[16/11]">
        <svg
          viewBox="228 36 392 384"
          className="w-full h-full select-none"
          role="img"
          aria-label="Schematic convergence map from BLR airport to Bengaluru zones"
        >
          {/* Subtle dot-grid */}
          <defs>
            <pattern id="grid-dots" width="40" height="40" patternUnits="userSpaceOnUse">
              <circle cx="2" cy="2" r="1" fill="#1E2426" />
            </pattern>
          </defs>
          <rect width="760" height="480" fill="url(#grid-dots)" opacity="0.6" />

          {/* Distance Rings around BLR Airport Centroid */}
          <circle cx="480" cy="70" r="100" fill="none" stroke="#1E2426" strokeDasharray="4 4" />
          <circle cx="480" cy="70" r="200" fill="none" stroke="#1E2426" strokeDasharray="4 4" />
          <circle cx="480" cy="70" r="300" fill="none" stroke="#1E2426" strokeDasharray="4 4" />

          {/* Clean distance marks with halos */}
          <text
            x="548"
            y="158"
            fill="#A7B0AB"
            fontSize="14"
            fontWeight="500"
            style={{ paintOrder: 'stroke fill', stroke: '#07090A', strokeWidth: 4 }}
          >
            10 km
          </text>

          {/* STATE A: 12 Solo Amber Trails */}
          {clusters.map((cluster) =>
            cluster.stops.map((stop, sIdx) => (
              <g key={`solo-${cluster.id}-${sIdx}`}>
                <motion.path
                  d={stop.soloD}
                  fill="none"
                  stroke="#FFB020"
                  strokeWidth="1.5"
                  strokeDasharray="4 4"
                  animate={{
                    opacity: currentMode === 'today' ? 0.65 : 0,
                    strokeDashoffset: currentMode === 'today' ? [0, -32] : 0,
                  }}
                  transition={{
                    opacity: { duration: 0.35 },
                    strokeDashoffset: { repeat: Infinity, duration: 2 + sIdx * 0.3, ease: 'linear' },
                  }}
                />
                {currentMode === 'today' && (
                  <circle cx={stop.x} cy={stop.y} r="3" fill="#FFB020" opacity="0.8" />
                )}
              </g>
            ))
          )}

          {/* STATE B: 4 Consolidated Green Corridors */}
          {clusters.map((cluster, cIdx) => (
            <g key={`shared-${cluster.id}`}>
              <motion.path
                d={cluster.corridorWaypoints}
                fill="none"
                stroke="#3DDC97"
                strokeWidth="3.5"
                strokeLinecap="round"
                animate={{
                  opacity: currentMode === 'shared' ? 0.95 : 0,
                  pathLength: currentMode === 'shared' ? 1 : 0,
                }}
                transition={{
                  duration: 0.5,
                  delay: cIdx * 0.08,
                  ease: [0.16, 1, 0.3, 1],
                }}
              />
              {currentMode === 'shared' &&
                cluster.stops.map((stop, sIdx) => (
                  <g key={`shared-stop-${sIdx}`}>
                    <circle cx={stop.x} cy={stop.y} r="4" fill="#3DDC97" stroke="#07090A" strokeWidth="1.5" />
                  </g>
                ))}
            </g>
          ))}

          {/* Airport Hub */}
          <g transform={`translate(${airport.x}, ${airport.y})`}>
            <circle r="8" fill="#F3EFE6" stroke="#FFB020" strokeWidth="2.5" />
            <circle r="14" fill="none" stroke="#FFB020" strokeWidth="1" strokeDasharray="3 3" opacity="0.6" />
            <text
              x="18"
              y="5"
              fill="#F3EFE6"
              fontSize="14"
              fontWeight="bold"
              style={{ paintOrder: 'stroke fill', stroke: '#07090A', strokeWidth: 4 }}
            >
              {airport.name}
            </text>
          </g>

          {/* Destination Zone Labels: halos, collision avoidance, min 14px */}
          {clusters.map((cluster) =>
            cluster.stops.map((stop, sIdx) => {
              const isKey = keyZoneNames.has(stop.name);
              const isHovered = hoveredStop === stop.name;
              const showLabel = isKey || isHovered;

              return (
                <g
                  key={`label-${cluster.id}-${sIdx}`}
                  transform={`translate(${stop.x}, ${stop.y})`}
                  onMouseEnter={() => setHoveredStop(stop.name)}
                  onMouseLeave={() => setHoveredStop(null)}
                  className="cursor-pointer"
                >
                  <circle
                    r={showLabel ? 5 : 3}
                    fill={currentMode === 'today' ? '#FFB020' : '#3DDC97'}
                    stroke="#07090A"
                    strokeWidth="1.5"
                  />
                  {showLabel && (
                    <text
                      x="10"
                      y="5"
                      fill={isHovered ? '#FFFFFF' : currentMode === 'today' ? '#ECEFEA' : '#3DDC97'}
                      fontSize="14"
                      fontWeight={isHovered || isKey ? '600' : 'normal'}
                      style={{
                        paintOrder: 'stroke fill',
                        stroke: '#07090A',
                        strokeWidth: 4,
                        strokeLinejoin: 'round',
                      }}
                    >
                      {stop.name}
                    </text>
                  )}
                </g>
              );
            })
          )}
        </svg>
      </div>

      {/* Footer Caption Note */}
      <div className="p-4 bg-ink-950/80 border-t border-ink-800 flex flex-col sm:flex-row sm:justify-between sm:items-center text-sm text-secondary gap-2">
        <span>Same 12 people, same night: 4 cabs instead of 12.</span>
        <span className="text-secondary/70">Schematic, not to scale</span>
      </div>
    </div>
  );
};
