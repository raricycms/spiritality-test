import { useEffect, useState } from 'react'
import { useI18n } from '../i18n/I18n.jsx'
import { Icon } from './Icon.jsx'

export function OpeningAnimation({ enabled }) {
  const { t } = useI18n()
  const [visible, setVisible] = useState(() => enabled && !window.matchMedia('(prefers-reduced-motion: reduce)').matches)
  useEffect(() => {
    if (!enabled) { setVisible(false); return }
    if (!visible) return
    const timeout = setTimeout(() => setVisible(false), 1400)
    const dismiss = () => setVisible(false)
    window.addEventListener('keydown', dismiss, { once: true })
    return () => { clearTimeout(timeout); window.removeEventListener('keydown', dismiss) }
  }, [visible, enabled])
  if (!visible) return null
  return (
    <div className="opening" aria-hidden="true" data-testid="opening-animation" onPointerDown={() => setVisible(false)}>
      <div className="opening-symbol" aria-hidden="true">
        <span className="opening-orbit orbit-one" />
        <span className="opening-orbit orbit-two" />
        <Icon name="orbit" />
      </div>
      <span className="opening-name">{t('灵性实验室')}</span>
      <span className="opening-caption">{t('从好奇开始，让体验成为观察。')}</span>
    </div>
  )
}
