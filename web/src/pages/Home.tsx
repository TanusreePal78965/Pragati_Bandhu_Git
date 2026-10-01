import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Hero from '../components/landing/Hero';
import AppSection from '../components/landing/AppSection';
import Pricing from '../components/landing/Pricing';
import HowItWorks from '../components/landing/HowItWorks';
import Faq from '../components/landing/Faq';
import { SHOPAI, CHUKTA } from '../content/apps';
import '../landing.css';

export default function Home() {
  const location = useLocation();

  // Header links go to /#shopai and /#chukta. location.key changes on every click,
  // so a repeat click on the same link scrolls again.
  useEffect(() => {
    if (!location.hash) return;
    document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth' });
  }, [location.key, location.hash]);

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
