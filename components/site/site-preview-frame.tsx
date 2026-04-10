'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

interface SitePreviewFrameProps {
  children: ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

/**
 * Renders children inside an <iframe> so that CSS media queries (Tailwind sm:/md:/lg:)
 * respond to the iframe width, not the browser viewport.
 * Copies all parent stylesheets into the iframe for consistent rendering.
 */
export function SitePreviewFrame({ children, className, style }: SitePreviewFrameProps) {
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const [mountNode, setMountNode] = useState<HTMLElement | null>(null);

  useEffect(() => {
    const iframe = iframeRef.current;
    if (!iframe) return;

    const onLoad = () => {
      const doc = iframe.contentDocument;
      if (!doc) return;

      // Reset iframe body styles
      doc.body.style.margin = '0';
      doc.body.style.padding = '0';
      doc.body.style.overflow = 'auto';
      doc.body.style.height = '100%';
      doc.documentElement.style.height = '100%';

      // Copy all stylesheets from parent into the iframe
      const parentStyles = document.querySelectorAll('style, link[rel="stylesheet"]');
      parentStyles.forEach((node) => {
        const clone = node.cloneNode(true) as HTMLElement;
        doc.head.appendChild(clone);
      });

      // Create a mount div inside the iframe body
      const mount = doc.createElement('div');
      mount.id = 'preview-root';
      mount.style.height = '100%';
      doc.body.appendChild(mount);

      setMountNode(mount);
    };

    // iframe is already loaded (about:blank)
    if (iframe.contentDocument?.readyState === 'complete') {
      onLoad();
    } else {
      iframe.addEventListener('load', onLoad);
      return () => iframe.removeEventListener('load', onLoad);
    }
  }, []);

  return (
    <>
      <iframe
        ref={iframeRef}
        title="Aperçu du site"
        className={className}
        style={{ border: 'none', ...style }}
        src="about:blank"
      />
      {mountNode && createPortal(children, mountNode)}
    </>
  );
}
