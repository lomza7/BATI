'use client';

import { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

interface MapMarker {
  id: string;
  lat: number;
  lng: number;
  label: string;
  color: string;
  isSelected?: boolean;
}

interface MapViewProps {
  markers: MapMarker[];
  selectedId?: string | null;
  onMarkerClick?: (id: string) => void;
  className?: string;
}

const PIN_COLORS: Record<string, string> = {
  'bg-slate-400': '#94a3b8',
  'bg-blue-500': '#3b82f6',
  'bg-emerald-500': '#10b981',
  'bg-amber-500': '#f59e0b',
};

function createIcon(color: string, isSelected: boolean) {
  const hex = PIN_COLORS[color] || '#94a3b8';
  const size = isSelected ? 16 : 12;
  const border = isSelected ? 3 : 2;
  return L.divIcon({
    className: '',
    iconSize: [size * 2 + border * 2, size * 2 + border * 2],
    iconAnchor: [size + border, size + border],
    html: `<div style="
      width:${size * 2}px;height:${size * 2}px;
      background:${hex};
      border:${border}px solid white;
      border-radius:50%;
      box-shadow:0 2px 6px rgba(0,0,0,0.3);
      ${isSelected ? 'transform:scale(1.2);' : ''}
    "></div>`,
  });
}

export function MapView({ markers, selectedId, onMarkerClick, className }: MapViewProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<L.Map | null>(null);
  const markersLayerRef = useRef<L.LayerGroup | null>(null);

  // Initialize map
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = L.map(mapContainerRef.current, {
      zoomControl: true,
      attributionControl: true,
    }).setView([46.603354, 1.888334], 6); // Centre de la France

    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
      maxZoom: 19,
    }).addTo(map);

    markersLayerRef.current = L.layerGroup().addTo(map);
    mapRef.current = map;

    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Update markers
  useEffect(() => {
    if (!mapRef.current || !markersLayerRef.current) return;

    markersLayerRef.current.clearLayers();

    const validMarkers = markers.filter(m => m.lat && m.lng);
    if (validMarkers.length === 0) return;

    validMarkers.forEach(m => {
      const isSelected = m.id === selectedId;
      const marker = L.marker([m.lat, m.lng], {
        icon: createIcon(m.color, isSelected),
        zIndexOffset: isSelected ? 1000 : 0,
      });

      marker.bindTooltip(m.label, {
        direction: 'top',
        offset: [0, -14],
        className: 'leaflet-tooltip-custom',
      });

      if (onMarkerClick) {
        marker.on('click', () => onMarkerClick(m.id));
      }

      markersLayerRef.current!.addLayer(marker);
    });

    // Fit bounds
    const bounds = L.latLngBounds(validMarkers.map(m => [m.lat, m.lng]));
    mapRef.current.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 });
  }, [markers, selectedId, onMarkerClick]);

  // Pan to selected
  useEffect(() => {
    if (!mapRef.current || !selectedId) return;
    const selected = markers.find(m => m.id === selectedId);
    if (selected?.lat && selected?.lng) {
      mapRef.current.panTo([selected.lat, selected.lng], { animate: true });
    }
  }, [selectedId, markers]);

  return <div ref={mapContainerRef} className={className} />;
}
