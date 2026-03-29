'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { cn } from '@/lib/utils';

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

function createMarkerIcon(status: string, isSelected: boolean) {
  const color = STATUS_COLORS[status] || '#94a3b8';
  const size = isSelected ? 18 : 12;
  const border = isSelected ? 4 : 3;

  return L.divIcon({
    className: 'custom-map-marker',
    html: `<div style="
      width: ${size}px;
      height: ${size}px;
      background: ${color};
      border: ${border}px solid white;
      border-radius: 50%;
      box-shadow: 0 2px 8px rgba(0,0,0,0.3);
      transition: all 0.2s;
    "></div>`,
    iconSize: [size + border * 2, size + border * 2],
    iconAnchor: [(size + border * 2) / 2, (size + border * 2) / 2],
  });
}

export function ProjectMap({ projects, selectedId, onSelect, className, height = '500px' }: ProjectMapProps) {
  const mapRef = useRef<L.Map | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const markersRef = useRef<Map<string, L.Marker>>(new Map());

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([46.603354, 1.888334], 6);

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap',
      maxZoom: 19,
    }).addTo(mapRef.current);

    return () => {
      mapRef.current?.remove();
      mapRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;

    markersRef.current.forEach(marker => marker.remove());
    markersRef.current.clear();

    const geoProjects = projects.filter(p => p.lat && p.lng);
    if (geoProjects.length === 0) return;

    const bounds = L.latLngBounds([]);

    geoProjects.forEach(project => {
      const marker = L.marker([project.lat, project.lng], {
        icon: createMarkerIcon(project.status, project.id === selectedId),
      });

      const statusLabel = STATUS_LABELS[project.status] || project.status;
      const popup = `
        <div style="min-width: 180px; font-family: system-ui, sans-serif;">
          <div style="font-weight: 600; font-size: 14px; margin-bottom: 4px;">${project.name}</div>
          ${project.clientName ? `<div style="font-size: 12px; color: #6b7280; margin-bottom: 4px;">${project.clientName}</div>` : ''}
          <div style="font-size: 12px; color: #6b7280; margin-bottom: 6px;">
            ${[project.address, project.city].filter(Boolean).join(', ')}
          </div>
          <div style="display: flex; align-items: center; gap: 6px;">
            <span style="display: inline-block; width: 8px; height: 8px; border-radius: 50%; background: ${STATUS_COLORS[project.status] || '#94a3b8'}"></span>
            <span style="font-size: 12px; font-weight: 500;">${statusLabel}</span>
            <span style="font-size: 11px; color: #9ca3af; margin-left: auto;">${project.progress}%</span>
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
  }, [projects, selectedId, onSelect]);

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
    <div
      ref={containerRef}
      className={cn('rounded-xl overflow-hidden border border-border', className)}
      style={{ height, width: '100%' }}
    />
  );
}
