import React, { useEffect, useMemo } from 'react';
import L from 'leaflet';
import { MapContainer, TileLayer, Marker, Polyline, AttributionControl, useMap, useMapEvents } from 'react-leaflet';
import { prefersReducedMotion } from '../utils';

/** Tiles come through our backend (/api/tiles), never straight from a third party. */
export const TILE_URL = '/api/tiles/{z}/{x}/{y}.png';
export const TILE_ATTRIBUTION = '© OpenStreetMap contributors';
export const BENGALURU_CENTER: [number, number] = [12.9716, 77.5946];

export interface LatLngLabel {
  lat: number;
  lng: number;
  label?: string;
}

export interface MapStop extends LatLngLabel {
  isYou?: boolean;
  approx?: boolean;
}

export interface MapScene {
  airport: LatLngLabel;
  destination?: LatLngLabel | null;
  stops?: MapStop[];
  pickup?: LatLngLabel | null;
  others?: LatLngLabel[];
  radar?: boolean;
  route?: 'preview' | 'shared' | null;
  focus?: 'route' | 'pickup' | 'airport';
}

const planeSvg = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#07090A" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.3.5c-.2.5-.1 1 .3 1.3L9 12l-2 3H4l-1 1 3 2 2 3 1-1v-3l3-2 3.5 5.3c.3.4.8.5 1.3.3l.5-.2c.4-.3.6-.7.5-1.2z"/></svg>`;

function icon(html: string, size: [number, number], anchor: [number, number]): L.DivIcon {
  return L.divIcon({ html, className: 'eco-marker', iconSize: size, iconAnchor: anchor });
}

const airportIcon = icon(
  `<div class="eco-airport"><span>${planeSvg}</span><b>BLR</b></div>`,
  [64, 34],
  [17, 17]
);

function destIcon(label?: string) {
  return icon(
    `<div class="eco-dest"><i></i>${label ? `<b>${escapeHtml(label)}</b>` : ''}</div>`,
    [18, 18],
    [9, 9]
  );
}

function stopIcon(n: number, label: string | undefined, isYou: boolean) {
  return icon(
    `<div class="eco-stop ${isYou ? 'is-you' : ''}"><i>${n}</i>${label ? `<b>${escapeHtml(label)}</b>` : ''}</div>`,
    [26, 26],
    [13, 13]
  );
}

const otherIcon = icon('<div class="eco-other"></div>', [10, 10], [5, 5]);
const radarIcon = icon('<div class="eco-radar"><span></span><span></span><span></span></div>', [10, 10], [5, 5]);

function pickupIcon(label?: string) {
  return icon(
    `<div class="eco-pickup"><i>P</i>${label ? `<b>${escapeHtml(label)}</b>` : ''}</div>`,
    [26, 26],
    [13, 13]
  );
}

function escapeHtml(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]!));
}

/** Keeps the scene in view above the sheet (or beside the desktop panel). */
const FitScene: React.FC<{ points: [number, number][]; sheetPx: number; isDesktop: boolean; focusKey: string }> = ({
  points,
  sheetPx,
  isDesktop,
  focusKey,
}) => {
  const map = useMap();
  useEffect(() => {
    if (points.length === 0) return;
    const animate = !prefersReducedMotion();
    const topLeft: L.PointExpression = isDesktop ? [470, 48] : [28, 40];
    const bottomRight: L.PointExpression = isDesktop ? [48, 48] : [28, sheetPx + 20];
    // A single point (the pickup) still gets padded bounds, so it sits in the visible strip above the sheet
    const bounds = points.length === 1 ? L.latLng(points[0]).toBounds(700) : L.latLngBounds(points);
    map.fitBounds(bounds, {
      paddingTopLeft: topLeft,
      paddingBottomRight: bottomRight,
      maxZoom: points.length === 1 ? 16 : 15,
      animate,
      duration: 0.6,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [focusKey, sheetPx, isDesktop]);
  return null;
};

export const TripMap: React.FC<{ scene: MapScene; sheetPx: number; isDesktop: boolean }> = ({
  scene,
  sheetPx,
  isDesktop,
}) => {
  const airport: [number, number] = [scene.airport.lat, scene.airport.lng];

  const routeLine = useMemo<[number, number][]>(() => {
    if (scene.stops && scene.stops.length) return [airport, ...scene.stops.map((s) => [s.lat, s.lng] as [number, number])];
    if (scene.destination) return [airport, [scene.destination.lat, scene.destination.lng]];
    return [];
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scene.stops, scene.destination, scene.airport.lat, scene.airport.lng]);

  const fitPoints = useMemo<[number, number][]>(() => {
    if (scene.focus === 'pickup' && scene.pickup) {
      return [[scene.pickup.lat, scene.pickup.lng]];
    }
    const pts: [number, number][] = [airport];
    routeLine.forEach((p) => pts.push(p));
    // Nothing chosen yet: frame the airport and the city together
    if (!routeLine.length) return [airport, BENGALURU_CENTER];
    return pts;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routeLine, scene.focus, scene.pickup]);

  const focusKey = JSON.stringify(fitPoints.map((p) => [p[0].toFixed(3), p[1].toFixed(3)]));

  return (
    <MapContainer
      center={BENGALURU_CENTER}
      zoom={10}
      zoomControl={false}
      attributionControl={false}
      className="absolute inset-0 eco-map"
      preferCanvas={false}
    >
      <TileLayer url={TILE_URL} attribution={TILE_ATTRIBUTION} maxZoom={19} />
      <AttributionControl position="topright" prefix={false} />
      <FitScene points={fitPoints} sheetPx={sheetPx} isDesktop={isDesktop} focusKey={focusKey} />

      {routeLine.length > 1 && (
        <Polyline
          positions={routeLine}
          pathOptions={
            scene.route === 'shared'
              ? { color: '#3DDC97', weight: 4, opacity: 0.95, lineCap: 'round', lineJoin: 'round' }
              : { color: '#FFB020', weight: 3, opacity: 0.85, dashArray: '6 8', lineCap: 'round' }
          }
        />
      )}

      {scene.others?.map((o, i) => (
        <Marker key={`o-${i}`} position={[o.lat, o.lng]} icon={otherIcon} interactive={false} />
      ))}

      {scene.radar && <Marker position={airport} icon={radarIcon} interactive={false} />}
      {!scene.pickup && <Marker position={airport} icon={airportIcon} interactive={false} />}

      {scene.stops?.length
        ? scene.stops.map((s, i) => (
            <Marker
              key={`s-${i}`}
              position={[s.lat, s.lng]}
              icon={stopIcon(i + 1, s.isYou ? 'You' : undefined, !!s.isYou)}
              zIndexOffset={s.isYou ? 500 : 0}
              interactive={false}
            />
          ))
        : scene.destination && (
            <Marker
              position={[scene.destination.lat, scene.destination.lng]}
              icon={destIcon(scene.destination.label)}
              interactive={false}
            />
          )}

      {scene.pickup && (
        <Marker position={[scene.pickup.lat, scene.pickup.lng]} icon={pickupIcon(scene.pickup.label)} interactive={false} />
      )}
    </MapContainer>
  );
};

/** Reports the map centre whenever the user stops dragging (used by the Drop a pin sheet). */
export const CenterWatcher: React.FC<{ onMoveEnd: (lat: number, lng: number) => void; onMoveStart?: () => void }> = ({
  onMoveEnd,
  onMoveStart,
}) => {
  const map = useMapEvents({
    movestart: () => onMoveStart?.(),
    moveend: () => {
      const c = map.getCenter();
      onMoveEnd(c.lat, c.lng);
    },
  });
  return null;
};
