function PrivacyPage() {
  return (
    <div className="min-h-screen bg-linen">
      <header className="w-full px-8 py-5 bg-ebony">
        <a href="/" className="flex items-center gap-2 w-fit">
          <svg width="40" height="36" viewBox="5 5 150 90" fill="none" xmlns="http://www.w3.org/2000/svg"><path d="M15 15 L15 45 Q15 55 20 55 L20 85" stroke="white" strokeWidth="4" strokeLinecap="round"/><path d="M25 15 L25 45 Q25 55 20 55" stroke="white" strokeWidth="4" strokeLinecap="round"/><path d="M20 15 L20 40" stroke="white" strokeWidth="3" strokeLinecap="round"/><circle cx="80" cy="50" r="38" stroke="white" strokeWidth="4"/><circle cx="80" cy="50" r="28" stroke="white" strokeWidth="2.5"/><path d="M65 52 L75 62 L95 40" stroke="#84CC16" strokeWidth="6" strokeLinecap="round" strokeLinejoin="round"/><ellipse cx="140" cy="30" rx="10" ry="20" stroke="white" strokeWidth="4"/><path d="M140 50 L140 85" stroke="white" strokeWidth="4" strokeLinecap="round"/></svg>
          <span className="font-heading text-3xl font-bold text-white tracking-tight">Bitewise</span>
        </a>
      </header>

      <main className="max-w-2xl mx-auto px-6 py-12 space-y-8">
        <h1 className="font-heading text-4xl font-bold text-ebony">Privacy Policy</h1>
        <p className="text-sm text-ebony/50">Last updated: February 2026</p>

        <div className="space-y-6 text-sm text-ebony/80 leading-relaxed">
          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">What Bitewise Does</h2>
            <p>Bitewise analyzes your Swiggy food delivery orders to provide personal nutrition insights, health scores, and spending trends. We access your Gmail to read Swiggy order confirmation emails only.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">Data We Access</h2>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Google Account:</strong> Your email address and basic profile (name) for authentication.</li>
              <li><strong>Gmail (read-only):</strong> We only read emails from <code className="bg-ebony/5 px-1 rounded">noreply@swiggy.in</code>. No other emails are accessed or stored.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">Data We Store</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Extracted order details: restaurant name, items ordered, prices, and dates.</li>
              <li>Calculated nutrition data (calories, macros) derived from your orders.</li>
              <li>Your email address for account identification.</li>
            </ul>
            <p>We do <strong>not</strong> store the full content of any email.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">What We Don't Do</h2>
            <ul className="list-disc list-inside space-y-1">
              <li>Sell or share your data with third parties.</li>
              <li>Use your data for advertising or marketing.</li>
              <li>Use your data for AI/ML model training.</li>
              <li>Access emails beyond Swiggy order confirmations.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">Third-Party Services</h2>
            <p>We use the following services to process your data:</p>
            <ul className="list-disc list-inside space-y-1">
              <li><strong>Google Gmail API:</strong> To read your Swiggy order emails (read-only access).</li>
              <li><strong>Anthropic Claude AI:</strong> To extract and estimate nutrition information from food items.</li>
            </ul>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">Revoking Access</h2>
            <p>You can revoke Bitewise's access to your Google account at any time:</p>
            <ol className="list-decimal list-inside space-y-1">
              <li>Go to your <a href="https://myaccount.google.com/permissions" className="text-lime underline" target="_blank" rel="noopener noreferrer">Google Account Permissions</a>.</li>
              <li>Find "Bitewise" and click "Remove Access".</li>
            </ol>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">Data Deletion</h2>
            <p>To request deletion of your data, revoke access via Google and contact us. All your stored data will be permanently removed.</p>
          </section>

          <section className="space-y-2">
            <h2 className="font-heading text-lg font-bold text-ebony">Contact</h2>
            <p>For questions about this privacy policy, reach out at <strong>pranavpatre.work@gmail.com</strong>.</p>
          </section>
        </div>
      </main>
    </div>
  );
}

export default PrivacyPage;
