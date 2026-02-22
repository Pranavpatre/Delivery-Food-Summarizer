import { useState } from 'react';
import { authApi } from '../api/client';

function LoginPage() {
  const [showPrivacy, setShowPrivacy] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleGoogleLogin = () => {
    setIsRedirecting(true);
    window.location.href = authApi.getGoogleLoginUrl();
  };

  return (
    <div className="min-h-screen bg-linen flex flex-col">
      {/* Header */}
      <header className="w-full px-8 py-5 bg-ebony">
        <div className="flex items-center gap-2">
          <svg width="40" height="36" viewBox="5 5 150 90" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 15 L15 45 Q15 55 20 55 L20 85" stroke="white" strokeWidth="4" strokeLinecap="round"/><path d="M25 15 L25 45 Q25 55 20 55" stroke="white" strokeWidth="4" strokeLinecap="round"/><path d="M20 15 L20 40" stroke="white" strokeWidth="3" strokeLinecap="round"/><circle cx="80" cy="50" r="38" stroke="white" strokeWidth="4"/><circle cx="80" cy="50" r="28" stroke="white" strokeWidth="2.5"/><path d="M65 52 L75 62 L95 40" stroke="#84CC16" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/><ellipse cx="140" cy="30" rx="10" ry="20" stroke="white" strokeWidth="4"/><path d="M140 50 L140 85" stroke="white" strokeWidth="4" strokeLinecap="round"/></svg>
          <span className="font-heading text-3xl font-bold text-white tracking-tight">Bitewise</span>
        </div>
      </header>

      {/* Hero */}
      <main className="flex-1 flex flex-col items-center justify-center px-6 pb-24">
        <div className="w-full flex flex-col items-center space-y-10 animate-fade-in">
          {/* Tagline */}
          <div className="space-y-4 text-center">
            <h1 className="font-heading text-6xl md:text-7xl font-bold text-ebony leading-none tracking-tight uppercase">
              Order Smarter.
            </h1>
            <p className="font-tagline text-ebony text-base md:text-lg italic leading-relaxed">
              Zero-effort nutrition tracking for your Swiggy food orders
            </p>
            <p className="text-ebony/50 text-xs tracking-wide">
              Based on the globally accepted 5-CNL nutrition rating system
            </p>
          </div>

          {/* CTA */}
          <div className="max-w-xs mx-auto space-y-4">
            <button
              onClick={handleGoogleLogin}
              disabled={isRedirecting}
              className="w-full btn-primary flex items-center justify-center gap-3 text-base py-4"
            >
              {isRedirecting ? (
                <>
                  <div className="animate-spin rounded-full h-5 w-5 border-2 border-ebony border-t-transparent"></div>
                  Connecting...
                </>
              ) : (
                <>
                  <svg className="w-5 h-5" viewBox="0 0 24 24">
                    <path
                      fill="currentColor"
                      d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    />
                    <path
                      fill="currentColor"
                      d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                    />
                    <path
                      fill="currentColor"
                      d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                    />
                  </svg>
                  Sign in with Google
                </>
              )}
            </button>

            <p className="text-xs text-ebony/40">
              Sign in with the Google account linked to your Swiggy orders
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="w-full px-8 py-8 space-y-4">
        <div className="flex justify-center gap-8 text-xs text-ebony/40">
          <span>📧 Swiggy emails only</span>
          <span>👁 Read-only</span>
          <span>🔒 Private</span>
        </div>
        <button
          onClick={() => setShowPrivacy(true)}
          className="w-full text-center text-xs text-ebony/30 hover:text-ebony/60 transition-colors"
        >
          How we handle your data →
        </button>
      </footer>

      {/* Privacy Modal */}
      {showPrivacy && (
        <div className="fixed inset-0 bg-ebony/50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl max-w-md w-full max-h-[80vh] overflow-y-auto shadow-2xl">
            <div className="p-6 space-y-6">
              <div className="flex justify-between items-center">
                <h2 className="font-heading text-xl font-black text-ebony">Data Privacy</h2>
                <button
                  onClick={() => setShowPrivacy(false)}
                  className="text-sage hover:text-ebony text-xl transition-colors"
                >
                  ×
                </button>
              </div>
              <div className="space-y-4 text-sm text-ebony leading-relaxed">
                <p>
                  <strong>Purpose:</strong> Extract Swiggy orders for your personal insights only.
                </p>
                <ul className="space-y-2 list-disc list-inside text-ebony/80">
                  <li>Access: Read-only Gmail (Swiggy emails filtered automatically).</li>
                  <li>Stored: Order details only (no full emails).</li>
                  <li>Not done: Sell/share data, ads, or training.</li>
                  <li>Revoke: Google Account → Security → Third-party apps.</li>
                </ul>
                <p className="text-sage text-xs">Compliant with Google API policies.</p>
              </div>
              <button
                onClick={() => setShowPrivacy(false)}
                className="w-full btn-secondary"
              >
                Got it
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default LoginPage;
