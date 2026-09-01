'use client';

/**
 * The last-resort boundary: a failure in the ROOT layout itself, which the
 * route-group boundaries sit inside and therefore cannot catch.
 *
 * It must render its own <html> and <body>, because the layout that normally
 * provides them is the thing that failed. For the same reason it uses inline
 * styles rather than the design tokens — the stylesheet is loaded by that
 * layout, so a token would resolve to nothing here.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          fontFamily: 'system-ui, sans-serif',
          background: '#FCF9F8',
          color: '#1B1C1C',
          display: 'flex',
          minHeight: '100vh',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '24px',
          textAlign: 'center',
          margin: 0,
        }}
      >
        <h1 style={{ fontSize: '20px', fontWeight: 600, margin: 0 }}>FreshCarts is unavailable</h1>

        <p style={{ color: '#717A6D', fontSize: '14px', maxWidth: '28rem', marginTop: '8px' }}>
          Something went wrong while loading the application. Please try again in a moment.
        </p>

        <button
          type="button"
          onClick={reset}
          style={{
            marginTop: '24px',
            minHeight: '48px',
            padding: '0 24px',
            borderRadius: '999px',
            border: 'none',
            background: '#00450D',
            color: '#FFFFFF',
            fontSize: '16px',
            fontWeight: 500,
            cursor: 'pointer',
          }}
        >
          Try again
        </button>

        {error.digest ? (
          <p style={{ color: '#717A6D', fontSize: '12px', marginTop: '16px' }}>
            Reference: {error.digest}
          </p>
        ) : null}
      </body>
    </html>
  );
}
