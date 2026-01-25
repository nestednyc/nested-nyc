import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { eventService } from '../services/eventService'
import { profileService } from '../services/profileService'

/**
 * CreateEventScreen - Step-based event creation
 * Similar flow to CreateProjectScreen
 */

// Event type options
const EVENT_TYPES = [
  { id: 'Networking', label: 'Networking', icon: '🤝', description: 'Meet and connect with others' },
  { id: 'Workshop', label: 'Workshop', icon: '🛠', description: 'Hands-on learning session' },
  { id: 'Tech', label: 'Tech Talk', icon: '💻', description: 'Technical presentation or demo' },
  { id: 'Hackathon', label: 'Hackathon', icon: '⚡', description: 'Build something together' },
  { id: 'Social', label: 'Social', icon: '🎉', description: 'Casual hangout or party' },
  { id: 'Demo', label: 'Demo Day', icon: '🎤', description: 'Project showcases and pitches' },
  { id: 'Career', label: 'Career', icon: '💼', description: 'Job fair or career event' },
  { id: 'Design', label: 'Design', icon: '🎨', description: 'Design-focused event' },
]

// Date options
const MONTHS = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'
]

const DAYS = Array.from({ length: 31 }, (_, i) => i + 1)

const YEARS = [2025, 2026, 2027]

// Time options (30-min intervals)
const TIME_OPTIONS = [
  '9:00 AM', '9:30 AM', '10:00 AM', '10:30 AM', '11:00 AM', '11:30 AM',
  '12:00 PM', '12:30 PM', '1:00 PM', '1:30 PM', '2:00 PM', '2:30 PM',
  '3:00 PM', '3:30 PM', '4:00 PM', '4:30 PM', '5:00 PM', '5:30 PM',
  '6:00 PM', '6:30 PM', '7:00 PM', '7:30 PM', '8:00 PM', '8:30 PM',
  '9:00 PM', '9:30 PM', '10:00 PM'
]

// Duration options
const DURATION_OPTIONS = [
  '1 hour', '1.5 hours', '2 hours', '2.5 hours', '3 hours', '4 hours', '5 hours', 'All day'
]

const TOTAL_STEPS = 3

function CreateEventScreen() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const [profile, setProfile] = useState(null)

  // Fetch current user's profile for organizer info
  useEffect(() => {
    async function loadProfile() {
      const { data } = await profileService.getCurrentProfile()
      if (data) {
        setProfile(data)
      }
    }
    loadProfile()
  }, [])

  // Form state
  const [formData, setFormData] = useState({
    // Step 1: Type & Identity
    tags: [],
    title: '',
    description: '',

    // Step 2: When & Where
    month: '',
    day: '',
    year: '2026',
    startTime: '',
    duration: '2 hours',
    location: '',
    address: '',

    // Step 3: Details
    highlights: ['', '', ''],
    max_attendees: 50,
  })

  const [errors, setErrors] = useState({})

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  const toggleTag = (tagId) => {
    setFormData(prev => ({
      ...prev,
      tags: prev.tags.includes(tagId)
        ? prev.tags.filter(t => t !== tagId)
        : prev.tags.length < 3 ? [...prev.tags, tagId] : prev.tags
    }))
  }

  const updateHighlight = (index, value) => {
    setFormData(prev => {
      const newHighlights = [...prev.highlights]
      newHighlights[index] = value
      return { ...prev, highlights: newHighlights }
    })
  }

  // Step validation
  const validateStep = (step) => {
    const newErrors = {}

    switch (step) {
      case 1:
        if (formData.tags.length === 0) newErrors.tags = 'Select at least one event type'
        if (!formData.title.trim()) newErrors.title = 'Event title is required'
        if (!formData.description.trim()) newErrors.description = 'Description is required'
        break
      case 2:
        if (!formData.month) newErrors.month = 'Month is required'
        if (!formData.day) newErrors.day = 'Day is required'
        if (!formData.startTime) newErrors.startTime = 'Start time is required'
        if (!formData.location.trim()) newErrors.location = 'Location is required'
        break
      default:
        break
    }

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleNext = () => {
    if (validateStep(currentStep)) {
      setCurrentStep(prev => Math.min(prev + 1, TOTAL_STEPS))
    }
  }

  const handleBack = () => {
    setCurrentStep(prev => Math.max(prev - 1, 1))
  }

  const handleSubmit = async () => {
    setIsSubmitting(true)
    setError(null)

    // Filter out empty highlights
    const filteredHighlights = formData.highlights.filter(h => h.trim())

    // Get organizer name from profile
    const organizerName = profile
      ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'Event Organizer'
      : 'Event Organizer'

    // Format date and time from dropdowns
    const formattedDate = `${formData.month} ${formData.day}, ${formData.year}`
    const formattedTime = `${formData.startTime} (${formData.duration})`

    const eventData = {
      title: formData.title,
      description: formData.description,
      date: formattedDate,
      time: formattedTime,
      location: formData.location,
      address: formData.address,
      tags: formData.tags,
      highlights: filteredHighlights,
      max_attendees: formData.max_attendees,
      organizer_name: organizerName,
      organizer_image: profile?.avatar || null,
      is_past: false,
    }

    try {
      const { data, error: createError } = await eventService.createEvent(eventData)

      if (createError) {
        console.error('Error creating event:', createError)
        setError(createError.message || 'Failed to create event')
        setIsSubmitting(false)
        return
      }

      // Navigate to events page
      navigate('/events', { state: { eventCreated: true, eventName: formData.title } })
    } catch (err) {
      console.error('Error creating event:', err)
      setError('Failed to create event. Please try again.')
      setIsSubmitting(false)
    }
  }

  // Get step info
  const getStepInfo = (step) => {
    switch (step) {
      case 1:
        return { title: 'What kind of event?', subtitle: 'Tell us about your event' }
      case 2:
        return { title: 'When and where?', subtitle: 'Set the date, time, and location' }
      case 3:
        return { title: 'Final details', subtitle: 'Add highlights and set capacity' }
      default:
        return { title: '', subtitle: '' }
    }
  }

  const stepInfo = getStepInfo(currentStep)

  // Check if step is complete
  const isStepComplete = () => {
    switch (currentStep) {
      case 1: return formData.tags.length > 0 && formData.title.trim() && formData.description.trim()
      case 2: return formData.month && formData.day && formData.startTime && formData.location.trim()
      case 3: return true
      default: return false
    }
  }

  return (
    <div className="step-wizard">
      {/* Progress Bar */}
      <div className="step-wizard-progress">
        <div
          className="step-wizard-progress-bar"
          style={{ width: `${(currentStep / TOTAL_STEPS) * 100}%` }}
        />
      </div>

      {/* Header */}
      <div className="step-wizard-header">
        <button
          className="step-wizard-close"
          onClick={() => navigate(-1)}
          title="Close"
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        <div className="step-wizard-step-indicator">
          Step {currentStep} of {TOTAL_STEPS}
        </div>
      </div>

      {/* Content Area */}
      <div className="step-wizard-content">
        <div className="step-wizard-inner">
          {/* Step Title */}
          <div className="step-wizard-title-section">
            <h1 className="step-wizard-title">{stepInfo.title}</h1>
            <p className="step-wizard-subtitle">{stepInfo.subtitle}</p>
          </div>

          {/* Step 1: Type & Identity */}
          {currentStep === 1 && (
            <div className="step-content step-content-scrollable">
              <div className="step-form-group">
                <label className="step-form-label">Event Type *</label>
                <p className="step-form-sublabel">Select up to 3 types</p>
                <div className="selection-grid">
                  {EVENT_TYPES.map(type => (
                    <button
                      key={type.id}
                      type="button"
                      className={`selection-card ${formData.tags.includes(type.id) ? 'selected' : ''}`}
                      onClick={() => toggleTag(type.id)}
                    >
                      <span className="selection-icon">{type.icon}</span>
                      <span className="selection-label">{type.label}</span>
                      <span className="selection-description">{type.description}</span>
                      {formData.tags.includes(type.id) && (
                        <div className="selection-check">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {errors.tags && <span className="step-error">{errors.tags}</span>}
              </div>

              <div className="step-form-group">
                <label className="step-form-label">Event Title *</label>
                <input
                  type="text"
                  className={`step-form-input ${errors.title ? 'input-error' : ''}`}
                  placeholder="e.g., NYC Tech Meetup"
                  value={formData.title}
                  onChange={(e) => updateField('title', e.target.value)}
                  maxLength={80}
                />
                {errors.title && <span className="step-error">{errors.title}</span>}
                <span className="step-form-hint">{formData.title.length}/80</span>
              </div>

              <div className="step-form-group">
                <label className="step-form-label">Description *</label>
                <textarea
                  className={`step-form-textarea ${errors.description ? 'input-error' : ''}`}
                  placeholder="What's this event about? What will attendees experience?"
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={4}
                  maxLength={500}
                />
                {errors.description && <span className="step-error">{errors.description}</span>}
                <span className="step-form-hint">{formData.description.length}/500</span>
              </div>
            </div>
          )}

          {/* Step 2: When & Where */}
          {currentStep === 2 && (
            <div className="step-content">
              {/* Date Selection */}
              <div className="step-form-group">
                <label className="step-form-label">Date *</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <select
                    className={`step-form-input ${errors.month ? 'input-error' : ''}`}
                    value={formData.month}
                    onChange={(e) => updateField('month', e.target.value)}
                    style={{ flex: 2 }}
                  >
                    <option value="">Month</option>
                    {MONTHS.map(month => (
                      <option key={month} value={month}>{month}</option>
                    ))}
                  </select>
                  <select
                    className={`step-form-input ${errors.day ? 'input-error' : ''}`}
                    value={formData.day}
                    onChange={(e) => updateField('day', e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Day</option>
                    {DAYS.map(day => (
                      <option key={day} value={day}>{day}</option>
                    ))}
                  </select>
                  <select
                    className="step-form-input"
                    value={formData.year}
                    onChange={(e) => updateField('year', e.target.value)}
                    style={{ flex: 1 }}
                  >
                    {YEARS.map(year => (
                      <option key={year} value={year}>{year}</option>
                    ))}
                  </select>
                </div>
                {(errors.month || errors.day) && <span className="step-error">Please select a complete date</span>}
              </div>

              {/* Time Selection */}
              <div className="step-form-group">
                <label className="step-form-label">Time *</label>
                <div style={{ display: 'flex', gap: '12px' }}>
                  <select
                    className={`step-form-input ${errors.startTime ? 'input-error' : ''}`}
                    value={formData.startTime}
                    onChange={(e) => updateField('startTime', e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">Start Time</option>
                    {TIME_OPTIONS.map(time => (
                      <option key={time} value={time}>{time}</option>
                    ))}
                  </select>
                  <select
                    className="step-form-input"
                    value={formData.duration}
                    onChange={(e) => updateField('duration', e.target.value)}
                    style={{ flex: 1 }}
                  >
                    {DURATION_OPTIONS.map(duration => (
                      <option key={duration} value={duration}>{duration}</option>
                    ))}
                  </select>
                </div>
                {errors.startTime && <span className="step-error">{errors.startTime}</span>}
              </div>

              <div className="step-form-group">
                <label className="step-form-label">Venue Name *</label>
                <input
                  type="text"
                  className={`step-form-input ${errors.location ? 'input-error' : ''}`}
                  placeholder="e.g., NYU Tandon"
                  value={formData.location}
                  onChange={(e) => updateField('location', e.target.value)}
                />
                {errors.location && <span className="step-error">{errors.location}</span>}
              </div>

              <div className="step-form-group">
                <label className="step-form-label">Address (optional)</label>
                <input
                  type="text"
                  className="step-form-input"
                  placeholder="e.g., 6 MetroTech Center, Brooklyn, NY"
                  value={formData.address}
                  onChange={(e) => updateField('address', e.target.value)}
                />
              </div>
            </div>
          )}

          {/* Step 3: Details & Publish */}
          {currentStep === 3 && (
            <div className="step-content">
              <div className="step-form-group">
                <label className="step-form-label">Event Highlights (optional)</label>
                <p className="step-form-sublabel">What can attendees expect?</p>
                {formData.highlights.map((highlight, idx) => (
                  <input
                    key={idx}
                    type="text"
                    className="step-form-input"
                    placeholder={`Highlight ${idx + 1}`}
                    value={highlight}
                    onChange={(e) => updateHighlight(idx, e.target.value)}
                    style={{ marginBottom: '8px' }}
                  />
                ))}
              </div>

              <div className="step-form-group">
                <label className="step-form-label">Max Attendees</label>
                <input
                  type="number"
                  className="step-form-input"
                  value={formData.max_attendees}
                  onChange={(e) => updateField('max_attendees', parseInt(e.target.value) || 50)}
                  min={1}
                  max={1000}
                  style={{ width: '120px' }}
                />
                <span className="step-form-hint">Maximum capacity for the event</span>
              </div>

              {/* Preview */}
              <div className="publish-preview" style={{ marginTop: '24px' }}>
                <div className="publish-preview-icon">
                  <span style={{ fontSize: '32px' }}>
                    {EVENT_TYPES.find(t => t.id === formData.tags[0])?.icon || '📅'}
                  </span>
                </div>
                <h3 className="publish-preview-title">{formData.title || 'Your Event'}</h3>
                <p className="publish-preview-tagline">
                  {formData.month && formData.day ? `${formData.month} ${formData.day}, ${formData.year}` : 'Date TBD'} • {formData.location || 'Location TBD'}
                </p>
                <div className="publish-preview-badges">
                  {formData.tags.map(tag => (
                    <span key={tag} className="publish-badge">{tag}</span>
                  ))}
                </div>
              </div>

              {error && (
                <div style={{
                  marginTop: '16px',
                  padding: '12px',
                  backgroundColor: '#FEE2E2',
                  color: '#DC2626',
                  borderRadius: '8px',
                  fontSize: '14px'
                }}>
                  {error}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Footer Navigation */}
      <div className="step-wizard-footer">
        {currentStep > 1 ? (
          <button
            type="button"
            className="step-wizard-back"
            onClick={handleBack}
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M19 12H5M12 19l-7-7 7-7"/>
            </svg>
            Back
          </button>
        ) : (
          <div />
        )}

        {currentStep < TOTAL_STEPS ? (
          <button
            type="button"
            className={`step-wizard-continue ${isStepComplete() ? '' : 'disabled'}`}
            onClick={handleNext}
            disabled={!isStepComplete()}
          >
            Continue
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M5 12h14M12 5l7 7-7 7"/>
            </svg>
          </button>
        ) : (
          <button
            type="button"
            className="step-wizard-submit"
            onClick={handleSubmit}
            disabled={isSubmitting}
          >
            {isSubmitting ? (
              <>
                <span className="submit-spinner" />
                Creating...
              </>
            ) : (
              <>
                Create Event
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <polyline points="20 6 9 17 4 12"/>
                </svg>
              </>
            )}
          </button>
        )}
      </div>
    </div>
  )
}

export default CreateEventScreen
