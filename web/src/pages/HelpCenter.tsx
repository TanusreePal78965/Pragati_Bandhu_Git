import '../App.css';

const FAQ_ITEMS = [
  {
    question: "What items are synced to the cloud?",
    answer: "If you have enabled Cloud Backup, your products, categories, brands, customers, bills, and sales history are securely backed up. Basic shop info is always synced for account recovery."
  },
  {
    question: "Does the app work without internet?",
    answer: "Yes! Pragati Bandhu is offline-first. You can create bills, manage stock, and add customers without internet. Data will sync automatically once you're back online (if cloud backup is on)."
  },
  {
    question: "What is AI Reorder Suggestion?",
    answer: "Our AI analyzes your sales patterns to predict when you'll run out of stock and suggests how much to reorder. It helps you avoid losing sales and prevents over-ordering."
  },
  {
    question: "Is my customer data shared with anyone?",
    answer: "No. Your privacy is our priority. Customer names and phone numbers are never shared with third parties. AI suggestions use anonymized sales data only."
  }
];

export default function HelpCenter() {
  return (
    <div className="content-wrapper">
      <div className="glass-card" style={{ maxWidth: '800px', margin: '2rem auto', width: '100%' }}>
        <h1 style={{ color: 'var(--text-main)', marginBottom: '1.5rem', fontSize: '2rem', textAlign: 'center' }}>Help Center</h1>
        
        <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', marginBottom: '2.5rem' }}>
          <a href="tel:7003354703" style={{ padding: '0.75rem 1.5rem', backgroundColor: 'var(--primary-color)', color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '600' }}>Call Support</a>
          <a href="whatsapp://send?phone=917003354703&text=Hi%20Pragati%20Bandhu%20Support,%20I%20need%20help%20with..." style={{ padding: '0.75rem 1.5rem', backgroundColor: '#25D366', color: 'white', textDecoration: 'none', borderRadius: '8px', fontWeight: '600' }}>WhatsApp Support</a>
        </div>

        <h2 style={{ fontSize: '1.5rem', color: 'var(--text-main)', marginBottom: '1.5rem' }}>Frequently Asked Questions</h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {FAQ_ITEMS.map((item, index) => (
            <div key={index} style={{ padding: '1.5rem', backgroundColor: 'rgba(255,255,255,0.5)', borderRadius: '12px', border: '1px solid var(--border-color)' }}>
              <h3 style={{ fontSize: '1.1rem', color: 'var(--text-main)', marginBottom: '0.5rem', fontWeight: '600' }}>{item.question}</h3>
              <p style={{ color: 'var(--text-secondary)', lineHeight: 1.5 }}>{item.answer}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
