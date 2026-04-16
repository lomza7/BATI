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
          padding: '72px 90px',
          fontFamily: 'system-ui, -apple-system, sans-serif',
        }}
      >
        {/* Top row: brand mark + compliance badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginBottom: 48,
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: 20 }}>
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

          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '12px 22px',
              borderRadius: 999,
              background: '#E7F0FF',
              border: '2px solid #B9D0FF',
              color: '#1D4ED8',
              fontSize: 22,
              fontWeight: 600,
              letterSpacing: '-0.01em',
            }}
          >
            <span
              style={{
                width: 10,
                height: 10,
                borderRadius: 5,
                background: '#1D4ED8',
              }}
            />
            Facture électronique 2026 · prêt
          </div>
        </div>

        {/* Headline — uses flex `gap` (not &nbsp;) because Satori strips
            leading/trailing whitespace inside flex items. */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            gap: '0 22px',
            fontSize: 82,
            fontWeight: 800,
            color: '#1a1a1a',
            lineHeight: 1.05,
            letterSpacing: '-0.03em',
            marginBottom: 32,
          }}
        >
          <span>Le logiciel du bâtiment</span>
          <span
            style={{
              color: '#d97757',
              fontStyle: 'italic',
              fontWeight: 700,
            }}
          >
            tout-en-un
          </span>
          <span>pour artisans</span>
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
          Devis IA vocal · Chantiers · Planning · CRM · Paiements
        </div>

        {/* Footer row: domain + social proof */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            width: '100%',
            marginTop: 'auto',
            fontSize: 26,
            letterSpacing: '-0.01em',
          }}
        >
          <div
            style={{
              color: '#d97757',
              fontWeight: 600,
            }}
          >
            hellobat.app
          </div>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 18,
              color: '#4a4a4a',
              fontWeight: 500,
            }}
          >
            <span>Essai gratuit 30 jours</span>
            <span style={{ color: '#C9B99A' }}>·</span>
            <span>Sans carte bancaire</span>
          </div>
        </div>
      </div>
    ),
    { ...size }
  );
}
