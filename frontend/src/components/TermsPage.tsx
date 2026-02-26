function TermsPage() {
  return (
    <div className="min-h-screen bg-linen">
      <header className="w-full px-8 py-5 bg-ebony">
        <a href="/" className="flex items-center gap-2 w-fit">
          <svg width="40" height="36" viewBox="5 5 150 90" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 15 L15 45 Q15 55 20 55 L20 85" stroke="white" strokeWidth="4" strokeLinecap="round"/><path d="M25 15 L25 45 Q25 55 20 55" stroke="white" strokeWidth="4" strokeLinecap="round"/><path d="M20 15 L20 40" stroke="white" strokeWidth="3" strokeLinecap="round"/><circle cx="80" cy="50" r="38" stroke="white" strokeWidth="4"/><circle cx="80" cy="50" r="28" stroke="white" strokeWidth="2.5"/><path d="M65 52 L75 62 L95 40" stroke="#84CC16" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/><ellipse cx="140" cy="30" rx="10" ry="20" stroke="white" strokeWidth="4"/><path d="M140 50 L140 85" stroke="white" strokeWidth="4" strokeLinecap="round"/></svg>
          <span className="font-heading text-3xl font-bold text-white tracking-tight">Bitewise</span>
        </a>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <h1 className="font-heading text-4xl font-bold text-ebony">Terms of Service</h1>
        <p className="text-sm text-ebony/50">Last updated: February 2026</p>

        <div className="space-y-6 text-sm text-ebony/80 leading-relaxed">
          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">1. Service Description</h2>
            <p>Bitewise is a personal nutrition tracking tool that analyzes your Swiggy food delivery orders from Gmail to provide health insights, calorie tracking, and spending summaries.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">2. Account & Authentication</h2>
            <p>You sign in using your Google account. By signing in, you grant Bitewise read-only access to your Gmail to filter and process Swiggy order emails. You are responsible for maintaining the security of your Google account.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">3. Acceptable Use</h2>
            <p>You agree to use Bitewise for personal nutrition tracking only. You may not:</p>
            <ul className="list-disc list-inside space-y-1">
              <li>Attempt to access other users' data.</li>
              <li>Reverse-engineer, scrape, or misuse the service.</li>
              <li>Use the service for any unlawful purpose.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">4. Nutrition Data Disclaimer</h2>
            <p>Calorie and nutrition estimates are <strong>approximate</strong> and generated using AI. They should not be used as medical or dietary advice. Always consult a healthcare professional for nutritional guidance.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">5. Data & Privacy</h2>
            <p>Your use of Bitewise is also governed by our <a href="/privacy" className="text-lime underline">Privacy Policy</a>. We access only Swiggy order emails and store only extracted order data.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">6. Service Availability</h2>
            <p>Bitewise is provided "as is" without warranties. We may modify, suspend, or discontinue the service at any time without notice.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">7. Limitation of Liability</h2>
            <p>Bitewise is not liable for any damages arising from your use of the service, including inaccurate nutrition data or service interruptions.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">8. Contact</h2>
            <p>For questions about these terms, reach out at <strong>pranavpatre.work@gmail.com</strong>.</p>
          </section>
        </div>
      </main>
    </div>
  );
}

export default TermsPage;
