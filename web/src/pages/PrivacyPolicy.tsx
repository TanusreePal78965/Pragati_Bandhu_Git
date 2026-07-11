import '../App.css'; // Reuse existing styles

export default function PrivacyPolicy() {
  return (
    <div className="content-wrapper">
      <div className="glass-card" style={{ maxWidth: '800px', margin: '2rem auto', width: '100%' }}>
        <h1 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '2rem' }}>Privacy Policy</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Last Updated: April 14, 2026</p>
        
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <p style={{ marginBottom: '1.5rem' }}>
            At Pragati Bandhu, we value your privacy and are committed to protecting your shop's data. 
            This Privacy Policy explains how we collect, use, and protect your information.
          </p>

          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginTop: '2rem', marginBottom: '1rem' }}>1. Data We Collect</h2>
          <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}><strong>Shop Information:</strong> Shop name, owner name, category, and WhatsApp number.</li>
            <li style={{ marginBottom: '0.5rem' }}><strong>Inventory & Sales:</strong> Product details, stock levels, billing history, and sales patterns.</li>
            <li style={{ marginBottom: '0.5rem' }}><strong>Customer Data:</strong> Names, phone numbers, and credit (udhar) balances for your customers.</li>
          </ul>

          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginTop: '2rem', marginBottom: '1rem' }}>2. How We Use Your Data</h2>
          <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}><strong>Operations:</strong> To provide inventory management, billing, and udhar tracking services.</li>
            <li style={{ marginBottom: '0.5rem' }}><strong>Cloud Backup:</strong> If enabled, your data is synced to our secure servers to prevent data loss.</li>
            <li style={{ marginBottom: '0.5rem' }}><strong>AI Insights:</strong> To provide reorder suggestions. We only use anonymized sales patterns for this feature.</li>
            <li style={{ marginBottom: '0.5rem' }}><strong>Communication:</strong> To send OTPs and low-stock alerts via WhatsApp or SMS.</li>
          </ul>

          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginTop: '2rem', marginBottom: '1rem' }}>3. Data Privacy & AI</h2>
          <p style={{ marginBottom: '1rem' }}>
            We never share your personal information, shop location, or customer contact details with third parties for marketing purposes.
          </p>
          <p style={{ marginBottom: '1.5rem' }}>
            For AI-powered features, we send anonymized statistical patterns (e.g., "Product A sold 10 units") to secure AI services like Claude API. 
            No identifying names or phones are ever included in these requests.
          </p>

          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginTop: '2rem', marginBottom: '1rem' }}>4. Your Control</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            You have full control over your data sync options. You can choose to keep your data "This Phone Only" or enable "Cloud Backup" at any time in the settings.
          </p>

          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginTop: '2rem', marginBottom: '1rem' }}>5. Contact Us</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            If you have any questions about this Privacy Policy, please contact us at support@pragatibandhu.com or call 7003354703.
          </p>
        </div>
      </div>
    </div>
  );
}
