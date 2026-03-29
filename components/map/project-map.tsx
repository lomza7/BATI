'use client';

import { useEffect, useRef, useState } from 'react';
import { cn } from '@/lib/utils';
import { Loader as Loader2 } from 'lucide-react';

export interface MapProject {
  id: string;
  name: string;
  address: string;
  city: string;
  lat: number;
  lng: number;
  status: string;
  progress: number;
  clientName?: string;
}

interface ProjectMapProps {
  projects: MapProject[];
  selectedId?: string | null;
  onSelect?: (id: string) => void;
  className?: string;
  height?: string;
}

const STATUS_COLORS: Record<string, string> = {
  a_planifier: '#94a3b8',
  en_cours: '#3b82f6',
  termine: '#10b981',
  en_pause: '#f59e0b',
};

const STATUS_LABELS: Record<string, string> = {
  a_planifier: 'A planifier',
  en_cours: 'En cours',
  termine: 'Termine',
  en_pause: 'En pause',
};

const LEAFLET_CSS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css';
const LEAFLET_JS = 'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js';

function loadLeaflet(): Promise<typeof import('leaflet')> {
  if ((window as any).L) return Promise.resolve((window as any).L);

  return new Promise((resolve, reject) => {
    if (!document.querySelector(`link[href="${LEAFLET_CSS}"]`)) {
      const link = document.createElement('link');
      link.rel = 'stylesheet';
      link.href = LEAFLET_CSS;
      document.head.appendChild(link);
    }

    const script = document.createElement('script');
    script.src = LEAFLET_JS;
    script.onload = () => resolve((window as any).L);
    script.onerror = reject;
    document.head.appendChild(script);
  });
}

export function ProjectMap({ projects, selectedId, onSelect, className, height = '500px' }: ProjectMapProps) {
  const mapRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, any>>(new Map());
  const leafletRef = useRef<any>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadLeaflet().then(L => {
      if (cancelled || !containerRef.current || mapRef.current) return;
      leafletRef.current = L;

      mapRef.current = L.map(containerRef.current, {
        zoomControl: true,
        attributionControl: true,
      }).setView([46.603354, 1.888334], 6);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap',
        maxZoom: 19,
      }).addTo(mapRef.current);

      setReady(true);
    });

    return () => {
      cancelled = true;
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L || !ready) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    const geoProjects = projects.filter(p => p.lat && p.lng);
    if (geoProjects.length === 0) return;

    const bounds = L.latLngBounds([]);

    geoProjects.forEach((project: MapProject) => {
      const color = STATUS_COLORS[project.status] || '#94a3b8';
      const isSelected = project.id === selectedId;
      const size = isSelected ? 18 : 12;
      const border = isSelected ? 4 : 3;

      const icon = L.divIcon({
        className: 'custom-map-marker',
        html: `<div style="width:${size}px;height:${size}px;background:${color};border:${border}px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.3);"></div>`,
        iconSize: [size + border * 2, size + border * 2],
        iconAnchor: [(size + border * 2) / 2, (size + border * 2) / 2],
      });

      const marker = L.marker([project.lat, project.lng], { icon });

      const statusLabel = STATUS_LABELS[project.status] || project.status;
      const popup = `
        <div style="min-width:180px;font-family:system-ui,sans-serif;">
          <div style="font-weight:600;font-size:14px;margin-bottom:4px;">${project.name}</div>
          ${project.clientName ? `<div style="font-size:12px;color:#6b7280;margin-bottom:4px;">${project.clientName}</div>` : ''}
          <div style="font-size:12px;color:#6b7280;margin-bottom:6px;">
            ${[project.address, project.city].filter(Boolean).join(', ')}
          </div>
          <div style="display:flex;align-items:center;gap:6px;">
            <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${color}"></span>
            <span style="font-size:12px;font-weight:500;">${statusLabel}</span>
            <span style="font-size:11px;color:#9ca3af;margin-left:auto;">${project.progress}%</span>
          </div>
        </div>
      `;

      marker.bindPopup(popup, { closeButton: true, maxWidth: 260 });

      if (onSelect) {
        marker.on('click', () => onSelect(project.id));
      }

      marker.addTo(map);
      markersRef.current.set(project.id, marker);
      bounds.extend([project.lat, project.lng]);
    });

    if (geoProjects.length === 1) {
      map.setView([geoProjects[0].lat, geoProjects[0].lng], 14);
    } else {
      map.fitBounds(bounds, { padding: [40, 40], maxZoom: 14 });
    }
  }, [projects, selectedId, onSelect, ready]);

  useEffect(() => {
    if (!selectedId || !mapRef.current) return;
    const marker = markersRef.current.get(selectedId);
    if (marker) {
      const latlng = marker.getLatLng();
      mapRef.current.setView(latlng, Math.max(mapRef.current.getZoom(), 13), { animate: true });
      marker.openPopup();
    }
  }, [selectedId]);

  return (
    <div className={cn('relative rounded-xl overflow-hidden border border-border', className)} style={{ height, width: '100%' }}>
      <div ref={containerRef} style={{ height: '100%', width: '100%' }} />
      {!ready && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/80">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
    </div>
  );
}
