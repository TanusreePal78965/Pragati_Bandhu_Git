import '../App.css';

export default function TermsOfService() {
  return (
    <div className="content-wrapper">
      <div className="glass-card" style={{ maxWidth: '800px', margin: '2rem auto', width: '100%' }}>
        <h1 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '2rem' }}>Terms of Service</h1>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '2rem' }}>Last Updated: April 14, 2026</p>
        
        <div style={{ color: 'var(--text-secondary)', lineHeight: 1.6 }}>
          <p style={{ marginBottom: '1.5rem' }}>
            By using the Pragati Bandhu app, you agree to the following terms and conditions. 
            Please read them carefully before using our services.
          </p>

          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginTop: '2rem', marginBottom: '1rem' }}>1. Nature of Service</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            Pragati Bandhu is a shop management tool designed to help retail business owners track inventory, 
            manage billing, and monitor customer credits (udhar). The service is provided "as is".
          </p>

          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginTop: '2rem', marginBottom: '1rem' }}>2. Account & Eligibility</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            To use the app, you must be a business owner or authorized representative. 
            You are responsible for maintaining the confidentiality of your account access (OTP-based). 
          </p>

          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginTop: '2rem', marginBottom: '1rem' }}>3. Subscription & Payments</h2>
          <ul style={{ listStyleType: 'disc', paddingLeft: '1.5rem', marginBottom: '1.5rem' }}>
            <li style={{ marginBottom: '0.5rem' }}><strong>Service Plans:</strong> We offer Basic and Standard plans with different periodic fees.</li>
            <li style={{ marginBottom: '0.5rem' }}><strong>Setup Fee:</strong> A one-time on-site setup fee may apply during onboarding.</li>
            <li style={{ marginBottom: '0.5rem' }}><strong>Refunds:</strong> Subscription fees are generally non-refundable unless stated otherwise.</li>
          </ul>

          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginTop: '2rem', marginBottom: '1rem' }}>4. Data Ownership</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            You retain full ownership of the data you enter into the system (products, sales, customers). 
            By enabling cloud sync, you grant us permission to store and move this data on your behalf to provide the service.
          </p>

          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginTop: '2rem', marginBottom: '1rem' }}>5. Usage Restrictions</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            You agree not to use the app for any illegal activities or to store data that violates local laws. 
            We reserve the right to deactivate accounts discovered to be involved in fraudulent activities.
          </p>

          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginTop: '2rem', marginBottom: '1rem' }}>6. Limitation of Liability</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            While we strive for 100% accuracy, Pragati Bandhu is not liable for business losses, data loss (for offline users), 
            or errors in AI suggestions. It is recommended to verify all AI-generated reorder suggestions before placing orders.
          </p>

          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)', marginTop: '2rem', marginBottom: '1rem' }}>7. Changes to Terms</h2>
          <p style={{ marginBottom: '1.5rem' }}>
            We may update these terms from time to time. Continued use of the app after such changes constitutes acceptance of the new terms.
          </p>
        </div>
      </div>
    </div>
  );
}
