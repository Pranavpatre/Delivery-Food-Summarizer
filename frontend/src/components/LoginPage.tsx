import { useState } from 'react';
import { authApi } from '../api/client';

function LoginPage() {
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);
  const [isRedirecting, setIsRedirecting] = useState(false);

  const handleGoogleLogin = () => {
    setIsRedirecting(true);
    window.location.href = authApi.getGoogleLoginUrl();
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-cream via-cream to-sage/30">
      {/* Header */}
      <header className="bg-olive pl-12 pr-6 py-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl">🍽️</span>
          <h1 className="font-heading text-xl font-black text-cream">Bitewise</h1>
        </div>
      </header>

      <div className="max-w-md mx-auto px-6 py-8 flex flex-col" style={{ minHeight: 'calc(100vh - 73px)' }}>
        {/* Logo and title */}
        <div className="text-center mb-10 mt-4">
          <div className="text-6xl mb-5">🍽️</div>
          <h1 className="font-heading text-4xl font-black text-olive mb-2">Bitewise</h1>
          <p className="font-heading text-olive/80 font-extrabold text-2xl">Track your food orders, the wise way</p>
          <p className="text-lime mt-3 text-sm font-semibold">Spend wiser. Eat wiser. Order wiser.</p>
        </div>

        {/* Description */}
        <div className="mb-10">
          <p className="font-sans text-center text-olive/80 text-sm font-medium leading-relaxed">
            One smart dashboard for your food orders, calories, and spend — updated automatically from your Swiggy emails.
          </p>
          <p className="font-sans text-center font-bold text-lime text-base mt-4">
            No manual logging.
          </p>
        </div>

        {/* Features - Horizontal */}
        <div className="flex justify-center items-center gap-6 mb-10">
          <FeatureItem icon="📧" text="Auto-import" />
          <FeatureItem icon="🔥" text="Calories" />
          <FeatureItem icon="💰" text="Spending" />
          <FeatureItem icon="📅" text="Daily view" />
        </div>

        {/* Spacer to push content up */}
        <div className="flex-grow"></div>

        {/* Data access - Compact horizontal */}
        <div className="flex items-center justify-center gap-4 text-xs text-olive/70 mb-4">
          <span className="flex items-center gap-1"><span className="text-lime">✓</span> Swiggy emails only</span>
          <span className="flex items-center gap-1"><span className="text-sage">👁</span> Read-only</span>
          <span className="flex items-center gap-1"><span className="text-olive">🔒</span> Private</span>
        </div>

        {/* Privacy details button */}
        <button
          onClick={() => setShowPrivacyDetails(true)}
          className="w-full text-center text-olive/60 text-xs hover:text-olive mb-4 transition-colors"
        >
          Learn more about data handling →
        </button>

        {/* Sign in button */}
        <button
          onClick={handleGoogleLogin}
          disabled={isRedirecting}
          className="w-full bg-olive hover:bg-olive/90 text-cream font-semibold rounded-xl flex items-center justify-center gap-3 py-4 disabled:opacity-70 transition-colors shadow-lg"
        >
          {isRedirecting ? (
            <>
              <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-cream"></div>
              Connecting to Google...
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

        <p className="text-center text-xs text-olive/50 mt-4 mb-6">
          By signing in, you agree to our data access practices described above.
        </p>
      </div>

      {/* Privacy Details Modal */}
      {showPrivacyDetails && (
        <PrivacyModal onClose={() => setShowPrivacyDetails(false)} />
      )}
    </div>
  );
}

function FeatureItem({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-2">
      <span className="text-2xl">{icon}</span>
      <span className="text-xs font-semibold text-olive/70 tracking-wide uppercase">{text}</span>
    </div>
  );
}

function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-dark/60 flex items-center justify-center p-4 z-50">
      <div className="bg-cream rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto border border-sage/50 shadow-xl">
        <div className="sticky top-0 bg-cream border-b border-sage/30 px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold text-olive">Privacy & Data Handling</h2>
          <button onClick={onClose} className="text-olive hover:text-dark transition-colors">
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          <PrivacySection title="Purpose of Data Access" icon="🎯">
            <p>
              Bitewise helps you track calories and spending from your Swiggy food orders.
              To do this, we need to read your order confirmation emails from Swiggy to
              extract dish names, prices, and calculate their calorie content.
            </p>
          </PrivacySection>

          <PrivacySection title="What We Access" icon="📧">
            <ul className="list-disc list-inside space-y-1">
              <li>Only emails from noreply@swiggy.in</li>
              <li>We filter to only read food order confirmations</li>
              <li>We extract: order date, restaurant name, dish names, quantities, and prices</li>
            </ul>
          </PrivacySection>

          <PrivacySection title="What We Do NOT Access" icon="🚫">
            <ul className="list-disc list-inside space-y-1">
              <li>Personal emails, work emails, or any other emails</li>
              <li>Email attachments</li>
              <li>Your contacts or calendar</li>
              <li>Instamart/grocery orders (automatically filtered out)</li>
              <li>Payment information or addresses</li>
            </ul>
          </PrivacySection>

          <PrivacySection title="Gmail Permission Scope" icon="🔐">
            <p>
              We request read-only access to Gmail (gmail.readonly). This means we can only
              view emails - we cannot modify, delete, send, or do anything else with your
              email account.
            </p>
          </PrivacySection>

          <PrivacySection title="How We Handle Your Data" icon="💾">
            <ul className="list-disc list-inside space-y-1">
              <li>Extracted order data (dishes, calories, prices) is stored securely</li>
              <li>We do not store the full email content</li>
              <li>Your Google credentials are handled by Google's secure OAuth system</li>
              <li>You can delete your data at any time by signing out</li>
            </ul>
          </PrivacySection>

          <PrivacySection title="No Secondary Use" icon="✋">
            <ul className="list-disc list-inside space-y-1">
              <li>Your data is ONLY used to show you your calorie and spending information</li>
              <li>We do NOT sell your data to anyone</li>
              <li>We do NOT share your data with third parties</li>
              <li>We do NOT use your data for advertising</li>
              <li>We do NOT use your data for AI/ML training</li>
            </ul>
          </PrivacySection>

          <PrivacySection title="Google API Compliance" icon="✅">
            <p>
              Bitewise complies with Google's API Services User Data Policy, including the
              Limited Use requirements. Our use of information received from Google APIs
              adheres to Google's policies.
            </p>
          </PrivacySection>

          <PrivacySection title="Revoking Access" icon="↩️">
            <p>You can revoke Bitewise' access to your Gmail at any time:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Sign out from the app</li>
              <li>Or visit Google Account → Security → Third-party apps</li>
            </ul>
          </PrivacySection>
        </div>

        <div className="sticky bottom-0 bg-cream border-t border-sage/30 px-6 py-4">
          <button onClick={onClose} className="w-full bg-olive hover:bg-olive/90 text-cream font-semibold rounded-xl py-3 transition-colors">
            Done
          </button>
        </div>
      </div>
    </div>
  );
}

function PrivacySection({
  title,
  icon,
  children,
}: {
  title: string;
  icon: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h3 className="font-semibold text-olive flex items-center gap-2 mb-2">
        <span>{icon}</span> {title}
      </h3>
      <div className="text-sm text-olive/80">{children}</div>
    </div>
  );
}

export default LoginPage;
