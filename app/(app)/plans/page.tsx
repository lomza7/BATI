'use client';

import { useState, useRef, useCallback } from 'react';
import { Ruler, Upload, Camera, Sparkles, Download, RotateCcw, Loader2, Plus, Minus } from 'lucide-react';
import { supabase } from '@/lib/supabase';
import { PageHeader } from '@/components/shared/page-header';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Door {
  wall: 'north' | 'south' | 'east' | 'west';
  position: number;
  width: number;
}

interface Window {
  wall: 'north' | 'south' | 'east' | 'west';
  position: number;
  width: number;
}

interface Room {
  name: string;
  x: number;
  y: number;
  width: number;
  height: number;
  doors?: Door[];
  windows?: Window[];
}

interface PlanData {
  title: string;
  total_width: number;
  total_height: number;
  rooms: Room[];
}

// ---------------------------------------------------------------------------
// SVG Plan Renderer
// ---------------------------------------------------------------------------

const WALL_THICKNESS = 3;
const COLORS = {
  wall: '#1a1a2e',
  wallFill: '#ffffff',
  door: '#D35400',
  window: '#3b82f6',
  text: '#374151',
  dim: '#9ca3af',
  bg: '#fafafa',
  grid: '#f0f0f0',
};

function PlanSVG({ plan, zoom }: { plan: PlanData; zoom: number }) {
  const padding = 60;
  const pxPerMeter = 50 * zoom;
  const svgW = plan.total_width * pxPerMeter + padding * 2;
  const svgH = plan.total_height * pxPerMeter + padding * 2;

  function m2px(m: number) {
    return m * pxPerMeter;
  }

  function drawRoom(room: Room, idx: number) {
    const rx = padding + m2px(room.x);
    const ry = padding + m2px(room.y);
    const rw = m2px(room.width);
    const rh = m2px(room.height);

    const elements: React.ReactNode[] = [];

    // Room fill
    elements.push(
      <rect
        key={`fill-${idx}`}
        x={rx}
        y={ry}
        width={rw}
        height={rh}
        fill={COLORS.wallFill}
        stroke={COLORS.wall}
        strokeWidth={WALL_THICKNESS}
      />,
    );

    // Room name
    elements.push(
      <text
        key={`name-${idx}`}
        x={rx + rw / 2}
        y={ry + rh / 2 - 6}
        textAnchor="middle"
        fill={COLORS.text}
        fontSize={Math.min(14 * zoom, 16)}
        fontWeight="600"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {room.name}
      </text>,
    );

    // Dimensions text
    elements.push(
      <text
        key={`dim-${idx}`}
        x={rx + rw / 2}
        y={ry + rh / 2 + 12}
        textAnchor="middle"
        fill={COLORS.dim}
        fontSize={Math.min(11 * zoom, 13)}
        fontFamily="Inter, system-ui, sans-serif"
      >
        {room.width.toFixed(1)} x {room.height.toFixed(1)} m
      </text>,
    );

    // Surface
    const surface = room.width * room.height;
    elements.push(
      <text
        key={`surface-${idx}`}
        x={rx + rw / 2}
        y={ry + rh / 2 + 26}
        textAnchor="middle"
        fill={COLORS.dim}
        fontSize={Math.min(10 * zoom, 12)}
        fontFamily="Inter, system-ui, sans-serif"
      >
        {surface.toFixed(1)} m²
      </text>,
    );

    // Doors
    (room.doors || []).forEach((door, di) => {
      const dw = m2px(door.width);
      let dx: number, dy: number, dAngle: number;
      const isHorizontal = door.wall === 'north' || door.wall === 'south';

      if (isHorizontal) {
        dx = rx + door.position * rw - dw / 2;
        dy = door.wall === 'north' ? ry - WALL_THICKNESS / 2 : ry + rh - WALL_THICKNESS / 2;
        dAngle = 0;
      } else {
        dx = door.wall === 'west' ? rx - WALL_THICKNESS / 2 : rx + rw - WALL_THICKNESS / 2;
        dy = ry + door.position * rh - dw / 2;
        dAngle = 90;
      }

      // Door opening arc
      if (isHorizontal) {
        const arcDir = door.wall === 'south' ? 1 : -1;
        elements.push(
          <g key={`door-${idx}-${di}`}>
            <rect x={dx} y={dy - 2} width={dw} height={WALL_THICKNESS + 4} fill={COLORS.wallFill} />
            <line x1={dx} y1={dy} x2={dx + dw} y2={dy} stroke={COLORS.door} strokeWidth={2} />
            <path
              d={`M ${dx} ${dy} A ${dw} ${dw} 0 0 ${arcDir > 0 ? 1 : 0} ${dx + dw} ${dy}`}
              fill="none"
              stroke={COLORS.door}
              strokeWidth={1}
              strokeDasharray="3,2"
              opacity={0.5}
            />
          </g>,
        );
      } else {
        const arcDir = door.wall === 'east' ? 1 : -1;
        elements.push(
          <g key={`door-${idx}-${di}`}>
            <rect x={dx - 2} y={dy} width={WALL_THICKNESS + 4} height={dw} fill={COLORS.wallFill} />
            <line x1={dx} y1={dy} x2={dx} y2={dy + dw} stroke={COLORS.door} strokeWidth={2} />
            <path
              d={`M ${dx} ${dy} A ${dw} ${dw} 0 0 ${arcDir > 0 ? 0 : 1} ${dx} ${dy + dw}`}
              fill="none"
              stroke={COLORS.door}
              strokeWidth={1}
              strokeDasharray="3,2"
              opacity={0.5}
            />
          </g>,
        );
      }
    });

    // Windows
    (room.windows || []).forEach((win, wi) => {
      const ww = m2px(win.width);
      const isHorizontal = win.wall === 'north' || win.wall === 'south';

      if (isHorizontal) {
        const wx = rx + win.position * rw - ww / 2;
        const wy = win.wall === 'north' ? ry - WALL_THICKNESS / 2 : ry + rh - WALL_THICKNESS / 2;
        elements.push(
          <g key={`win-${idx}-${wi}`}>
            <rect x={wx} y={wy - 2} width={ww} height={WALL_THICKNESS + 4} fill={COLORS.wallFill} />
            <line x1={wx} y1={wy} x2={wx + ww} y2={wy} stroke={COLORS.window} strokeWidth={3} />
            <line x1={wx} y1={wy - 2} x2={wx + ww} y2={wy - 2} stroke={COLORS.window} strokeWidth={1} />
            <line x1={wx} y1={wy + 2} x2={wx + ww} y2={wy + 2} stroke={COLORS.window} strokeWidth={1} />
          </g>,
        );
      } else {
        const wx = win.wall === 'west' ? rx - WALL_THICKNESS / 2 : rx + rw - WALL_THICKNESS / 2;
        const wy = ry + win.position * rh - ww / 2;
        elements.push(
          <g key={`win-${idx}-${wi}`}>
            <rect x={wx - 2} y={wy} width={WALL_THICKNESS + 4} height={ww} fill={COLORS.wallFill} />
            <line x1={wx} y1={wy} x2={wx} y2={wy + ww} stroke={COLORS.window} strokeWidth={3} />
            <line x1={wx - 2} y1={wy} x2={wx - 2} y2={wy + ww} stroke={COLORS.window} strokeWidth={1} />
            <line x1={wx + 2} y1={wy} x2={wx + 2} y2={wy + ww} stroke={COLORS.window} strokeWidth={1} />
          </g>,
        );
      }
    });

    return elements;
  }

  // Grid
  const gridLines: React.ReactNode[] = [];
  for (let x = 0; x <= plan.total_width; x++) {
    gridLines.push(
      <line
        key={`gx-${x}`}
        x1={padding + m2px(x)}
        y1={padding}
        x2={padding + m2px(x)}
        y2={padding + m2px(plan.total_height)}
        stroke={COLORS.grid}
        strokeWidth={1}
      />,
    );
  }
  for (let y = 0; y <= plan.total_height; y++) {
    gridLines.push(
      <line
        key={`gy-${y}`}
        x1={padding}
        y1={padding + m2px(y)}
        x2={padding + m2px(plan.total_width)}
        y2={padding + m2px(y)}
        stroke={COLORS.grid}
        strokeWidth={1}
      />,
    );
  }

  return (
    <svg
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full h-auto"
      style={{ maxHeight: '70vh' }}
    >
      <rect width={svgW} height={svgH} fill={COLORS.bg} />
      {gridLines}

      {/* Title */}
      <text
        x={svgW / 2}
        y={28}
        textAnchor="middle"
        fill={COLORS.text}
        fontSize={16}
        fontWeight="700"
        fontFamily="Inter, system-ui, sans-serif"
      >
        {plan.title}
      </text>

      {/* Scale */}
      <text
        x={svgW / 2}
        y={44}
        textAnchor="middle"
        fill={COLORS.dim}
        fontSize={11}
        fontFamily="Inter, system-ui, sans-serif"
      >
        {plan.total_width} x {plan.total_height} m — Echelle 1:{Math.round(100 / zoom)}
      </text>

      {plan.rooms.map((room, i) => drawRoom(room, i))}

      {/* Legend */}
      <g transform={`translate(${padding}, ${svgH - 20})`}>
        <line x1={0} y1={0} x2={16} y2={0} stroke={COLORS.door} strokeWidth={2} />
        <text x={20} y={4} fill={COLORS.dim} fontSize={10} fontFamily="Inter, system-ui, sans-serif">Porte</text>
        <line x1={60} y1={0} x2={76} y2={0} stroke={COLORS.window} strokeWidth={3} />
        <text x={80} y={4} fill={COLORS.dim} fontSize={10} fontFamily="Inter, system-ui, sans-serif">Fenetre</text>
      </g>
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function PlansPage() {
  const [photo, setPhoto] = useState<File | null>(null);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);
  const [notes, setNotes] = useState('');
  const [generating, setGenerating] = useState(false);
  const [plan, setPlan] = useState<PlanData | null>(null);
  const [error, setError] = useState('');
  const [zoom, setZoom] = useState(1);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);

  function handlePhotoSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setPhoto(file);
    setPhotoPreview(URL.createObjectURL(file));
    setPlan(null);
    setError('');
  }

  async function handleGenerate() {
    if (!photo) return;
    setGenerating(true);
    setError('');

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Session expiree');

      const formData = new FormData();
      formData.append('photo', photo);
      if (notes.trim()) formData.append('notes', notes);

      const res = await fetch('/api/ai/plan', {
        method: 'POST',
        headers: { Authorization: `Bearer ${session.access_token}` },
        body: formData,
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur generation');

      setPlan(data.plan);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Erreur inconnue');
    } finally {
      setGenerating(false);
    }
  }

  function handleDownload() {
    if (!svgContainerRef.current) return;
    const svg = svgContainerRef.current.querySelector('svg');
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([svgData], { type: 'image/svg+xml' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${plan?.title || 'plan'}.svg`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function reset() {
    setPhoto(null);
    setPhotoPreview(null);
    setNotes('');
    setPlan(null);
    setError('');
    setZoom(1);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  const totalSurface = plan
    ? plan.rooms.reduce((sum, r) => sum + r.width * r.height, 0)
    : 0;

  return (
    <div className="space-y-6">
      <PageHeader title="Plans IA" description="Transformez un croquis en plan technique professionnel">
        {plan && (
          <div className="flex gap-2">
            <Button variant="outline" size="sm" onClick={reset}>
              <RotateCcw className="h-4 w-4 mr-1" /> Nouveau
            </Button>
            <Button size="sm" onClick={handleDownload}>
              <Download className="h-4 w-4 mr-1" /> Telecharger SVG
            </Button>
          </div>
        )}
      </PageHeader>

      {!plan ? (
        <div className="max-w-lg mx-auto space-y-6">
          {/* Upload zone */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handlePhotoSelect}
            className="hidden"
          />

          {photoPreview ? (
            <div className="relative rounded-xl border border-border overflow-hidden">
              <img
                src={photoPreview}
                alt="Croquis"
                className="w-full max-h-80 object-contain bg-muted"
              />
              <button
                onClick={() => fileInputRef.current?.click()}
                className="absolute bottom-3 right-3 rounded-lg bg-background/90 backdrop-blur px-3 py-1.5 text-xs font-medium border border-border hover:bg-background transition-colors"
              >
                Changer la photo
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="w-full rounded-xl border-2 border-dashed border-border bg-card p-12 text-center transition-all hover:border-primary/50 hover:bg-primary/5"
            >
              <div className="flex h-16 w-16 items-center justify-center rounded-full bg-primary/10 mx-auto">
                <Camera className="h-8 w-8 text-primary" />
              </div>
              <h3 className="mt-4 font-semibold text-foreground">Photographiez votre croquis</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Prenez en photo ou deposez votre esquisse a main levee
              </p>
              <p className="mt-3 text-xs text-muted-foreground">PNG, JPG — max 10 Mo</p>
            </button>
          )}

          {/* Notes */}
          <div>
            <label className="text-sm font-medium text-foreground">
              Decrivez votre croquis
            </label>
            <Textarea
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="Ex: Le salon fait 5m x 4m, la cuisine est a droite de l'entree, il y a 3 chambres a l'etage, la salle de bain est entre les 2 chambres..."
              className="mt-2"
              rows={4}
            />
          </div>

          {error && (
            <p className="text-sm text-destructive bg-destructive/10 px-4 py-2 rounded-lg">{error}</p>
          )}

          <Button
            className="w-full"
            size="lg"
            onClick={handleGenerate}
            disabled={!photo || !notes.trim() || generating}
          >
            {generating ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Analyse du croquis en cours...
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4 mr-2" />
                Generer le plan
              </>
            )}
          </Button>
        </div>
      ) : (
        <div className="space-y-4">
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-4">
              {/* Room summary */}
              <div className="flex items-center gap-3 text-sm text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <Ruler className="h-4 w-4" />
                  {plan.rooms.length} piece{plan.rooms.length > 1 ? 's' : ''}
                </span>
                <span>{totalSurface.toFixed(1)} m² total</span>
                <span>{plan.total_width} x {plan.total_height} m</span>
              </div>
            </div>

            {/* Zoom controls */}
            <div className="flex items-center gap-1 border border-border rounded-lg p-0.5">
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom(z => Math.max(0.5, z - 0.25))}
              >
                <Minus className="h-3.5 w-3.5" />
              </Button>
              <span className="text-xs font-medium w-12 text-center">{Math.round(zoom * 100)}%</span>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7"
                onClick={() => setZoom(z => Math.min(2, z + 0.25))}
              >
                <Plus className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Plan SVG */}
          <div
            ref={svgContainerRef}
            className="rounded-xl border border-border bg-card overflow-auto"
          >
            <PlanSVG plan={plan} zoom={zoom} />
          </div>

          {/* Room details */}
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-2">
            {plan.rooms.map((room, i) => (
              <div key={i} className="rounded-lg border border-border bg-card p-3 text-center">
                <p className="text-sm font-medium text-foreground truncate">{room.name}</p>
                <p className="text-xs text-muted-foreground mt-1">
                  {room.width.toFixed(1)} x {room.height.toFixed(1)} m
                </p>
                <p className="text-xs font-medium text-primary mt-0.5">
                  {(room.width * room.height).toFixed(1)} m²
                </p>
              </div>
            ))}
          </div>

          {/* Original sketch */}
          {photoPreview && (
            <details className="rounded-xl border border-border bg-card">
              <summary className="px-4 py-3 text-sm font-medium cursor-pointer hover:bg-muted/50 transition-colors">
                Voir le croquis original
              </summary>
              <div className="p-4 pt-0">
                <img src={photoPreview} alt="Croquis original" className="rounded-lg max-h-60 object-contain mx-auto" />
              </div>
            </details>
          )}
        </div>
      )}
    </div>
  );
}
