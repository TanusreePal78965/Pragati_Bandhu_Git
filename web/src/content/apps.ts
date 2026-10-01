import type { LucideIcon } from 'lucide-react';
import {
  BarChart2,
  BellRing,
  BookOpen,
  Building2,
  Calculator,
  CalendarCheck,
  HandCoins,
  KeyRound,
  Languages,
  Package,
  ReceiptText,
  Sparkles,
  WifiOff,
} from 'lucide-react';
import shopaiIcon from '../assets/icon.png';
import chuktaIcon from '../assets/chukta-icon.png';

export type AppId = 'shopai' | 'chukta';

export interface AppFeature {
  icon: LucideIcon;
  title: string;
  text: string;
}

export interface AppPlan {
  price: string;
  period: string;
  badge: string | null;
}

export interface AppInfo {
  /** Also the section anchor (#shopai, #chukta) and the lp-theme-<id> CSS class. */
  id: AppId;
  name: string;
  icon: string;
  /** One line on the hero card. */
  pitch: string;
  /** Headline of the app's section. */
  headline: string;
  priceSummary: string;
  plans: AppPlan[];
  signupPath: string;
  signupLabel: string;
  /** null shows "Coming soon on Google Play". Set the store URL here when the app goes live. */
  playUrl: string | null;
  featuresLink: string | null;
  features: AppFeature[];
}

export const SHOPAI: AppInfo = {
  id: 'shopai',
  name: 'ShopAI',
  icon: shopaiIcon,
  pitch: 'Billing, stock and udhar for your shop.',
  headline: 'Stock khatam hone se pehle, ShopAI bata dega.',
  priceSummary: '₹99/month · ₹999/year',
  plans: [
    { price: '₹99', period: '/month', badge: null },
    { price: '₹999', period: '/year', badge: 'Save ₹189' },
  ],
  signupPath: '/shopai',
  signupLabel: 'Register ShopAI',
  playUrl: 'https://play.google.com/store/apps/details?id=com.pragatibandhu.app',
  featuresLink: '/features',
  features: [
    { icon: ReceiptText, title: 'Billing', text: 'Cash or udhar bills in seconds.' },
    { icon: Package, title: 'Inventory', text: 'Stock goes down automatically with every bill.' },
    { icon: BellRing, title: 'Low-stock alerts', text: 'Know before you run out.' },
    { icon: BookOpen, title: 'Udhar tracking', text: "Every customer's balance in one place." },
    { icon: BarChart2, title: 'Reports', text: "Today's sales, top products, profit." },
    { icon: Sparkles, title: 'AI reorder & WhatsApp alerts', text: 'Suggestions on what to reorder, sent where you already are.' },
  ],
};

export const CHUKTA: AppInfo = {
  id: 'chukta',
  name: 'Chukta',
  icon: chuktaIcon,
  pitch: 'Attendance, wages and advances for your workers.',
  headline: 'Your worker wage diary. No more notebook maths.',
  priceSummary: '₹199/year',
  plans: [{ price: '₹199', period: '/year', badge: null }],
  signupPath: '/chukta',
  signupLabel: 'Sign up for Chukta',
  playUrl: null,
  featuresLink: null,
  features: [
    { icon: CalendarCheck, title: 'Daily attendance', text: 'Present, half day, absent, or hours worked.' },
    { icon: Calculator, title: 'Automatic wages', text: 'With a plain-words breakdown like "4.5 days × ₹500".' },
    { icon: HandCoins, title: 'Advances and deductions', text: 'Always know what is still outstanding.' },
    { icon: Building2, title: 'Multiple sites', text: 'Keep workers for each property separate.' },
    { icon: KeyRound, title: 'Staff logins', text: 'Let a supervisor mark attendance with a PIN.' },
    { icon: WifiOff, title: 'Works offline', text: 'Syncs when you are back online.' },
    { icon: Languages, title: 'Your language', text: 'English, Hindi and Bengali.' },
  ],
};

export const APPS: AppInfo[] = [SHOPAI, CHUKTA];
