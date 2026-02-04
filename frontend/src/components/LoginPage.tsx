import { useState } from 'react';
import { authApi } from '../api/client';

function LoginPage() {
  const [showPrivacyDetails, setShowPrivacyDetails] = useState(false);

  const handleGoogleLogin = () => {
    window.location.href = authApi.getGoogleLoginUrl();
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-orange-100">
      <div className="max-w-md mx-auto px-6 py-12">
        {/* Logo and title */}
        <div className="text-center mb-8">
          <div className="text-7xl mb-4">🍽️</div>
          <h1 className="text-3xl font-bold text-gray-900">CalLogs</h1>
          <p className="text-gray-600 mt-2">Track calories from your food orders automatically</p>
        </div>

        {/* Features */}
        <div className="mb-8 space-y-3">
          <Feature icon="📧" text="Scans your Swiggy order emails" />
          <Feature icon="🔥" text="Calculates calories for each dish" />
          <Feature icon="💰" text="Tracks total money spent on food" />
          <Feature icon="📅" text="Shows daily intake on a calendar" />
        </div>

        {/* Data access disclosure */}
        <div className="bg-white rounded-xl p-4 mb-6 shadow-sm">
          <h3 className="font-semibold text-gray-900 mb-3">What we access</h3>
          <div className="space-y-3">
            <DataAccessItem
              icon="✓"
              iconColor="text-green-500"
              title="Swiggy order emails only"
              description="We only read emails from noreply@swiggy.in"
            />
            <DataAccessItem
              icon="👁"
              iconColor="text-blue-500"
              title="Read-only access"
              description="We cannot modify, delete, or send emails"
            />
            <DataAccessItem
              icon="✗"
              iconColor="text-red-500"
              title="No other emails"
              description="We do not access personal, work, or other emails"
            />
            <DataAccessItem
              icon="🔒"
              iconColor="text-purple-500"
              title="Data stays private"
              description="Your data is never shared or sold to third parties"
            />
          </div>
        </div>

        {/* Privacy details button */}
        <button
          onClick={() => setShowPrivacyDetails(true)}
          className="w-full text-center text-orange-600 text-sm hover:underline mb-6"
        >
          Learn more about data handling →
        </button>

        {/* Sign in button */}
        <button
          onClick={handleGoogleLogin}
          className="w-full btn-primary flex items-center justify-center gap-3 py-3"
        >
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
        </button>

        <p className="text-center text-xs text-gray-500 mt-4">
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

function Feature({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex items-center gap-3">
      <span className="text-xl">{icon}</span>
      <span className="text-gray-600">{text}</span>
    </div>
  );
}

function DataAccessItem({
  icon,
  iconColor,
  title,
  description,
}: {
  icon: string;
  iconColor: string;
  title: string;
  description: string;
}) {
  return (
    <div className="flex items-start gap-3">
      <span className={`text-lg ${iconColor}`}>{icon}</span>
      <div>
        <p className="font-medium text-gray-900 text-sm">{title}</p>
        <p className="text-xs text-gray-500">{description}</p>
      </div>
    </div>
  );
}

function PrivacyModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b px-6 py-4 flex justify-between items-center">
          <h2 className="text-xl font-bold">Privacy & Data Handling</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            ✕
          </button>
        </div>

        <div className="px-6 py-4 space-y-6">
          <PrivacySection title="Purpose of Data Access" icon="🎯">
            <p>
              CalLogs helps you track calories and spending from your Swiggy food orders.
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
              CalLogs complies with Google's API Services User Data Policy, including the
              Limited Use requirements. Our use of information received from Google APIs
              adheres to Google's policies.
            </p>
          </PrivacySection>

          <PrivacySection title="Revoking Access" icon="↩️">
            <p>You can revoke CalLogs' access to your Gmail at any time:</p>
            <ul className="list-disc list-inside space-y-1 mt-2">
              <li>Sign out from the app</li>
              <li>Or visit Google Account → Security → Third-party apps</li>
            </ul>
          </PrivacySection>
        </div>

        <div className="sticky bottom-0 bg-white border-t px-6 py-4">
          <button onClick={onClose} className="w-full btn-primary">
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
      <h3 className="font-semibold text-gray-900 flex items-center gap-2 mb-2">
        <span>{icon}</span> {title}
      </h3>
      <div className="text-sm text-gray-600">{children}</div>
    </div>
  );
}

export default LoginPage;
