import { useEffect, useState } from 'react';
import { tr } from '../i18n';

// Preview clips per pack. Packs without a clip just show the item list.
const PREVIEW_VIDEOS = {
  dvoih: '/premium-preview/for-two-pack-preview.mp4',
  more: '/premium-preview/sea-pack-preview.mp4',
};

export default function PremiumPreview({ pack, onOpenFree, onClose }) {
  const items = tr('pack_' + pack + '_items').split('|');
  const video = PREVIEW_VIDEOS[pack];
  const [videoReady, setVideoReady] = useState(false);

  useEffect(() => {
    setVideoReady(false);
  }, [video]);

  return (
    <div className="overlay" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div className="modal premium-modal premium-preview">
        <div className="premium-badge">✨ {tr('premium_preview_badge')}</div>
        <h2>{tr('premium_preview_title')}</h2>
        <p className="sub">{tr('premium_preview_desc')}</p>

        {video && (
          <div className={`premium-preview-media ${videoReady ? 'ready' : ''}`}>
            {!videoReady && (
              <div className="premium-preview-loader">
                <span className="premium-preview-loader-icon">✨</span>
                <span>{tr('premium_preview_loading')}</span>
              </div>
            )}
            <video
              className="premium-preview-video"
              src={video}
              autoPlay
              muted
              loop
              playsInline
              preload="auto"
              onLoadedData={() => setVideoReady(true)}
              onCanPlay={() => setVideoReady(true)}
              aria-label={tr('premium_preview_title')}
            />
          </div>
        )}

        <p className="premium-preview-note">{tr('premium_preview_note')}</p>

        <ul className="premium-list">
          {items.map((it, i) => <li key={i}>{it}</li>)}
        </ul>

        <button className="btn btn-primary" onClick={onOpenFree}>{tr('premium_open_free')}</button>
        <button className="link-btn" style={{ marginTop: 12, display: 'block' }} onClick={onClose}>
          {tr('close')}
        </button>
      </div>
    </div>
  );
}
