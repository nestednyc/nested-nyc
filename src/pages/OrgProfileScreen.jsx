import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { orgService } from '../services/orgService'
import { getCurrentUserId } from '../utils/authHelpers'
import PublicTopBar from '../components/PublicTopBar'

/**
 * OrgProfileScreen — public org page at /orgs/:slug.
 * Shows logo, bio, links, verification badge, and event feed.
 * If the viewer is a member, surfaces Edit / Dashboard actions.
 */
function OrgProfileScreen() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [org, setOrg] = useState(null)
  const [events, setEvents] = useState([])
  const [parentUni, setParentUni] = useState(null)
  const [isMember, setIsMember] = useState(false)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState('upcoming')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: orgData } = await orgService.getBySlug(slug)
      if (cancelled) return
      if (!orgData) {
        setOrg(null)
        setLoading(false)
        return
      }
      setOrg(orgData)

      const [{ data: orgEvents }, viewerId, parent] = await Promise.all([
        orgService.getOrgEvents(orgData.id),
        getCurrentUserId(),
        orgData.university_id ? orgService.getById(orgData.university_id) : Promise.resolve({ data: null })
      ])
      if (cancelled) return
      setEvents(orgEvents || [])
      setParentUni(parent?.data || null)

      if (viewerId) {
        const member = await orgService.isMember(orgData.id)
        if (!cancelled) setIsMember(member)
      }
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [slug])

  if (loading) {
    return <CenteredMessage>Loading…</CenteredMessage>
  }

  if (!org) {
    return (
      <CenteredMessage>
        <h2 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>Organization not found</h2>
        <p style={{ marginTop: '6px', fontSize: '14px', color: '#6B7280' }}>
          The link might be broken or the org no longer exists.
        </p>
        <button onClick={() => navigate('/events')} style={primaryButtonStyle}>
          Back to events
        </button>
      </CenteredMessage>
    )
  }

  const upcoming = events.filter(e => !e.is_past)
  const past = events.filter(e => e.is_past)
  const list = tab === 'upcoming' ? upcoming : past
  const cleanedInstagram = org.instagram ? org.instagram.replace(/^@/, '') : null
  const typeLabel = {
    university: 'University',
    club: 'Student org',
    other: 'Organization'
  }[org.type] || 'Organization'

  return (
    <div style={{ minHeight: '100%', backgroundColor: '#FFFFFF', paddingBottom: '40px' }}>
      <PublicTopBar />
      {/* Banner */}
      <div style={{
        height: '140px',
        background: org.banner
          ? `url(${org.banner}) center/cover`
          : 'linear-gradient(135deg, #6366F1 0%, #8B7CF6 60%, #C7B8FF 100%)',
        position: 'relative'
      }}>
        <button
          onClick={() => navigate(-1)}
          style={backButtonStyle}
          aria-label="Back"
        >
          <svg width="10" height="16" viewBox="0 0 12 20" fill="none">
            <path d="M10 2L2 10L10 18" stroke="#374151" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
      </div>

      {/* Identity row */}
      <div style={{ padding: '0 20px', marginTop: '-40px', position: 'relative' }}>
        <div style={{
          width: '88px',
          height: '88px',
          borderRadius: '20px',
          backgroundColor: '#F3F4F6',
          border: '4px solid #FFFFFF',
          backgroundImage: org.logo ? `url(${org.logo})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontSize: '32px',
          fontWeight: 700,
          color: '#9CA3AF'
        }}>
          {!org.logo && (org.name?.charAt(0) || '?').toUpperCase()}
        </div>

        <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
          <h1 style={{ margin: 0, fontSize: '22px', fontWeight: 700, color: '#111827' }}>
            {org.name}
          </h1>
          {org.verified ? <VerifiedBadge /> : <PendingBadge />}
        </div>

        <p style={{ margin: '4px 0 0', fontSize: '13px', color: '#6B7280' }}>
          {typeLabel}
          {parentUni && <> · at {parentUni.name}</>}
          {org.location && <> · {org.location}</>}
        </p>

        {org.bio && (
          <p style={{ margin: '14px 0 0', fontSize: '14px', color: '#374151', lineHeight: 1.55 }}>
            {org.bio}
          </p>
        )}

        {/* Links */}
        {(org.website || cleanedInstagram) && (
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginTop: '14px' }}>
            {org.website && (
              <a
                href={org.website.startsWith('http') ? org.website : `https://${org.website}`}
                target="_blank"
                rel="noopener noreferrer"
                style={linkChipStyle}
              >
                🌐 Website
              </a>
            )}
            {cleanedInstagram && (
              <a
                href={`https://instagram.com/${cleanedInstagram}`}
                target="_blank"
                rel="noopener noreferrer"
                style={linkChipStyle}
              >
                📷 @{cleanedInstagram}
              </a>
            )}
          </div>
        )}

        {/* Member actions */}
        {isMember && (
          <div style={{ display: 'flex', gap: '8px', marginTop: '18px' }}>
            <button
              onClick={() => navigate(`/orgs/${org.slug}/dashboard`)}
              style={primaryButtonStyle}
            >
              Dashboard
            </button>
            <button
              onClick={() => navigate(`/orgs/${org.slug}/edit`)}
              style={secondaryButtonStyle}
            >
              Edit
            </button>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div style={{
        display: 'flex',
        marginTop: '24px',
        padding: '0 20px',
        borderBottom: '1px solid #E5E7EB',
        gap: '24px'
      }}>
        {[
          { id: 'upcoming', label: `Upcoming (${upcoming.length})` },
          { id: 'past', label: `Past (${past.length})` }
        ].map(t => (
          <button
            key={t.id}
            onClick={() => setTab(t.id)}
            style={{
              padding: '12px 0',
              backgroundColor: 'transparent',
              border: 'none',
              borderBottom: tab === t.id ? '2px solid #6366F1' : '2px solid transparent',
              cursor: 'pointer',
              fontSize: '14px',
              fontWeight: 600,
              color: tab === t.id ? '#6366F1' : '#9CA3AF'
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* Event list */}
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        {list.length === 0 && (
          <div style={{ textAlign: 'center', padding: '32px 0', color: '#9CA3AF', fontSize: '14px' }}>
            {tab === 'upcoming' ? 'No upcoming events yet.' : 'No past events.'}
          </div>
        )}
        {list.map(event => (
          <button
            key={event.id}
            onClick={() => navigate(`/events/${event.id}`)}
            style={eventCardStyle}
          >
            <div style={{ fontSize: '14px', fontWeight: 700, color: '#111827' }}>
              {event.title}
            </div>
            <div style={{ fontSize: '12px', color: '#6366F1', marginTop: '4px', fontWeight: 500 }}>
              {event.date}{event.time ? ` · ${event.time}` : ''}
            </div>
            {event.location && (
              <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                {event.location}
              </div>
            )}
          </button>
        ))}
      </div>
    </div>
  )
}

function VerifiedBadge() {
  return (
    <span
      title="Verified organization"
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: '4px',
        padding: '3px 8px',
        backgroundColor: '#EEF2FF',
        color: '#4F46E5',
        fontSize: '11px',
        fontWeight: 600,
        borderRadius: '9999px'
      }}
    >
      <svg width="11" height="11" viewBox="0 0 24 24" fill="#4F46E5">
        <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z" />
      </svg>
      Verified
    </span>
  )
}

function PendingBadge() {
  return (
    <span
      title="This org is pending verification by the Nested team"
      style={{
        padding: '3px 8px',
        backgroundColor: '#FEF3C7',
        color: '#92400E',
        fontSize: '11px',
        fontWeight: 600,
        borderRadius: '9999px'
      }}
    >
      Pending verification
    </span>
  )
}

function CenteredMessage({ children }) {
  return (
    <div style={{
      minHeight: '100%',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      padding: '40px 24px',
      textAlign: 'center'
    }}>
      <div>{children}</div>
    </div>
  )
}

const backButtonStyle = {
  position: 'absolute',
  top: '16px',
  left: '16px',
  width: '36px',
  height: '36px',
  borderRadius: '10px',
  border: 'none',
  backgroundColor: 'rgba(255, 255, 255, 0.95)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer'
}

const linkChipStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '4px',
  padding: '6px 12px',
  backgroundColor: '#F3F4F6',
  color: '#374151',
  fontSize: '12px',
  fontWeight: 500,
  borderRadius: '9999px',
  textDecoration: 'none'
}

const primaryButtonStyle = {
  padding: '10px 18px',
  backgroundColor: '#6366F1',
  color: 'white',
  fontSize: '14px',
  fontWeight: 600,
  borderRadius: '10px',
  border: 'none',
  cursor: 'pointer'
}

const secondaryButtonStyle = {
  padding: '10px 18px',
  backgroundColor: '#F3F4F6',
  color: '#374151',
  fontSize: '14px',
  fontWeight: 600,
  borderRadius: '10px',
  border: 'none',
  cursor: 'pointer'
}

const eventCardStyle = {
  display: 'block',
  width: '100%',
  textAlign: 'left',
  padding: '14px 16px',
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '10px',
  cursor: 'pointer'
}

export default OrgProfileScreen
