import { Link } from 'react-router-dom';
import { Check } from 'lucide-react';
import { APPS } from '../../content/apps';

export default function Pricing() {
  return (
    <section className="lp-block">
      <h2>Simple pricing</h2>
      <div className="lp-pricing-grid">
        {APPS.map((app) => (
          <article key={app.id} className={`lp-plan-card lp-theme-${app.id}`}>
            <h3>{app.name}</h3>
            <div className="lp-plan-rows">
              {app.plans.map((plan) => (
                <div key={plan.period} className="lp-plan-row">
                  <span className="lp-plan-price">{plan.price}</span>
                  <span className="lp-plan-period">{plan.period}</span>
                  {plan.badge && <span className="lp-plan-badge">{plan.badge}</span>}
                </div>
              ))}
            </div>
            <ul className="lp-checks">
              {app.included.map((item) => (
                <li key={item}>
                  <Check size={18} />
                  {item}
                </li>
              ))}
            </ul>
            <div className="lp-actions">
              <Link to={app.signupPath} className="lp-btn">{app.signupLabel}</Link>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}
