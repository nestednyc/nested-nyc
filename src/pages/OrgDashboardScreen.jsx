import { useState, useEffect } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { orgService } from '../services/orgService'
import { authService } from '../lib/supabase'

/**
 * OrgDashboardScreen — admin-only view at /orgs/:slug/dashboard.
 * Member gate: if the viewer isn't an org_members row for this org,
 * we redirect to the public profile page.
 */
function OrgDashboardScreen() {
  const { slug } = useParams()
  const navigate = useNavigate()
  const [org, setOrg] = useState(null)
  const [events, setEvents] = useState([])
  const [members, setMembers] = useState([])
  const [loading, setLoading] = useState(true)
  const [authorized, setAuthorized] = useState(false)
  const [tab, setTab] = useState('upcoming')

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const { data: userRes } = await authService.getUser()
      if (cancelled) return
      if (!userRes?.user) {
        navigate('/auth', { replace: true })
        return
      }

      const { data: orgData } = await orgService.getBySlug(slug)
      if (cancelled) return
      if (!orgData) {
        setOrg(null)
        setLoading(false)
        return
      }
      setOrg(orgData)

      const isMember = await orgService.isMember(orgData.id)
      if (cancelled) return
      if (!isMember) {
        navigate(`/orgs/${slug}`, { replace: true })
        return
      }
      setAuthorized(true)

      const [{ data: orgEvents }, { data: orgMembers }] = await Promise.all([
        orgService.getOrgEvents(orgData.id),
        orgService.listMembers(orgData.id)
      ])
      if (cancelled) return
      setEvents(orgEvents || [])
      setMembers(orgMembers || [])
      setLoading(false)
    }
    load()
    return () => { cancelled = true }
  }, [slug, navigate])

  if (loading || !authorized) {
    return <CenteredMessage>Loading…</CenteredMessage>
  }

  if (!org) {
    return (
      <CenteredMessage>
        <h2 style={{ margin: 0, fontSize: '18px', color: '#111827' }}>Organization not found</h2>
        <button onClick={() => navigate('/events')} style={primaryButtonStyle}>Back</button>
      </CenteredMessage>
    )
  }

  const upcoming = events.filter(e => !e.is_past)
  const past = events.filter(e => e.is_past)
  const totalAttendees = events.reduce((acc, e) => acc + (e.attendees || 0), 0)
  const list = tab === 'upcoming' ? upcoming : past

  return (
    <div style={{ minHeight: '100%', backgroundColor: '#F9FAFB', paddingBottom: '40px' }}>
      {/* Top bar */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
        padding: '20px 20px 8px',
        backgroundColor: '#FFFFFF',
        borderBottom: '1px solid #E5E7EB'
      }}>
        <div style={{
          width: '40px',
          height: '40px',
          borderRadius: '10px',
          backgroundColor: '#F3F4F6',
          backgroundImage: org.logo ? `url(${org.logo})` : 'none',
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontWeight: 700,
          color: '#9CA3AF'
        }}>
          {!org.logo && (org.name?.charAt(0) || '?').toUpperCase()}
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: '15px', fontWeight: 700, color: '#111827' }}>{org.name}</div>
          <div style={{ fontSize: '12px', color: '#6B7280' }}>
            Dashboard{!org.verified && ' · Pending verification'}
          </div>
        </div>
        <button
          onClick={() => navigate(`/orgs/${org.slug}`)}
          style={ghostButtonStyle}
        >
          View public
        </button>
      </div>

      {!org.verified && (
        <div style={{
          margin: '12px 20px 0',
          padding: '12px 14px',
          backgroundColor: '#FEF3C7',
          border: '1px solid #FCD34D',
          borderRadius: '10px',
          fontSize: '13px',
          color: '#92400E'
        }}>
          Your org is live and can post events. We'll review it within a few days; once verified, a checkmark will appear next to your name.
        </div>
      )}

      {/* Stats */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, 1fr)',
        gap: '8px',
        padding: '16px 20px 0'
      }}>
        <StatCard label="Upcoming" value={upcoming.length} />
        <StatCard label="Past events" value={past.length} />
        <StatCard label="Total RSVPs" value={totalAttendees} />
      </div>

      {/* Primary action */}
      <div style={{ padding: '16px 20px 0' }}>
        <button
          onClick={() => navigate('/create-event')}
          style={{
            ...primaryButtonStyle,
            width: '100%',
            height: '48px',
            fontSize: '15px'
          }}
        >
          + Create event
        </button>
      </div>

      {/* Events */}
      <div style={{
        marginTop: '20px',
        backgroundColor: '#FFFFFF',
        borderTop: '1px solid #E5E7EB',
        borderBottom: '1px solid #E5E7EB'
      }}>
        <div style={{ display: 'flex', gap: '24px', padding: '0 20px', borderBottom: '1px solid #E5E7EB' }}>
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

        <div style={{ padding: '12px 20px' }}>
          {list.length === 0 && (
            <div style={{ padding: '24px 0', textAlign: 'center', fontSize: '14px', color: '#9CA3AF' }}>
              {tab === 'upcoming' ? 'No upcoming events yet. Create your first one above.' : 'No past events.'}
            </div>
          )}
          {list.map(event => (
            <button
              key={event.id}
              onClick={() => navigate(`/events/${event.id}`)}
              style={eventRowStyle}
            >
              <div style={{ flex: 1, minWidth: 0, textAlign: 'left' }}>
                <div style={{ fontSize: '14px', fontWeight: 600, color: '#111827' }}>{event.title}</div>
                <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>
                  {event.date}{event.time ? ` · ${event.time}` : ''}{event.location ? ` · ${event.location}` : ''}
                </div>
              </div>
              <div style={{ fontSize: '12px', color: '#6366F1', fontWeight: 500, whiteSpace: 'nowrap' }}>
                {event.attendees || 0} RSVPs
              </div>
            </button>
          ))}
        </div>
      </div>

      {/* Members */}
      <div style={{ padding: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between' }}>
          <h2 style={{ margin: 0, fontSize: '15px', fontWeight: 700, color: '#111827' }}>Team</h2>
          <span style={{ fontSize: '12px', color: '#9CA3AF' }}>{members.length} member{members.length === 1 ? '' : 's'}</span>
        </div>
        <div style={{ marginTop: '10px', display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {members.map(m => (
            <div key={m.profile?.id || Math.random()} style={memberRowStyle}>
              <div style={{
                width: '32px',
                height: '32px',
                borderRadius: '50%',
                backgroundColor: '#F3F4F6',
                backgroundImage: m.profile?.avatar ? `url(${m.profile.avatar})` : 'none',
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '13px',
                fontWeight: 600,
                color: '#6B7280'
              }}>
                {!m.profile?.avatar && (m.profile?.first_name?.charAt(0) || '?').toUpperCase()}
              </div>
              <div style={{ flex: 1, fontSize: '14px', color: '#111827' }}>
                {[m.profile?.first_name, m.profile?.last_name].filter(Boolean).join(' ') || 'Member'}
              </div>
              <div style={{
                fontSize: '11px',
                color: m.role === 'owner' ? '#4F46E5' : '#6B7280',
                fontWeight: 600,
                textTransform: 'uppercase',
                letterSpacing: '0.06em'
              }}>
                {m.role}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

function StatCard({ label, value }) {
  return (
    <div style={{
      padding: '14px 12px',
      backgroundColor: '#FFFFFF',
      border: '1px solid #E5E7EB',
      borderRadius: '12px',
      textAlign: 'center'
    }}>
      <div style={{ fontSize: '22px', fontWeight: 700, color: '#111827' }}>{value}</div>
      <div style={{ fontSize: '11px', color: '#6B7280', marginTop: '2px' }}>{label}</div>
    </div>
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
      textAlign: 'center',
      color: '#6B7280'
    }}>
      <div>{children}</div>
    </div>
  )
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

const ghostButtonStyle = {
  padding: '8px 12px',
  backgroundColor: '#F3F4F6',
  color: '#374151',
  fontSize: '12px',
  fontWeight: 600,
  borderRadius: '8px',
  border: 'none',
  cursor: 'pointer'
}

const eventRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  width: '100%',
  padding: '12px 0',
  backgroundColor: 'transparent',
  border: 'none',
  borderBottom: '1px solid #F3F4F6',
  cursor: 'pointer'
}

const memberRowStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '12px',
  padding: '8px 12px',
  backgroundColor: '#FFFFFF',
  border: '1px solid #E5E7EB',
  borderRadius: '10px'
}

export default OrgDashboardScreen
