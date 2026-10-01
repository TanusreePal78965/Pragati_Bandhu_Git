import { Link } from 'react-router-dom';
import { APPS } from '../../content/apps';
import StoreBadge from './StoreBadge';

export default function Hero() {
  return (
    <section className="lp-hero">
      <h1>Simple apps for small businesses in India.</h1>
      <p className="lp-hero-sub">Run your shop and pay your workers right, from your Android phone.</p>
      <div className="lp-hero-cards">
        {APPS.map((app) => (
          <article key={app.id} className={`lp-app-card lp-theme-${app.id}`}>
            <div className="lp-app-card-head">
              <img src={app.icon} alt="" className="lp-app-icon" />
              <div>
                <h2>{app.name}</h2>
                <p>{app.pitch}</p>
              </div>
            </div>
            <div className="lp-app-card-body">
              <div className="lp-price">{app.priceSummary}</div>
              <div className="lp-actions">
                <Link to={app.signupPath} className="lp-btn">{app.signupLabel}</Link>
                <StoreBadge playUrl={app.playUrl} />
              </div>
            </div>
          </article>
        ))}
      </div>
      <p className="lp-trust">30-day free trial · No card needed</p>
    </section>
  );
}
