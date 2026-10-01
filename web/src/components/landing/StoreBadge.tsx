import { Play } from 'lucide-react';

export default function StoreBadge({ playUrl }: { playUrl: string | null }) {
  if (!playUrl) {
    return (
      <span className="lp-store-badge lp-store-badge-soon">
        <Play size={22} />
        <span>
          <small>Coming soon on</small>
          <strong>Google Play</strong>
        </span>
      </span>
    );
  }
  return (
    <a href={playUrl} target="_blank" rel="noopener noreferrer" className="lp-store-badge">
      <Play size={22} fill="currentColor" />
      <span>
        <small>Get it on</small>
        <strong>Google Play</strong>
      </span>
    </a>
  );
}
