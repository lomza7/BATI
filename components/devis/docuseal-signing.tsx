'use client';

import { useState, useRef } from 'react';
import { DocusealForm } from '@docuseal/react';
import { Loader2 } from 'lucide-react';

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
              min-height: 200px;
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
