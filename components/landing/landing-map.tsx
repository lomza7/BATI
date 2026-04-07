'use client';

import { useEffect, useRef, useState } from 'react';

const MARKERS = [
  { lat: 48.8566, lng: 2.3522, label: 'Rénovation appartement Dupont', status: 'en_cours', address: '12 rue de Rivoli, Paris 1er', budget: '18 500 €', progress: 65 },
  { lat: 48.8738, lng: 2.2950, label: 'Salle de bain Bernard', status: 'en_cours', address: '8 av. de la Grande Armée, Paris 17e', budget: '9 200 €', progress: 30 },
  { lat: 48.8450, lng: 2.3740, label: 'Cuisine Leroy', status: 'termine', address: '45 bd Saint-Germain, Paris 5e', budget: '14 800 €', progress: 100 },
  { lat: 48.8650, lng: 2.3300, label: 'Peinture bureaux Martin', status: 'termine', address: '3 rue du Louvre, Paris 1er', budget: '6 400 €', progress: 100 },
  { lat: 48.8830, lng: 2.3430, label: 'Isolation combles Petit', status: 'en_cours', address: '22 rue Marcadet, Paris 18e', budget: '11 600 €', progress: 45 },
  { lat: 48.8380, lng: 2.3100, label: 'Prospect — Villa Moreau', status: 'prospect', address: '67 rue de Vaugirard, Paris 15e', budget: '~25 000 €', progress: 0 },
  { lat: 48.8520, lng: 2.2880, label: 'Toiture Garnier', status: 'termine', address: '14 rue de Passy, Paris 16e', budget: '22 300 €', progress: 100 },
  { lat: 48.8700, lng: 2.3800, label: 'Prospect — Extension Roux', status: 'prospect', address: '5 rue de Belleville, Paris 20e', budget: '~35 000 €', progress: 0 },
];

const STATUS_COLORS: Record<string, string> = {
  en_cours: '#D35400',
  termine: '#10b981',
  prospect: '#3b82f6',
};

const STATUS_LABELS: Record<string, string> = {
  en_cours: 'En cours',
  termine: 'Terminé',
  prospect: 'Prospect',
};

function createPinIcon(L: typeof import('leaflet'), color: string) {
  return L.divIcon({
    className: '',
    iconSize: [24, 24],
    iconAnchor: [12, 12],
    html: `<div style="
      width:20px;height:20px;
      background:${color};
      border:3px solid white;
      border-radius:50%;
      box-shadow:0 2px 8px rgba(0,0,0,0.25);
    "></div>`,
  });
}

type MarkerData = (typeof MARKERS)[number];

function buildPopupHtml(m: MarkerData) {
  const color = STATUS_COLORS[m.status];
  const statusLabel = STATUS_LABELS[m.status];
  const progressBar = m.status !== 'prospect'
    ? `<div style="margin-top:8px">
        <div style="display:flex;justify-content:space-between;font-size:10px;color:#888;margin-bottom:3px">
          <span>Avancement</span><span>${m.progress}%</span>
        </div>
        <div style="height:5px;background:#f0f0f0;border-radius:3px;overflow:hidden">
          <div style="height:100%;width:${m.progress}%;background:${color};border-radius:3px"></div>
        </div>
      </div>`
    : '';

  return `<div style="font-family:Inter,system-ui,sans-serif;padding:2px 0">
    <div style="display:flex;align-items:center;gap:6px;margin-bottom:6px">
      <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
      <span style="font-size:10px;font-weight:600;color:${color}">${statusLabel}</span>
    </div>
    <div style="font-size:13px;font-weight:600;color:#1a1a1a;margin-bottom:4px">${m.label}</div>
    <div style="font-size:11px;color:#888;margin-bottom:6px">${m.address}</div>
    <div style="display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:12px;font-weight:600;color:#1a1a1a">${m.budget}</span>
    </div>
    ${progressBar}
  </div>`;
}

interface LandingMapProps {
  className?: string;
  filter?: string;
}

export function LandingMap({ className = 'h-[260px] sm:h-[380px]', filter = 'all' }: LandingMapProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersRef = useRef<L.LayerGroup | null>(null);
  const [ready, setReady] = useState(false);

  // Initialize map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    let cancelled = false;

    // @ts-ignore — CSS import for Leaflet styles
    import('leaflet/dist/leaflet.css');
    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;

      const map = L.map(containerRef.current, {
        zoomControl: false,
        attributionControl: false,
        scrollWheelZoom: false,
      }).setView([48.8580, 2.3400], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 18,
      }).addTo(map);

      // Zoom control bottom-right
      L.control.zoom({ position: 'bottomright' }).addTo(map);

      const layerGroup = L.layerGroup().addTo(map);
      markersRef.current = layerGroup;
      mapRef.current = map;

      // Add markers
      MARKERS.forEach((m) => {
        const marker = L.marker([m.lat, m.lng], {
          icon: createPinIcon(L, STATUS_COLORS[m.status]),
        });
        marker.bindPopup(buildPopupHtml(m), {
          className: 'landing-map-popup',
          maxWidth: 260,
          offset: [0, -8],
        });
        layerGroup.addLayer(marker);
      });

      // Enable scroll zoom on click
      map.on('click', () => map.scrollWheelZoom.enable());
      map.on('mouseout', () => map.scrollWheelZoom.disable());

      setReady(true);
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Update marker visibility on filter change
  useEffect(() => {
    if (!mapRef.current || !markersRef.current || !ready) return;

    import('leaflet').then((L) => {
      markersRef.current!.clearLayers();

      const filtered = filter === 'all'
        ? MARKERS
        : MARKERS.filter((m) => m.status === filter);

      filtered.forEach((m) => {
        const marker = L.marker([m.lat, m.lng], {
          icon: createPinIcon(L, STATUS_COLORS[m.status]),
        });
        marker.bindPopup(buildPopupHtml(m), {
          className: 'landing-map-popup',
          maxWidth: 260,
          offset: [0, -8],
        });
        markersRef.current!.addLayer(marker);
      });
    });
  }, [filter, ready]);

  return (
    <div
      ref={containerRef}
      className={`${className} rounded-xl overflow-hidden`}
      style={{ zIndex: 0 }}
    />
  );
}
