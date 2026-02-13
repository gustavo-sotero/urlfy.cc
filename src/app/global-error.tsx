'use client';

export default function GlobalError({
  error,
  reset
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          padding: 0,
          fontFamily:
            'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif',
          backgroundColor: '#fafafa',
          color: '#171717'
        }}
      >
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '100vh',
            padding: '2rem',
            textAlign: 'center'
          }}
          role="alert"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="64"
            height="64"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#ef4444"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
            <path d="M12 9v4" />
            <path d="M12 17h.01" />
          </svg>
          <h1
            style={{
              marginTop: '1.5rem',
              fontSize: '1.875rem',
              fontWeight: 700
            }}
          >
            Critical Error
          </h1>
          <p style={{ marginTop: '0.25rem', color: '#737373' }}>Erro Crítico</p>
          <p
            style={{
              marginTop: '0.5rem',
              maxWidth: '28rem',
              color: '#737373'
            }}
          >
            An unexpected error occurred in the application. Please try again. /
            Ocorreu um erro inesperado na aplicação. Por favor, tente novamente.
          </p>
          {process.env.NODE_ENV === 'development' && error?.message && (
            <pre
              style={{
                marginTop: '1rem',
                maxWidth: '32rem',
                overflow: 'auto',
                borderRadius: '0.375rem',
                backgroundColor: '#fef2f2',
                padding: '1rem',
                textAlign: 'left',
                fontSize: '0.875rem',
                color: '#dc2626'
              }}
            >
              {error.message}
            </pre>
          )}
          <button
            onClick={() => reset()}
            type="button"
            style={{
              marginTop: '1.5rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.5rem',
              borderRadius: '0.375rem',
              backgroundColor: '#171717',
              padding: '0.5rem 1rem',
              fontSize: '0.875rem',
              fontWeight: 500,
              color: '#ffffff',
              border: 'none',
              cursor: 'pointer'
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 12a9 9 0 0 1 9-9 9.75 9.75 0 0 1 6.74 2.74L21 8" />
              <path d="M21 3v5h-5" />
              <path d="M21 12a9 9 0 0 1-9 9 9.75 9.75 0 0 1-6.74-2.74L3 16" />
              <path d="M8 16H3v5" />
            </svg>
            Try again / Tentar novamente
          </button>
        </div>
      </body>
    </html>
  );
}
