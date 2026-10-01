import { Link } from 'react-router-dom';
import { ArrowRight } from 'lucide-react';
import type { AppInfo } from '../../content/apps';
import StoreBadge from './StoreBadge';

export default function AppSection({ app }: { app: AppInfo }) {
  return (
    <section id={app.id} className={`lp-section lp-theme-${app.id}`}>
      <div className="lp-section-head">
        <img src={app.icon} alt="" className="lp-app-icon" />
        <div>
          <h2>{app.name}</h2>
          <p className="lp-section-headline">{app.headline}</p>
        </div>
      </div>
      <div className="lp-feature-grid">
        {app.features.map(({ icon: Icon, title, text }) => (
          <div key={title} className="lp-feature">
            <div className="lp-feature-icon"><Icon size={22} /></div>
            <h3>{title}</h3>
            <p>{text}</p>
          </div>
        ))}
      </div>
      {app.featuresLink && (
        <Link to={app.featuresLink} className="lp-link">
          See all features <ArrowRight size={16} />
        </Link>
      )}
      <div className="lp-actions">
        <Link to={app.signupPath} className="lp-btn">{app.signupLabel}</Link>
        <StoreBadge playUrl={app.playUrl} />
      </div>
    </section>
  );
}
