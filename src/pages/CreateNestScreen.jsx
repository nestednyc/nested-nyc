import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveNest } from '../utils/nestData'

/**
 * CreateNestScreen - Clean, focused MVP layout
 * Single centered card with vertical flow
 */

// Available tags
const AVAILABLE_TAGS = [
  'Tech', 'Startups', 'AI', 'Research', 'Design', 'UI/UX', 
  'Business', 'Data', 'Python', 'Creative', 'Code', 'Mobile',
  'Web', 'Gaming', 'Music', 'Art', 'Finance', 'Health',
  'Social', 'Education', 'Sustainability', 'Blockchain'
]

function CreateNestScreen() {
  const navigate = useNavigate()
  const [isDesktop, setIsDesktop] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [formData, setFormData] = useState({
    name: '',
    description: '',
    tags: []
  })
  const [errors, setErrors] = useState({})

  // Responsive check
  useEffect(() => {
    const check = () => setIsDesktop(window.innerWidth >= 1024)
    check()
    window.addEventListener('resize', check)
    return () => window.removeEventListener('resize', check)
  }, [])

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  const toggleTag = (tag) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tag)
        ? prev.tags.filter(t => t !== tag)
        : prev.tags.length < 3 ? [...prev.tags, tag] : prev.tags
    }))
  }

  const validate = () => {
    const newErrors = {}
    if (!formData.name.trim()) newErrors.name = 'Nest name is required'
    if (formData.name.length > 50) newErrors.name = 'Name must be under 50 characters'
    if (!formData.description.trim()) newErrors.description = 'Description is required'
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validate()) return

    setIsSubmitting(true)
    
    // Simulate API delay
    await new Promise(resolve => setTimeout(resolve, 500))
    
    // Save nest (image will be auto-assigned)
    const newNest = saveNest(formData)
    
    // Navigate to the new nest
    navigate(`/nests/${newNest.id}`)
  }

  const isFormValid = formData.name.trim() && formData.description.trim()

  return (
    <div style={{ 
      height: '100%', 
      backgroundColor: '#F9FAFB',
      display: 'flex',
      flexDirection: 'column'
    }}>
      {/* Header */}
      <div style={{ 
        padding: '16px 20px',
        backgroundColor: 'white',
        borderBottom: '1px solid #E5E7EB',
        display: 'flex',
        alignItems: 'center',
        gap: '16px',
        flexShrink: 0
      }}>
        <button 
          onClick={() => navigate(-1)}
          style={{
            width: '40px',
            height: '40px',
            borderRadius: '10px',
            border: '1px solid #E5E7EB',
            backgroundColor: 'white',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#111827" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
        </button>
        <h1 style={{ margin: 0, fontSize: '18px', fontWeight: 700, color: '#111827' }}>
          Create a Nest
        </h1>
      </div>

      {/* Scrollable Form Content */}
      <div style={{ 
        flex: 1, 
        overflowY: 'auto', 
        padding: '24px 20px',
        paddingBottom: '140px'
      }}>
        <div style={{ 
          maxWidth: '520px', 
          margin: '0 auto',
          backgroundColor: 'white',
          borderRadius: '20px',
          padding: '28px 24px 32px',
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.08)'
        }}>
          {/* Title + Subtitle */}
          <div style={{ marginBottom: '28px', textAlign: 'center' }}>
            <div style={{
              width: '56px',
              height: '56px',
              borderRadius: '14px',
              backgroundColor: 'rgba(91, 74, 230, 0.1)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
            </div>
            <h2 style={{ margin: 0, fontSize: '20px', fontWeight: 700, color: '#111827' }}>
              Start your community
            </h2>
            <p style={{ 
              margin: '10px 0 0 0', 
              fontSize: '14px', 
              color: '#6B7280',
              lineHeight: 1.5
            }}>
              Nests are spaces where students with shared interests connect, collaborate, and build together.
            </p>
          </div>

          {/* Nest Name */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: 600, 
              color: '#111827',
              marginBottom: '8px'
            }}>
              Nest Name <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <input 
              type="text"
              value={formData.name}
              onChange={(e) => updateField('name', e.target.value)}
              placeholder="e.g., NYU Builders, Columbia AI"
              maxLength={50}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '15px',
                color: '#111827',
                border: errors.name ? '2px solid #EF4444' : '1.5px solid #E5E7EB',
                borderRadius: '12px',
                outline: 'none',
                boxSizing: 'border-box',
                backgroundColor: '#FAFAFA',
                transition: 'border-color 0.15s ease, background-color 0.15s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#5B4AE6'
                e.target.style.backgroundColor = 'white'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = errors.name ? '#EF4444' : '#E5E7EB'
                e.target.style.backgroundColor = '#FAFAFA'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
              {errors.name ? (
                <span style={{ fontSize: '12px', color: '#EF4444' }}>{errors.name}</span>
              ) : (
                <span />
              )}
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                {formData.name.length}/50
              </span>
            </div>
          </div>

          {/* Description */}
          <div style={{ marginBottom: '22px' }}>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: 600, 
              color: '#111827',
              marginBottom: '8px'
            }}>
              Description <span style={{ color: '#EF4444' }}>*</span>
            </label>
            <textarea 
              value={formData.description}
              onChange={(e) => updateField('description', e.target.value)}
              placeholder="What is this community about? Who should join? What will members do together?"
              rows={4}
              maxLength={300}
              style={{
                width: '100%',
                padding: '14px 16px',
                fontSize: '15px',
                color: '#111827',
                border: errors.description ? '2px solid #EF4444' : '1.5px solid #E5E7EB',
                borderRadius: '12px',
                outline: 'none',
                resize: 'vertical',
                fontFamily: 'inherit',
                boxSizing: 'border-box',
                backgroundColor: '#FAFAFA',
                lineHeight: 1.5,
                transition: 'border-color 0.15s ease, background-color 0.15s ease'
              }}
              onFocus={(e) => {
                e.target.style.borderColor = '#5B4AE6'
                e.target.style.backgroundColor = 'white'
              }}
              onBlur={(e) => {
                e.target.style.borderColor = errors.description ? '#EF4444' : '#E5E7EB'
                e.target.style.backgroundColor = '#FAFAFA'
              }}
            />
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
              {errors.description ? (
                <span style={{ fontSize: '12px', color: '#EF4444' }}>{errors.description}</span>
              ) : (
                <span />
              )}
              <span style={{ fontSize: '12px', color: '#9CA3AF' }}>
                {formData.description.length}/300
              </span>
            </div>
          </div>

          {/* Tags */}
          <div>
            <label style={{ 
              display: 'block', 
              fontSize: '14px', 
              fontWeight: 600, 
              color: '#111827',
              marginBottom: '6px'
            }}>
              Tags <span style={{ fontWeight: 400, color: '#9CA3AF' }}>(select up to 3)</span>
            </label>
            <p style={{ 
              margin: '0 0 12px 0', 
              fontSize: '13px', 
              color: '#6B7280' 
            }}>
              Help students find your community
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {AVAILABLE_TAGS.map(tag => {
                const isSelected = formData.tags.includes(tag)
                const isDisabled = !isSelected && formData.tags.length >= 3
                return (
                  <button
                    key={tag}
                    onClick={() => !isDisabled && toggleTag(tag)}
                    disabled={isDisabled}
                    style={{
                      padding: '8px 14px',
                      fontSize: '13px',
                      fontWeight: 500,
                      borderRadius: '20px',
                      border: 'none',
                      cursor: isDisabled ? 'not-allowed' : 'pointer',
                      backgroundColor: isSelected ? '#5B4AE6' : '#F3F4F6',
                      color: isSelected ? 'white' : isDisabled ? '#D1D5DB' : '#374151',
                      opacity: isDisabled ? 0.5 : 1,
                      transition: 'all 0.15s ease'
                    }}
                  >
                    {tag}
                    {isSelected && (
                      <span style={{ marginLeft: '6px' }}>×</span>
                    )}
                  </button>
                )
              })}
            </div>
            {formData.tags.length > 0 && (
              <p style={{ 
                margin: '12px 0 0 0', 
                fontSize: '12px', 
                color: '#6B7280' 
              }}>
                {formData.tags.length}/3 selected
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Bottom CTA - Fixed at bottom */}
      <div style={{
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        padding: '16px 20px',
        paddingBottom: isDesktop ? '20px' : '32px',
        backgroundColor: 'white',
        borderTop: '1px solid #E5E7EB'
      }}>
        <div style={{ maxWidth: '520px', margin: '0 auto' }}>
          <button 
            onClick={handleSubmit}
            disabled={isSubmitting || !isFormValid}
            style={{
              width: '100%',
              height: '54px',
              backgroundColor: isSubmitting ? '#9CA3AF' : !isFormValid ? '#D1D5DB' : '#5B4AE6',
              color: 'white',
              fontSize: '16px',
              fontWeight: 600,
              borderRadius: '14px',
              border: 'none',
              cursor: isSubmitting || !isFormValid ? 'not-allowed' : 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '10px',
              boxShadow: isFormValid && !isSubmitting ? '0 4px 14px rgba(91, 74, 230, 0.35)' : 'none',
              transition: 'all 0.2s ease'
            }}
          >
            {isSubmitting ? (
              <>
                <div style={{
                  width: '18px',
                  height: '18px',
                  border: '2px solid rgba(255,255,255,0.3)',
                  borderTopColor: 'white',
                  borderRadius: '50%',
                  animation: 'spin 0.7s linear infinite'
                }} />
                Creating...
              </>
            ) : (
              <>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
                Create Nest
              </>
            )}
          </button>
        </div>
      </div>

      {/* Spinner animation */}
      <style>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  )
}

export default CreateNestScreen
