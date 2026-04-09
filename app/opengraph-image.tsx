import { ImageResponse } from 'next/og';

export const alt = 'Hellobat — Logiciel du bâtiment tout-en-un pour artisans';
export const size = { width: 1200, height: 630 };
export const contentType = 'image/png';

export default async function Image() {
  return new ImageResponse(
    (
      <div
        style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'center',
          alignItems: 'flex-start',
          background: '#F8F2E8',
          padding: '80px 90px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Brand mark */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 20,
            marginBottom: 56,
          }}
        >
          <div
            style={{
              width: 72,
              height: 72,
              borderRadius: 36,
              background: '#d97757',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'white',
              fontSize: 48,
              fontWeight: 800,
              letterSpacing: '-0.04em',
            }}
          >
            h
          </div>
          <div
            style={{
              fontSize: 40,
              fontWeight: 700,
              color: '#1a1a1a',
              letterSpacing: '-0.02em',
            }}
          >
            Hellobat
          </div>
        </div>

        {/* Headline */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            fontSize: 82,
            fontWeight: 800,
            color: '#1a1a1a',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            marginBottom: 36,
          }}
        >
          <span>Le logiciel du bâtiment&nbsp;</span>
          <span
            style={{
              color: '#d97757',
              fontStyle: 'italic',
              fontWeight: 700,
            }}
          >
            tout-en-un
          </span>
          <span>&nbsp;pour artisans</span>
        </div>

        {/* Subline */}
        <div
          style={{
            fontSize: 30,
            color: '#4a4a4a',
            lineHeight: 1.3,
            letterSpacing: '-0.01em',
          }}
        >
          Devis IA vocal · Facture électronique 2026 · Chantiers · Planning
        </div>

        {/* Footer row */}
        <div
          style={{
            display: 'flex',
            marginTop: 'auto',
            fontSize: 26,
            color: '#d97757',
            fontWeight: 600,
            letterSpacing: '-0.01em',
          }}
        >
          hellobat.app
        </div>
      </div>
    ),
    { ...size }
  );
}
