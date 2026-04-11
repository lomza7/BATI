'use client';

import { useEffect, useRef, useState } from 'react';
import 'leaflet/dist/leaflet.css';

interface MapProject {
  id: string;
  title: string;
  city: string | null;
  lat: number;
  lng: number;
}

interface SiteMapProps {
  projects: MapProject[];
  accentColor?: string;
}

export function SiteMap({ projects, accentColor = '#3b82f6' }: SiteMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);

  // Load leaflet only on client side
  useEffect(() => {
    setReady(true);
  }, []);

  useEffect(() => {
    if (!ready || !containerRef.current || projects.length === 0) return;

    let cancelled = false;

    import('leaflet').then((L) => {
      if (cancelled || !containerRef.current) return;

      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }

      const map = L.default.map(containerRef.current!, {
        scrollWheelZoom: false,
        attributionControl: false,
      });
      mapRef.current = map;

      L.default.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
      }).addTo(map);

      const icon = L.default.divIcon({
        className: '',
        html: `<div style="width:28px;height:28px;background:${accentColor};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
      });

      const markers = projects.map(p => {
        const marker = L.default.marker([p.lat, p.lng], { icon }).addTo(map);
        marker.bindTooltip(
          `<strong>${p.title}</strong>${p.city ? `<br/><span style="font-size:11px;color:#666">${p.city}</span>` : ''}`,
          { direction: 'top', offset: [0, -16] }
        );
        return marker;
      });

      if (markers.length === 1) {
        map.setView([projects[0].lat, projects[0].lng], 12);
      } else {
        const bounds = L.default.latLngBounds(projects.map(p => [p.lat, p.lng]));
        map.fitBounds(bounds, { padding: [40, 40] });
      }
    });

    return () => {
      cancelled = true;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, [ready, projects, accentColor]);

  if (projects.length === 0) return null;

  return (
    <section id="carte" className="py-12 sm:py-20 px-4 sm:px-6" style={{ backgroundColor: 'var(--site-bg)' }}>
      <div className="max-w-6xl mx-auto">
        <h2
          className="text-2xl sm:text-3xl font-bold text-center mb-8 sm:mb-12"
          style={{ color: 'var(--site-heading)', fontFamily: 'var(--site-font)' }}
        >
          Nos chantiers
        </h2>
        <div
          ref={containerRef}
          className="w-full h-[280px] sm:h-[450px]"
          style={{ borderRadius: 'var(--site-radius)', zIndex: 10 }}
        />
        <p className="text-center text-xs sm:text-sm mt-4" style={{ color: 'var(--site-text-muted)' }}>
          {projects.length} chantier{projects.length > 1 ? 's' : ''} réalisé{projects.length > 1 ? 's' : ''}
        </p>
      </div>
    </section>
  );
}
