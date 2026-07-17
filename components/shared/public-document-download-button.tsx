'use client';

import { Download } from 'lucide-react';
import { cn } from '@/lib/utils';

interface PublicDocumentDownloadButtonProps {
  documentId: string;
  filename: string;
  accentColor?: string;
  directUrl?: string | null;
  className?: string;
}

function cleanFilename(value: string): string {
  return value
    .replace(/[<>:"/\\|?*\u0000-\u001F]/g, '-')
    .replace(/\s+/g, ' ')
    .trim();
}

export function PublicDocumentDownloadButton({
  documentId,
  filename,
  accentColor = '#d35400',
  directUrl,
  className,
}: PublicDocumentDownloadButtonProps) {
  const buttonClassName = cn(
    'inline-flex h-9 shrink-0 items-center justify-center gap-2 rounded-lg px-3 text-xs font-semibold text-white shadow-sm transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2',
    className,
  );

  if (directUrl) {
    return (
      <a
        href={directUrl}
        download={`${cleanFilename(filename)}.pdf`}
        className={buttonClassName}
        style={{ backgroundColor: accentColor }}
        aria-label="Télécharger le document au format PDF"
      >
        <Download className="h-4 w-4" />
        <span>Télécharger le PDF</span>
      </a>
    );
  }

  function handleDownload() {
    const documentNode = document.getElementById(documentId);
    if (!documentNode) {
      window.print();
      return;
    }

    document.getElementById('print-clone')?.remove();

    const clone = documentNode.cloneNode(true) as HTMLElement;
    clone.querySelectorAll('[data-pdf-exclude]').forEach((element) => element.remove());
    clone.id = 'print-clone';
    document.body.appendChild(clone);

    const previousTitle = document.title;
    const fallbackTimer = window.setTimeout(cleanup, 60_000);

    function cleanup() {
      window.clearTimeout(fallbackTimer);
      document.documentElement.classList.remove('is-printing');
      document.title = previousTitle;
      clone.remove();
      window.removeEventListener('afterprint', cleanup);
    }

    document.title = cleanFilename(filename);
    document.documentElement.classList.add('is-printing');
    window.addEventListener('afterprint', cleanup);
    window.print();
  }

  return (
    <button
      type="button"
      onClick={handleDownload}
      className={buttonClassName}
      style={{ backgroundColor: accentColor }}
      aria-label="Télécharger le document au format PDF"
    >
      <Download className="h-4 w-4" />
      <span>Télécharger le PDF</span>
    </button>
  );
}
