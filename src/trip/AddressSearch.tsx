import React, { useEffect, useRef, useState } from 'react';
import { AnimatePresence } from 'motion/react';
import { api } from '../api';
import { GeoResult, PublicConfig } from '../types';
import { PinSheet } from './PinSheet';
import { POPULAR_AREAS, accuracyLabel, areaPlaces, soloUberLink } from './places';
import { IconPin, IconLink, IconLock, IconSearch } from './icons';
import { Portal } from './Portal';

const DEBOUNCE_MS = 300;
const MIN_CHARS = 3;

interface AddressSearchProps {
  config: PublicConfig | null;
  value: GeoResult | null;
  onChange: (place: GeoResult | null) => void;
  dropDetail: string;
  onDropDetail: (v: string) => void;
}

export const AddressSearch: React.FC<AddressSearchProps> = ({ config, value, onChange, dropDetail, onDropDetail }) => {
  const [q, setQ] = useState('');
  const [results, setResults] = useState<GeoResult[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [active, setActive] = useState(-1);
  const [showAllAreas, setShowAllAreas] = useState(false);
  const [pinOpen, setPinOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [link, setLink] = useState('');
  const [linkError, setLinkError] = useState<string | null>(null);
  const abortRef = useRef<AbortController>();
  const inputRef = useRef<HTMLInputElement>(null);

  // Type-ahead: 300 ms after the last keystroke, 3 characters or more
  useEffect(() => {
    const term = q.trim();
    abortRef.current?.abort();
    if (term.length < MIN_CHARS) {
      setResults([]);
      setMessage(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    const t = window.setTimeout(async () => {
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      try {
        const r = await api.geoSearch(term, ctrl.signal);
        setResults(r.results);
        setMessage(r.message ?? (r.results.length ? null : 'No matches yet. Press Enter to search harder, or drop a pin.'));
        setActive(-1);
      } catch (e: any) {
        if (e?.name !== 'AbortError') setMessage('Search is having trouble. Pick an area below or drop a pin.');
      } finally {
        if (!ctrl.signal.aborted) setBusy(false);
      }
    }, DEBOUNCE_MS);
    return () => window.clearTimeout(t);
  }, [q]);

  const lookupNow = async () => {
    const term = q.trim();
    if (term.length < MIN_CHARS) return;
    abortRef.current?.abort();
    setBusy(true);
    try {
      const r = await api.geoLookup(term);
      setResults(r.results);
      setMessage(r.message ?? (r.results.length ? null : 'We couldn’t find that. Try a landmark nearby, or drop a pin.'));
    } catch {
      setMessage('Search is having trouble. Pick an area below or drop a pin.');
    } finally {
      setBusy(false);
    }
  };

  const choose = (place: GeoResult) => {
    onChange(place);
    setQ('');
    setResults([]);
    setMessage(null);
  };

  const submitLink = async (raw: string) => {
    if (!raw.trim()) return;
    setLinkError(null);
    setBusy(true);
    try {
      const place = await api.geoFromLink(raw.trim());
      choose({ ...place, accuracy: 'pin' });
      setLinkOpen(false);
      setLink('');
    } catch (e: any) {
      setLinkError(e?.message || 'We couldn’t read that link. Try dropping a pin instead.');
    } finally {
      setBusy(false);
    }
  };

  const areas = areaPlaces(config);
  const chips = showAllAreas ? areas : areas.filter((a) => POPULAR_AREAS.includes(a.name));

  if (value) {
    return (
      <div className="space-y-3">
        <div className="flex items-start gap-3 rounded-2xl border border-ink-700 bg-ink-900 p-4" data-demo="where-selected">
          <span className="mt-0.5 text-amber">
            <IconPin />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-primary leading-snug">{value.name}</p>
            <p className="text-sm text-secondary truncate">{value.secondary}</p>
            <p className="mt-1 text-xs text-secondary">{accuracyLabel(value.accuracy)}</p>
          </div>
          <button type="button" className="btn-quiet shrink-0" onClick={() => onChange(null)} data-demo="where-change">
            Change
          </button>
        </div>

        {!value.in_range ? (
          <div className="rounded-2xl border border-red/40 bg-red/10 p-4 text-sm text-primary" role="alert">
            That's too far for a shared cab from the airport. Try a closer drop point, or{' '}
            <a className="font-semibold underline" href={soloUberLink(value.lat, value.lng, value.area)} target="_blank" rel="noreferrer">
              book alone
            </a>
            .
          </div>
        ) : (
          <label className="block">
            <span className="text-sm font-medium text-primary">
              Flat, building or landmark <span className="text-secondary font-normal">(optional)</span>
            </span>
            <input
              value={dropDetail}
              onChange={(e) => onDropDetail(e.target.value.slice(0, 120))}
              placeholder="e.g. Flat 4B, blue gate"
              className="field mt-1.5"
              autoComplete="off"
              data-demo="drop-detail"
            />
            <span className="mt-1.5 flex items-center gap-1.5 text-xs text-secondary">
              <IconLock /> Only the person booking sees this, after everyone says yes. Deleted after the trip.
            </span>
          </label>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="relative">
        <span className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-secondary">
          <IconSearch />
        </span>
        <input
          ref={inputRef}
          value={q}
          onChange={(e) => setQ(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'ArrowDown') {
              e.preventDefault();
              setActive((a) => Math.min(results.length - 1, a + 1));
            } else if (e.key === 'ArrowUp') {
              e.preventDefault();
              setActive((a) => Math.max(-1, a - 1));
            } else if (e.key === 'Enter') {
              e.preventDefault();
              if (active >= 0 && results[active]) choose(results[active]);
              else lookupNow();
            }
          }}
          placeholder="Area, street or landmark"
          className="field pl-11 text-[17px]"
          aria-label="Where are you going?"
          role="combobox"
          aria-expanded={results.length > 0}
          aria-controls="where-results"
          aria-autocomplete="list"
          autoComplete="off"
          enterKeyHint="search"
          data-demo="where-input"
        />
        {busy && <span className="absolute right-4 top-1/2 -translate-y-1/2 h-4 w-4 rounded-full border-2 border-amber border-t-transparent animate-spin" />}
      </div>

      {results.length > 0 && (
        <ul id="where-results" role="listbox" className="overflow-hidden rounded-2xl border border-ink-800 bg-ink-900 divide-y divide-ink-800">
          {results.map((r, i) => (
            <li key={`${r.id}-${i}`} role="option" aria-selected={i === active}>
              <button
                type="button"
                onClick={() => choose(r)}
                className={`w-full px-4 py-3 text-left transition-colors ${i === active ? 'bg-ink-800' : 'hover:bg-ink-800/70'}`}
                data-demo={`where-result-${i}`}
              >
                <span className="block font-semibold text-primary leading-snug">{r.name}</span>
                <span className="block text-sm text-secondary truncate">
                  {r.secondary}
                  {!r.in_range && <span className="text-red"> · too far for a shared cab</span>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {message && (
        <p className="text-sm text-amber" role="status">
          {message}
        </p>
      )}

      <div className="flex flex-wrap gap-2">
        <button type="button" className="chip" onClick={() => setPinOpen(true)} data-demo="drop-pin">
          <IconPin /> Drop a pin
        </button>
        <button type="button" className="chip" onClick={() => setLinkOpen((v) => !v)} aria-expanded={linkOpen}>
          <IconLink /> Paste a Google Maps link
        </button>
      </div>

      {linkOpen && (
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            submitLink(link);
          }}
        >
          <input
            value={link}
            onChange={(e) => setLink(e.target.value)}
            onPaste={(e) => {
              const text = e.clipboardData.getData('text');
              if (text) {
                e.preventDefault();
                setLink(text);
                submitLink(text);
              }
            }}
            placeholder="https://maps.app.goo.gl/…"
            className="field flex-1"
            inputMode="url"
            aria-label="Google Maps link"
          />
          <button type="submit" className="btn-secondary shrink-0">
            Use link
          </button>
        </form>
      )}
      {linkError && <p className="text-sm text-red">{linkError}</p>}

      <div>
        <p className="mb-2 text-sm text-secondary">Or pick an area</p>
        <div className="flex flex-wrap gap-2">
          {chips.map((a) => (
            <button
              key={a.id}
              type="button"
              className="chip"
              onClick={() => choose(a)}
              data-demo={`area-chip-${a.name.replace(/\s+/g, '-')}`}
            >
              {a.name}
            </button>
          ))}
          {!showAllAreas && (
            <button type="button" className="chip chip-ghost" onClick={() => setShowAllAreas(true)}>
              All 16 areas
            </button>
          )}
        </div>
      </div>

      <Portal>
        <AnimatePresence>
          {pinOpen && (
            <PinSheet
              onClose={() => setPinOpen(false)}
              onConfirm={(p) => {
                setPinOpen(false);
                choose(p);
              }}
            />
          )}
        </AnimatePresence>
      </Portal>
    </div>
  );
};
