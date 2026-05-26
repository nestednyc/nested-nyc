import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'

/**
 * ContactSheet — bottom sheet (mobile) / centered modal (desktop) that lets a
 * viewer reach out to a profile owner via whatever channels they've linked.
 *
 * Always includes a "Message on Nested" row that deep-links to /chat?to=<userId>.
 * The in-app messaging backend is still mocked, so that row carries a "Coming
 * soon" subtitle — clicking it still navigates so the entry point exists for
 * when real messaging ships.
 *
 * External rows (LinkedIn / Instagram / X) open in a new tab. Discord copies
 * the handle to the clipboard and flashes a toast.
 *
 * Props:
 *   open      bool                  — controls visibility
 *   onClose   () => void            — backdrop / dismiss handler
 *   targetUserId string             — used for /chat?to= deeplink
 *   firstName string                — shown in the header ("Connect with X")
 *   links     {linkedin, discord, instagram, twitter, ...}
 */
function ContactSheet({ open, onClose, targetUserId, firstName, links = {} }) {
  const navigate = useNavigate()
  const [toast, setToast] = useState(null)
  const [isWide, setIsWide] = useState(typeof window !== 'undefined' && window.innerWidth >= 768)

  useEffect(() => {
    const onResize = () => setIsWide(window.innerWidth >= 768)
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  // Lock scroll while open
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null

  // Normalize a social handle/URL the same way ProfileViewScreen does.
  const buildUrl = (raw, base) => {
    if (!raw) return null
    const trimmed = String(raw).trim()
    if (!trimmed) return null
    if (trimmed.startsWith('http://') || trimmed.startsWith('https://')) return trimmed
    if (trimmed.startsWith('@')) return `${base}/${trimmed.slice(1)}`
    if (trimmed.includes('.')) return `https://${trimmed.replace(/^\/+/, '')}`
    return `${base}/${trimmed.replace(/^\/+/, '')}`
  }

  const copyHandle = async (handle) => {
    try {
      await navigator.clipboard.writeText(handle)
      setToast('Copied!')
    } catch {
      setToast('Could not copy')
    }
    setTimeout(() => setToast(null), 1800)
  }

  const handleNestedMessage = () => {
    onClose?.()
    if (targetUserId) navigate(`/chat/${encodeURIComponent(targetUserId)}`)
  }

  const channels = []

  channels.push({
    key: 'nested',
    label: 'Message on Nested',
    sub: 'Coming soon',
    onClick: handleNestedMessage,
    icon: (
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#6366F1" strokeWidth="2">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
      </svg>
    )
  })

  if (links.linkedin) {
    const url = buildUrl(links.linkedin, 'https://linkedin.com/in')
    channels.push({
      key: 'linkedin', label: 'LinkedIn', sub: url, href: url,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#0A66C2">
          <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
        </svg>
      )
    })
  }

  if (links.discord) {
    channels.push({
      key: 'discord', label: 'Discord', sub: links.discord,
      action: 'copy',
      onClick: () => copyHandle(links.discord),
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#5865F2">
          <path d="M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z"/>
        </svg>
      )
    })
  }

  if (links.instagram) {
    const url = buildUrl(links.instagram, 'https://instagram.com')
    channels.push({
      key: 'instagram', label: 'Instagram', sub: url, href: url,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#E1306C" strokeWidth="2">
          <rect x="2" y="2" width="20" height="20" rx="5" ry="5"/>
          <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/>
          <line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/>
        </svg>
      )
    })
  }

  if (links.twitter) {
    const url = buildUrl(links.twitter, 'https://x.com')
    channels.push({
      key: 'twitter', label: 'X / Twitter', sub: url, href: url,
      icon: (
        <svg width="20" height="20" viewBox="0 0 24 24" fill="#111827">
          <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z"/>
        </svg>
      )
    })
  }

  const hasOnlyNested = channels.length === 1
  const displayName = firstName || 'this user'

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed', inset: 0, zIndex: 1000,
        backgroundColor: 'rgba(17, 24, 39, 0.5)',
        display: 'flex',
        alignItems: isWide ? 'center' : 'flex-end',
        justifyContent: 'center',
        padding: isWide ? '24px' : '0',
        animation: 'contactSheetFadeIn 0.18s ease-out'
      }}
    >
      <style>{`
        @keyframes contactSheetFadeIn { from { opacity: 0; } to { opacity: 1; } }
        @keyframes contactSheetSlideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
      `}</style>
      <div
        onClick={e => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: '440px',
          backgroundColor: 'white',
          borderRadius: isWide ? '16px' : '20px 20px 0 0',
          padding: '8px 0 16px',
          boxShadow: '0 -4px 24px rgba(0,0,0,0.1)',
          animation: isWide ? 'none' : 'contactSheetSlideUp 0.25s ease-out',
          maxHeight: '85vh',
          display: 'flex',
          flexDirection: 'column'
        }}
      >
        {/* Grabber bar (mobile only, decorative) */}
        {!isWide && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '6px 0' }}>
            <div style={{ width: '36px', height: '4px', borderRadius: '2px', backgroundColor: '#D1D5DB' }} />
          </div>
        )}

        <div style={{ padding: '12px 20px 8px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <h3 style={{ margin: 0, fontSize: '17px', fontWeight: 700, color: '#111827' }}>
            Connect with {displayName}
          </h3>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            style={{
              width: '28px', height: '28px', borderRadius: '50%',
              border: 'none', backgroundColor: '#F3F4F6',
              cursor: 'pointer', display: 'flex', alignItems: 'center',
              justifyContent: 'center', padding: 0, color: '#6B7280', fontSize: '16px'
            }}
          >×</button>
        </div>

        {hasOnlyNested && (
          <p style={{
            margin: '0 20px 8px', fontSize: '13px', color: '#6B7280', lineHeight: 1.4
          }}>
            {displayName} hasn't added external social links yet.
          </p>
        )}

        <div style={{ overflowY: 'auto', padding: '4px 12px 4px' }}>
          {channels.map((ch, idx) => {
            const body = (
              <>
                <div style={{
                  width: '40px', height: '40px', borderRadius: '10px',
                  backgroundColor: '#F9FAFB', display: 'flex', alignItems: 'center',
                  justifyContent: 'center', flexShrink: 0
                }}>
                  {ch.icon}
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{ch.label}</div>
                  {ch.sub && (
                    <div style={{
                      fontSize: '12px', color: '#6B7280',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis'
                    }}>{ch.sub}</div>
                  )}
                </div>
                <div style={{ color: '#9CA3AF', flexShrink: 0 }}>
                  {ch.action === 'copy' ? (
                    <span style={{ fontSize: '12px', fontWeight: 600, color: '#6366F1' }}>Copy</span>
                  ) : ch.href ? (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M7 17l9.2-9.2M17 17V7H7"/>
                    </svg>
                  ) : (
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M9 18l6-6-6-6"/>
                    </svg>
                  )}
                </div>
              </>
            )

            const rowStyle = {
              display: 'flex', alignItems: 'center', gap: '12px',
              padding: '12px 8px', borderRadius: '10px', cursor: 'pointer',
              textDecoration: 'none', color: 'inherit',
              transition: 'background-color 0.15s ease',
              border: 'none', background: 'transparent', width: '100%', textAlign: 'left'
            }

            if (ch.href) {
              return (
                <a
                  key={ch.key}
                  href={ch.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => onClose?.()}
                  style={rowStyle}
                  onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                  onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
                >
                  {body}
                </a>
              )
            }

            return (
              <button
                key={ch.key}
                type="button"
                onClick={ch.onClick}
                style={rowStyle}
                onMouseEnter={(e) => e.currentTarget.style.backgroundColor = '#F9FAFB'}
                onMouseLeave={(e) => e.currentTarget.style.backgroundColor = 'transparent'}
              >
                {body}
              </button>
            )
          })}
        </div>

        {toast && (
          <div style={{
            position: 'fixed',
            bottom: isWide ? '24px' : '90px',
            left: '50%', transform: 'translateX(-50%)',
            backgroundColor: '#111827', color: 'white',
            padding: '10px 16px', borderRadius: '999px',
            fontSize: '13px', fontWeight: 500,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            zIndex: 1001
          }}>
            {toast}
          </div>
        )}
      </div>
    </div>
  )
}

export default ContactSheet
