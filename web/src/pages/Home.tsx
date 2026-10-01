import Hero from '../components/landing/Hero';
import AppSection from '../components/landing/AppSection';
import Pricing from '../components/landing/Pricing';
import HowItWorks from '../components/landing/HowItWorks';
import Faq from '../components/landing/Faq';
import { SHOPAI, CHUKTA } from '../content/apps';
import '../landing.css';

export default function Home() {
  return (
    <div className="lp-home">
      <Hero />
      <AppSection app={SHOPAI} />
      <AppSection app={CHUKTA} />
      <Pricing />
      <HowItWorks />
      <Faq />
    </div>
  );
}
