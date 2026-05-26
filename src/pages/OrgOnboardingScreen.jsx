import { useState, useEffect, useMemo, useRef } from 'react'
import { useNavigate } from 'react-router-dom'
import { orgService, slugify } from '../services/orgService'
import { storageService } from '../services/storageService'
import { authService } from '../lib/supabase'

/**
 * OrgOnboardingScreen — 2-step setup for new org admins.
 * Step 1: Identity (name, slug, type, parent university)
 * Step 2: Branding (logo, bio, links)
 */
function OrgOnboardingScreen() {
  const navigate = useNavigate()
  const [step, setStep] = useState(1)
  const [authChecked, setAuthChecked] = useState(false)
  const [form, setForm] = useState({
    name: '',
    slug: '',
    type: 'club',
    universityId: '',
    logoFile: null,
    logoPreview: null,
    bio: '',
    website: '',
    instagram: ''
  })
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugStatus, setSlugStatus] = useState({ checking: false, available: null, reason: null })
  const [universities, setUniversities] = useState([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState(null)
  const logoInputRef = useRef(null)

  // Redirect away if not signed in, or if they already have an org.
  useEffect(() => {
    let cancelled = false
    async function check() {
      const { data: userRes } = await authService.getUser()
      if (cancelled) return
      if (!userRes?.user) {
        navigate('/auth')
        return
      }
      const { data: myOrgs } = await orgService.getMyOrgs()
      if (cancelled) return
      if (myOrgs && myOrgs.length > 0) {
        navigate(`/orgs/${myOrgs[0].slug}/dashboard`, { replace: true })
        return
      }
      setAuthChecked(true)
    }
    check()
    return () => { cancelled = true }
  }, [navigate])

  // Load seeded universities for the parent-org dropdown.
  useEffect(() => {
    orgService.listUniversities().then(({ data }) => setUniversities(data || []))
  }, [])

  // Auto-suggest slug from name (until user manually edits the slug).
  useEffect(() => {
    if (slugTouched) return
    setForm(prev => ({ ...prev, slug: slugify(prev.name) }))
  }, [form.name, slugTouched])

  // Debounced slug availability check.
  useEffect(() => {
    if (!form.slug) {
      setSlugStatus({ checking: false, available: null, reason: null })
      return
    }
    setSlugStatus(s => ({ ...s, checking: true }))
    const handle = setTimeout(async () => {
      const result = await orgService.isSlugAvailable(form.slug)
      setSlugStatus({ checking: false, available: result.available, reason: result.reason })
    }, 350)
    return () => clearTimeout(handle)
  }, [form.slug])

  const handleField = (field, value) => {
    setForm(prev => ({ ...prev, [field]: value }))
    if (field === 'slug') setSlugTouched(true)
  }

  const handleLogo = (file) => {
    if (!file) return
    if (!['image/jpeg', 'image/png', 'image/gif', 'image/webp'].includes(file.type)) {
      setSubmitError('Logo must be JPG, PNG, GIF, or WebP.')
      return
    }
    if (file.size > 5 * 1024 * 1024) {
      setSubmitError('Logo must be under 5MB.')
      return
    }
    setSubmitError(null)
    const reader = new FileReader()
    reader.onload = (e) => setForm(prev => ({ ...prev, logoFile: file, logoPreview: e.target.result }))
    reader.readAsDataURL(file)
  }

  const step1Valid = useMemo(() => {
    if (!form.name || form.name.trim().length < 2) return false
    if (!slugStatus.available) return false
    if (form.type === 'club' && !form.universityId) {
      // Affiliated university is optional; still allow.
    }
    return true
  }, [form, slugStatus.available])

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setSubmitError(null)
    try {
      let logoUrl = null
      if (form.logoFile) {
        // Use the slug as a temp key for the storage path before we have an org id.
        const { url, error: uploadError } = await storageService.uploadOrgLogo(form.slug, form.logoFile)
        if (uploadError) {
          setSubmitError(`Logo upload failed: ${uploadError.message || 'unknown error'}`)
          setIsSubmitting(false)
          return
        }
        logoUrl = url
      }

      const { data: org, error } = await orgService.createOrg({
        name: form.name.trim(),
        slug: form.slug,
        type: form.type,
        university_id: form.type === 'club' && form.universityId ? form.universityId : null,
        logo: logoUrl,
        bio: form.bio.trim() || null,
        website: form.website.trim() || null,
        instagram: form.instagram.replace(/^@/, '').trim() || null
      })

      if (error || !org) {
        setSubmitError(error?.message || 'Failed to create organization.')
        setIsSubmitting(false)
        return
      }

      navigate(`/orgs/${org.slug}/dashboard`, { replace: true })
    } catch (err) {
      setSubmitError(err.message || 'Something went wrong.')
      setIsSubmitting(false)
    }
  }

  if (!authChecked) {
    return (
      <ScreenShell>
        <div style={{ padding: '40px 0', textAlign: 'center', color: '#6B7280' }}>Loading…</div>
      </ScreenShell>
    )
  }

  return (
    <ScreenShell>
      <Header step={step} />

      {step === 1 && (
        <div>
          <Field label="Organization name">
            <input
              type="text"
              value={form.name}
              onChange={e => handleField('name', e.target.value)}
              placeholder="e.g. NYU AI Club"
              style={inputStyle(false)}
              maxLength={80}
            />
          </Field>

          <Field
            label="URL slug"
            hint={form.slug ? `nested.app/orgs/${form.slug}` : 'nested.app/orgs/your-slug'}
          >
            <input
              type="text"
              value={form.slug}
              onChange={e => handleField('slug', e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, ''))}
              placeholder="nyu-ai-club"
              style={inputStyle(
                slugTouched && slugStatus.available === false,
                slugStatus.available === true
              )}
              maxLength={32}
            />
            {slugStatus.checking && <div style={hintStyle}>Checking availability…</div>}
            {!slugStatus.checking && slugStatus.available === true && (
              <div style={successStyle}>✓ Available</div>
            )}
            {!slugStatus.checking && slugStatus.available === false && (
              <div style={errorStyle}>{slugStatus.reason}</div>
            )}
          </Field>

          <Field label="What kind of organization?">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
              {[
                { id: 'club', label: 'Student org or club', desc: 'A group within a university' },
                { id: 'university', label: 'University', desc: 'An official institution account' },
                { id: 'other', label: 'Other', desc: 'Community group, nonprofit, etc.' }
              ].map(opt => (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handleField('type', opt.id)}
                  style={{
                    textAlign: 'left',
                    padding: '12px 14px',
                    border: `2px solid ${form.type === opt.id ? '#5B4AE6' : '#E5E7EB'}`,
                    backgroundColor: form.type === opt.id ? '#F5F3FF' : '#FFFFFF',
                    borderRadius: '10px',
                    cursor: 'pointer'
                  }}
                >
                  <div style={{ fontSize: '14px', fontWeight: 600, color: form.type === opt.id ? '#5B4AE6' : '#111827' }}>
                    {opt.label}
                  </div>
                  <div style={{ fontSize: '12px', color: '#6B7280', marginTop: '2px' }}>{opt.desc}</div>
                </button>
              ))}
            </div>
          </Field>

          {form.type === 'club' && (
            <Field label="Affiliated university" hint="Optional — links your org to a campus">
              <select
                value={form.universityId}
                onChange={e => handleField('universityId', e.target.value)}
                style={{ ...inputStyle(false), cursor: 'pointer' }}
              >
                <option value="">Select a university…</option>
                {universities.map(u => (
                  <option key={u.id} value={u.id}>{u.name}</option>
                ))}
              </select>
            </Field>
          )}

          <button
            type="button"
            onClick={() => setStep(2)}
            disabled={!step1Valid}
            style={{ ...primaryButtonStyle, opacity: step1Valid ? 1 : 0.5 }}
          >
            Continue
          </button>
        </div>
      )}

      {step === 2 && (
        <div>
          <Field label="Logo" hint="Optional — square images look best">
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                onClick={() => logoInputRef.current?.click()}
                style={{
                  width: '80px',
                  height: '80px',
                  borderRadius: '12px',
                  backgroundColor: form.logoPreview ? 'transparent' : '#F3F4F6',
                  border: '2px dashed #D1D5DB',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  cursor: 'pointer',
                  overflow: 'hidden',
                  backgroundImage: form.logoPreview ? `url(${form.logoPreview})` : 'none',
                  backgroundSize: 'cover',
                  backgroundPosition: 'center'
                }}
              >
                {!form.logoPreview && <span style={{ fontSize: '22px' }}>📷</span>}
              </div>
              <input
                ref={logoInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                onChange={e => handleLogo(e.target.files?.[0])}
                style={{ display: 'none' }}
              />
              <div>
                <button
                  type="button"
                  onClick={() => logoInputRef.current?.click()}
                  style={secondaryButtonStyle}
                >
                  {form.logoPreview ? 'Change logo' : 'Upload logo'}
                </button>
                {form.logoPreview && (
                  <button
                    type="button"
                    onClick={() => setForm(p => ({ ...p, logoFile: null, logoPreview: null }))}
                    style={{ ...textButtonStyle, marginTop: '4px', height: '24px' }}
                  >
                    Remove
                  </button>
                )}
              </div>
            </div>
          </Field>

          <Field label="Short bio" hint={`${form.bio.length}/280`}>
            <textarea
              value={form.bio}
              onChange={e => handleField('bio', e.target.value.slice(0, 280))}
              placeholder="What do you do? Who's it for?"
              rows={3}
              style={{ ...inputStyle(false), height: 'auto', minHeight: '80px', padding: '12px 14px', resize: 'vertical' }}
            />
          </Field>

          <Field label="Website" hint="Optional">
            <input
              type="url"
              value={form.website}
              onChange={e => handleField('website', e.target.value)}
              placeholder="https://yourorg.com"
              style={inputStyle(false)}
            />
          </Field>

          <Field label="Instagram" hint="Optional — just the handle">
            <input
              type="text"
              value={form.instagram}
              onChange={e => handleField('instagram', e.target.value)}
              placeholder="@yourorg"
              style={inputStyle(false)}
            />
          </Field>

          {submitError && (
            <div style={{ ...errorStyle, marginBottom: '16px', padding: '12px', backgroundColor: '#FEF2F2', borderRadius: '8px' }}>
              {submitError}
            </div>
          )}

          <button
            type="button"
            onClick={handleSubmit}
            disabled={isSubmitting}
            style={primaryButtonStyle}
          >
            {isSubmitting ? 'Creating…' : 'Create organization'}
          </button>
          <button type="button" onClick={() => setStep(1)} style={textButtonStyle} disabled={isSubmitting}>
            Back
          </button>
        </div>
      )}
    </ScreenShell>
  )
}

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: '16px' }}>
      <label style={labelStyle}>{label}</label>
      {children}
      {hint && <div style={hintStyle}>{hint}</div>}
    </div>
  )
}

function Header({ step }) {
  return (
    <>
      <div style={{ textAlign: 'center', marginBottom: '4px' }}>
        <span style={{ fontSize: '13px', fontWeight: 700, letterSpacing: '0.15em', color: '#5B4AE6' }}>
          SET UP YOUR ORG
        </span>
      </div>
      <div style={{ textAlign: 'center', marginBottom: '20px' }}>
        <h1 style={{ margin: '0 0 6px 0', fontSize: '22px', fontWeight: 700, color: '#111827' }}>
          {step === 1 ? 'Tell us about your org' : 'Add some branding'}
        </h1>
        <p style={{ margin: 0, fontSize: '14px', color: '#6B7280' }}>
          {step === 1 ? 'Two quick steps and you can start posting events.' : 'You can change all of this later.'}
        </p>
      </div>
      <div style={{ display: 'flex', gap: '8px', justifyContent: 'center', marginBottom: '20px' }}>
        {[1, 2].map(s => (
          <div
            key={s}
            style={{
              width: s <= step ? '24px' : '8px',
              height: '8px',
              borderRadius: '4px',
              backgroundColor: s <= step ? '#5B4AE6' : '#E5E7EB',
              transition: 'all 0.3s ease'
            }}
          />
        ))}
      </div>
    </>
  )
}

function ScreenShell({ children }) {
  return (
    <div style={{
      minHeight: '100%',
      background: 'linear-gradient(135deg, #FAFBFF 0%, #FFFFFF 50%, #F8F9FF 100%)',
      display: 'flex',
      alignItems: 'flex-start',
      justifyContent: 'center',
      padding: '24px 16px',
      paddingBottom: 'max(24px, env(safe-area-inset-bottom, 24px))',
      overflow: 'auto'
    }}>
      <div style={{
        width: '100%',
        maxWidth: '440px',
        backgroundColor: '#FFFFFF',
        borderRadius: '16px',
        boxShadow: '0 4px 16px rgba(0, 0, 0, 0.06)',
        padding: '32px 28px',
        marginTop: '12px'
      }}>
        {children}
      </div>
    </div>
  )
}

const labelStyle = {
  display: 'block',
  fontSize: '13px',
  fontWeight: 600,
  color: '#374151',
  marginBottom: '6px'
}

const inputStyle = (hasError, hasSuccess = false) => ({
  width: '100%',
  height: '46px',
  padding: '0 14px',
  fontSize: '15px',
  fontFamily: 'inherit',
  border: `1.5px solid ${hasError ? '#EF4444' : hasSuccess ? '#10B981' : '#E5E7EB'}`,
  borderRadius: '10px',
  outline: 'none',
  backgroundColor: '#FAFAFA',
  boxSizing: 'border-box'
})

const errorStyle = { fontSize: '12px', color: '#EF4444', marginTop: '6px' }
const successStyle = { fontSize: '12px', color: '#10B981', marginTop: '6px' }
const hintStyle = { fontSize: '12px', color: '#9CA3AF', marginTop: '6px' }

const primaryButtonStyle = {
  width: '100%',
  height: '48px',
  backgroundColor: '#5B4AE6',
  color: 'white',
  fontSize: '15px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '12px',
  cursor: 'pointer'
}

const secondaryButtonStyle = {
  height: '40px',
  padding: '0 14px',
  backgroundColor: '#F3F4F6',
  color: '#374151',
  fontSize: '13px',
  fontWeight: 600,
  border: 'none',
  borderRadius: '8px',
  cursor: 'pointer'
}

const textButtonStyle = {
  width: '100%',
  height: '40px',
  backgroundColor: 'transparent',
  color: '#6B7280',
  fontSize: '14px',
  fontWeight: 500,
  border: 'none',
  cursor: 'pointer',
  marginTop: '8px'
}

export default OrgOnboardingScreen
