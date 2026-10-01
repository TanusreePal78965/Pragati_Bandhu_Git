import { Link } from 'react-router-dom';

export default function Faq() {
  return (
    <section className="lp-block">
      <h2>Questions</h2>
      <div className="lp-faq">
        <details>
          <summary>Do I need internet?</summary>
          <p>Chukta works fully offline and syncs later. ShopAI works offline; cloud backup needs internet.</p>
        </details>
        <details>
          <summary>How do I pay?</summary>
          <p>ShopAI: by UPI — scan the QR code on the <Link to="/renew">Renew page</Link>. Chukta: online renewal is coming soon; your 30-day free trial starts when you sign up.</p>
        </details>
        <details>
          <summary>What happens after the free trial?</summary>
          <p>The app asks you to renew. Renew by UPI to keep using it.</p>
        </details>
        <details>
          <summary>I forgot my password.</summary>
          <p><Link to="/forgot-password">Reset it here</Link>.</p>
        </details>
        <details>
          <summary>Is my data safe?</summary>
          <p>See our <Link to="/privacy">Privacy Policy</Link>.</p>
        </details>
      </div>
    </section>
  );
}
