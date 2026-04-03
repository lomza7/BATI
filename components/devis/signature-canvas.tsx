'use client';

import { useRef, useEffect, useState, useCallback } from 'react';
import SignaturePad from 'signature_pad';
import { Eraser, PenLine } from 'lucide-react';

interface Props {
  onSign: (dataUrl: string) => void;
  disabled?: boolean;
}

export function SignatureCanvas({ onSign, disabled }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const padRef = useRef<SignaturePad | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isEmpty, setIsEmpty] = useState(true);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const ratio = Math.max(window.devicePixelRatio || 1, 1);
    const width = container.offsetWidth;
    const height = 200;

    canvas.width = width * ratio;
    canvas.height = height * ratio;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) ctx.scale(ratio, ratio);

    if (padRef.current) {
      padRef.current.clear();
      setIsEmpty(true);
    }
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const pad = new SignaturePad(canvas, {
      penColor: '#1a1a1a',
      backgroundColor: 'rgba(255, 255, 255, 0)',
      minWidth: 1,
      maxWidth: 2.5,
    });

    pad.addEventListener('endStroke', () => {
      setIsEmpty(pad.isEmpty());
    });

    padRef.current = pad;
    resizeCanvas();

    window.addEventListener('resize', resizeCanvas);
    return () => {
      window.removeEventListener('resize', resizeCanvas);
      pad.off();
    };
  }, [resizeCanvas]);

  useEffect(() => {
    if (padRef.current) {
      if (disabled) {
        padRef.current.off();
      } else {
        padRef.current.on();
      }
    }
  }, [disabled]);

  function handleClear() {
    padRef.current?.clear();
    setIsEmpty(true);
  }

  function handleSign() {
    if (!padRef.current || padRef.current.isEmpty()) return;
    const dataUrl = padRef.current.toDataURL('image/png');
    onSign(dataUrl);
  }

  return (
    <div className="space-y-3">
      <div
        ref={containerRef}
        className="relative rounded-xl border-2 border-dashed border-[#e5e1da] bg-white overflow-hidden"
      >
        <canvas
          ref={canvasRef}
          className="w-full cursor-crosshair"
          style={{ touchAction: 'none', height: '200px' }}
        />

        {isEmpty && !disabled && (
          <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div className="flex items-center gap-2 text-[#6b6560]/40">
              <PenLine className="h-5 w-5" />
              <span className="text-sm">Signez ici avec votre doigt ou votre souris</span>
            </div>
          </div>
        )}
      </div>

      {!disabled && (
        <div className="flex items-center justify-between gap-3">
          <button
            type="button"
            onClick={handleClear}
            disabled={isEmpty}
            className="h-10 px-4 rounded-lg border border-[#e5e1da] bg-white text-sm font-medium text-[#6b6560] flex items-center gap-2 hover:bg-[#faf9f7] disabled:opacity-40 transition-all"
          >
            <Eraser className="h-4 w-4" />
            Effacer
          </button>

          <button
            type="button"
            onClick={handleSign}
            disabled={isEmpty}
            className="h-10 px-6 rounded-lg bg-[#d35400] text-white text-sm font-medium flex items-center gap-2 hover:bg-[#b94800] disabled:opacity-40 transition-all shadow-lg shadow-[#d35400]/20"
          >
            <PenLine className="h-4 w-4" />
            Signer ce devis
          </button>
        </div>
      )}
    </div>
  );
}
