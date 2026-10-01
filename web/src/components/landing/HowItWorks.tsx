import { LogIn, Smartphone, UserPlus } from 'lucide-react';

const STEPS = [
  { icon: UserPlus, title: 'Sign up here', text: 'Use your mobile number. We send you an OTP.' },
  { icon: Smartphone, title: 'Install the app', text: 'On your Android phone.' },
  { icon: LogIn, title: 'Log in', text: 'With your mobile number and password.' },
];

export default function HowItWorks() {
  return (
    <section className="lp-block">
      <h2>How it works</h2>
      <ol className="lp-steps">
        {STEPS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="lp-step">
            <div className="lp-step-num"><Icon size={22} /></div>
            <h3>{title}</h3>
            <p>{text}</p>
          </li>
        ))}
      </ol>
      <p className="lp-note">Already use one app? Use the same mobile number to sign up for the other.</p>
    </section>
  );
}
