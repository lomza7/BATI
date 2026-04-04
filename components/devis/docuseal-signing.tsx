'use client';

import { useState, useEffect, useRef } from 'react';
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

  // Force iframe resize on orientation changes and after load
  useEffect(() => {
    if (loading) return;

    function resizeIframe() {
      const iframe = containerRef.current?.querySelector('iframe');
      if (iframe) {
        // Force reflow by toggling width
        iframe.style.width = '99.9%';
        requestAnimationFrame(() => {
          iframe.style.width = '100%';
        });
      }
    }

    // Resize after a small delay to ensure iframe content is rendered
    const timer = setTimeout(resizeIframe, 500);
    const timer2 = setTimeout(resizeIframe, 1500);

    window.addEventListener('resize', resizeIframe);
    window.addEventListener('orientationchange', resizeIframe);

    return () => {
      clearTimeout(timer);
      clearTimeout(timer2);
      window.removeEventListener('resize', resizeIframe);
      window.removeEventListener('orientationchange', resizeIframe);
    };
  }, [loading]);

  return (
    <div ref={containerRef} className="relative" id="docuseal-signing" style={{ minHeight: '300px' }}>
      {loading && (
        <div className="absolute inset-0 z-10 flex items-center justify-center bg-white">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          <span className="ml-2 text-sm text-muted-foreground">Chargement de la signature...</span>
        </div>
      )}

      <div style={{ minHeight: '300px', width: '100%' }}>
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
          style={{ minHeight: '500px', width: '100%' }}
          customCss={`
            #form_container {
              font-family: 'Inter', sans-serif;
              touch-action: manipulation;
              padding: 0 !important;
              margin: 0 !important;
              min-height: 400px !important;
            }
            #form_container canvas {
              touch-action: none;
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
