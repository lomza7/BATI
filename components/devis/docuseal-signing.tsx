'use client';

import { useState, useRef } from 'react';
import { DocusealForm } from '@docuseal/react';
import { Loader2, RotateCcw } from 'lucide-react';

interface Props {
  slug: string;
  onComplete: () => void;
  accentColor?: string;
}

export function DocusealSigning({ slug, onComplete, accentColor = '#d35400' }: Props) {
  const [loading, setLoading] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);

  return (
    <div ref={containerRef} className="relative" id="docuseal-signing">
      {loading && (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Chargement de la signature...</span>
        </div>
      )}

      {/* Hint mobile : tourner le telephone */}
      {!loading && (
        <div className="sm:hidden flex items-center gap-2 p-3 mb-3 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
          <RotateCcw className="h-4 w-4 flex-shrink-0" />
          <p className="text-xs">Tournez votre telephone en paysage pour signer plus facilement.</p>
        </div>
      )}

      <div className={loading ? 'opacity-0 h-0 overflow-hidden' : 'min-h-[400px]'}>
        <DocusealForm
          src={`https://docuseal.eu/s/${slug}`}
          withTitle={false}
          withDownloadButton={false}
          withSendCopyButton={false}
          onComplete={() => onComplete()}
          onLoad={() => setLoading(false)}
          style={{ minHeight: '400px' }}
          customCss={`
            #form_container {
              font-family: 'Inter', sans-serif;
              min-height: 400px;
              touch-action: manipulation;
            }
            #form_container canvas {
              touch-action: none;
              min-height: 250px !important;
              height: 250px !important;
              width: 100% !important;
            }
            .signature-pad-canvas, [data-signature] canvas {
              min-height: 250px !important;
              height: 250px !important;
            }
            button[type="submit"] {
              background-color: ${accentColor} !important;
              border-radius: 12px !important;
              font-weight: 600 !important;
              min-height: 48px !important;
              font-size: 16px !important;
            }
            button[type="submit"]:hover {
              opacity: 0.9 !important;
            }
            @media (max-width: 640px) {
              #form_container {
                padding: 0 !important;
              }
              #form_container canvas {
                min-height: 200px !important;
                height: 200px !important;
              }
              button[type="submit"] {
                width: 100% !important;
                min-height: 52px !important;
              }
            }
          `}
        />
      </div>
    </div>
  );
}
