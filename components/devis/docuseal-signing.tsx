'use client';

import { useState } from 'react';
import { DocusealForm } from '@docuseal/react';
import { Loader2 } from 'lucide-react';

interface Props {
  slug: string;
  onComplete: () => void;
  accentColor?: string;
}

export function DocusealSigning({ slug, onComplete, accentColor = '#d35400' }: Props) {
  const [loading, setLoading] = useState(true);

  return (
    <div className="relative">
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
          onComplete={() => onComplete()}
          onLoad={() => setLoading(false)}
          customCss={`
            #form_container { font-family: 'Inter', sans-serif; }
            button[type="submit"] {
              background-color: ${accentColor} !important;
              border-radius: 12px !important;
              font-weight: 600 !important;
            }
            button[type="submit"]:hover {
              opacity: 0.9 !important;
            }
          `}
        />
      </div>
    </div>
  );
}
