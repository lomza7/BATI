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

      <div className={loading ? 'opacity-0 h-0 overflow-hidden' : ''}>
        <DocusealForm
          src={`https://docuseal.eu/s/${slug}`}
          withTitle={false}
          withDownloadButton={false}
          withSendCopyButton={false}
          allowTypedSignature={true}
          expand={true}
          language="fr"
          onComplete={() => onComplete()}
          onLoad={() => setLoading(false)}
          customCss={`
            #form_container {
              font-family: 'Inter', sans-serif;
              touch-action: manipulation;
              padding: 0 !important;
              margin: 0 !important;
            }
            #form_container canvas {
              touch-action: none;
              width: 100% !important;
              min-height: 180px !important;
            }
            .signature-pad, [data-signature-pad] {
              width: 100% !important;
              min-height: 180px !important;
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
              #form_container canvas {
                min-height: 160px !important;
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
