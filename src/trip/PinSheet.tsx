import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapContainer, TileLayer, AttributionControl } from 'react-leaflet';
import { motion } from 'motion/react';
import { api } from '../api';
import { GeoResult, ReverseResult } from '../types';
import { CenterWatcher, TILE_URL, TILE_ATTRIBUTION, BENGALURU_CENTER } from './TripMap';
import { soloUberLink } from './places';

const reverseCache = new Map<string, ReverseResult>();

interface PinSheetProps {
  start?: { lat: number; lng: number } | null;
  onConfirm: (place: GeoResult) => void;
  onClose: () => void;
}

/** Full-screen map with a pin fixed in the middle: drag the map, not the pin. */
export const PinSheet: React.FC<PinSheetProps> = ({ start, onConfirm, onClose }) => {
  const [center, setCenter] = useState<{ lat: number; lng: number }>(start ?? { lat: BENGALURU_CENTER[0], lng: BENGALURU_CENTER[1] });
  const [place, setPlace] = useState<ReverseResult | null>(null);
  const [moving, setMoving] = useState(false);
  const [looking, setLooking] = useState(false);
  const timer = useRef<number>();
  const abort = useRef<AbortController>();

  const lookUp = useCallback((lat: number, lng: number) => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(async () => {
      const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
      const hit = reverseCache.get(key);
      if (hit) {
        setPlace(hit);
        return;
      }
      abort.current?.abort();
      abort.current = new AbortController();
      setLooking(true);
      try {
        const r = await api.geoReverse(lat, lng, abort.current.signal);
        if (!r.throttled) reverseCache.set(key, r);
        setPlace(r);
      } catch {
        // aborted or offline: keep the last label
      } finally {
        setLooking(false);
      }
    }, 450);
  }, []);

  useEffect(() => {
    lookUp(center.lat, center.lng);
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.clearTimeout(timer.current);
      abort.current?.abort();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const outOfRange = place && !place.in_range;

  return (
    <motion.div
      className="fixed inset-0 z-[1200] bg-ink-950 flex flex-col"
      initial={{ y: '100%' }}
      animate={{ y: 0 }}
      exit={{ y: '100%' }}
      transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
      role="dialog"
      aria-modal="true"
      aria-label="Drop a pin"
      data-demo="pin-sheet"
    >
      <div className="flex items-center justify-between gap-3 px-4 h-14 border-b border-ink-800 bg-ink-950">
        <button type="button" onClick={onClose} className="btn-quiet" data-demo="pin-close">
          Back
        </button>
        <span className="truncate text-[15px] font-semibold text-primary">Drag the map to your drop point</span>
        <span className="w-12" />
      </div>

      <div className="relative flex-1">
        <MapContainer
          center={[center.lat, center.lng]}
          zoom={start ? 16 : 12}
          zoomControl={false}
          attributionControl={false}
          className="absolute inset-0 eco-map"
        >
          <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
          <AttributionControl position="topright" prefix={false} />
          <CenterWatcher
            onMoveStart={() => setMoving(true)}
            onMoveEnd={(lat, lng) => {
              setMoving(false);
              setCenter({ lat, lng });
              lookUp(lat, lng);
            }}
          />
        </MapContainer>

        {/* The fixed centre pin. Its tip is the exact map centre. */}
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[600] -translate-x-1/2 -translate-y-full">
          <svg
            width="40"
            height="52"
            viewBox="0 0 40 52"
            className={`drop-shadow-xl transition-transform duration-150 ${moving ? '-translate-y-2' : ''}`}
            aria-hidden="true"
          >
            <path d="M20 51C20 51 37 31.5 37 19A17 17 0 0 0 3 19c0 12.5 17 32 17 32Z" fill="#FFB020" stroke="#07090A" strokeWidth="2" />
            <circle cx="20" cy="19" r="6" fill="#07090A" />
          </svg>
        </div>
        <div className="pointer-events-none absolute left-1/2 top-1/2 z-[590] h-2 w-5 -translate-x-1/2 rounded-full bg-black/50 blur-[2px]" />
      </div>

      <div className="px-5 pt-4 pb-[max(18px,env(safe-area-inset-bottom))] border-t border-ink-800 bg-ink-950 space-y-3">
        <div className="min-h-[52px]" aria-live="polite">
          {place ? (
            <>
              <p className="font-semibold text-primary leading-snug">{moving || looking ? 'Finding the address…' : place.name}</p>
              <p className="text-sm text-secondary">{place.secondary}</p>
            </>
          ) : (
            <p className="text-secondary">Finding the address…</p>
          )}
          {place?.message && <p className="text-sm text-amber mt-1">{place.message}</p>}
          {outOfRange && (
            <p className="text-sm text-red mt-1">
              That's too far for a shared cab from the airport. Try a closer drop point, or{' '}
              <a className="underline" href={soloUberLink(place!.lat, place!.lng, place!.area)} target="_blank" rel="noreferrer">
                book alone
              </a>
              .
            </p>
          )}
        </div>
        <button
          type="button"
          className="btn-primary w-full"
          disabled={!place || moving || looking || !!outOfRange}
          onClick={() => place && onConfirm({ ...place, accuracy: 'pin' })}
          data-demo="pin-confirm"
        >
          Use this drop point
        </button>
      </div>
    </motion.div>
  );
};
