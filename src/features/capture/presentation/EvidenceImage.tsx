import { useState } from 'react'
import { pieces } from './evidenceAssets'
import styles from './capture.module.css'

export function EvidenceImage({ label = 'IMG-005 · original.jpg', altText = 'Synthetic tea leaf evidence placeholder for OBS-005', zoom = 100, rotation = 0, thumbnail = false, onError }: { label?: string; altText?: string; zoom?: number; rotation?: number; thumbnail?: boolean; onError?: () => void }) {
  const [loaded, setLoaded] = useState(0)
  return <div className={styles.imageWindow}>
    <div className={`${styles.scene} ${thumbnail ? styles.thumbnailScene : ''}`} role="img" aria-label={altText} style={{ transform: `scale(${zoom / 100}) rotate(${rotation}deg)` }}>
      {pieces.map((piece) => <img key={piece.src} src={piece.src} className={piece.className} alt="" onLoad={() => setLoaded((count) => count + 1)} onError={onError} />)}
    </div>
    <span className={styles.chip}>{label}</span>
    {loaded < pieces.length && <span className={styles.imageLoading} role="status">Loading evidence…</span>}
  </div>
}

