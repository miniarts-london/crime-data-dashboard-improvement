'use client';

import { useEffect } from 'react';

// Only fires if the ROOT layout itself throws - app/error.tsx can't catch
// that, since it's rendered *inside* layout.tsx and so goes down with it.
// Because layout.tsx (and everything it renders, including Providers/MUI's
// theme setup) is exactly what may have failed, this file replaces the
// whole document and deliberately does NOT reach for MUI or the app's own
// theme - relying on the thing that might be broken to render the page
// explaining that it's broken is the wrong bet. Plain inline styles and a
// bare <html>/<body> are the point here, not an oversight.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'system-ui, sans-serif',
          padding: '0 16px',
        }}
      >
        <div style={{ textAlign: 'center', maxWidth: 480 }}>
          <h1 style={{ fontSize: '1.5rem', marginBottom: '0.5rem' }}>Something went wrong</h1>
          <p style={{ color: '#555', marginBottom: '1.5rem' }}>
            The application failed to load. Reloading usually fixes this.
          </p>
          <button
            onClick={() => reset()}
            style={{
              padding: '0.5rem 1.25rem',
              fontSize: '1rem',
              cursor: 'pointer',
              borderRadius: 4,
              border: '1px solid #333',
              background: '#fff',
            }}
          >
            Try again
          </button>
        </div>
      </body>
    </html>
  );
}
