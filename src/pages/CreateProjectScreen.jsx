import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveProject } from '../utils/projectStorage'
import { createProjectAsync } from '../utils/projectData'

/**
 * CreateProjectScreen - Discord-style step-based project creation
 * Progressive reveal: one conceptual section at a time
 */

// Form options
const CATEGORIES = [
  { id: 'startup', label: 'Startup', icon: '🚀', description: 'Building a real business' },
  { id: 'class-project', label: 'Class Project', icon: '📚', description: 'Academic or coursework' },
  { id: 'side-project', label: 'Side Project', icon: '🛠', description: 'Learning or experimenting' },
  { id: 'research', label: 'Research', icon: '🔬', description: 'Academic research' },
]

const STAGES = [
  { id: 'idea', label: 'Just an Idea', icon: '💡', description: 'Looking for co-founders or early team' },
  { id: 'mvp', label: 'Building MVP', icon: '🔨', description: 'Working on first version' },
  { id: 'in-progress', label: 'In Progress', icon: '🚧', description: 'Active development, need help' },
  { id: 'looking-for-team', label: 'Looking for Team', icon: '👥', description: 'Have the plan, need builders' },
]

const ROLES = [
  { id: 'frontend', label: 'Frontend Dev', color: '#3B82F6' },
  { id: 'backend', label: 'Backend Dev', color: '#10B981' },
  { id: 'fullstack', label: 'Full Stack', color: '#8B5CF6' },
  { id: 'designer', label: 'UI/UX Designer', color: '#EC4899' },
  { id: 'data', label: 'Data Science', color: '#F59E0B' },
  { id: 'ml', label: 'ML/AI', color: '#6366F1' },
  { id: 'mobile', label: 'Mobile Dev', color: '#14B8A6' },
  { id: 'pm', label: 'Product Manager', color: '#EF4444' },
  { id: 'marketing', label: 'Marketing', color: '#F97316' },
  { id: 'business', label: 'Business/Strategy', color: '#84CC16' },
]

const SKILLS = [
  'React', 'Next.js', 'TypeScript', 'Node.js', 'Python', 'Django', 'Flask',
  'PostgreSQL', 'MongoDB', 'Firebase', 'AWS', 'Figma', 'UI Design', 'UX Research',
  'React Native', 'Swift', 'Kotlin', 'Flutter', 'TensorFlow', 'PyTorch',
  'Data Analysis', 'SQL', 'Tableau', 'Product Strategy', 'Growth', 'Content'
]

const COMMITMENTS = [
  { id: 'hackathon', label: 'Hackathon', description: '1-3 days, intense sprint', hours: '20-40 hrs total' },
  { id: 'side-project', label: 'Side Project', description: 'Few hours per week', hours: '5-10 hrs/week' },
  { id: 'serious', label: 'Serious Build', description: 'Significant time commitment', hours: '15-25 hrs/week' },
  { id: 'startup', label: 'Startup Mode', description: 'Full dedication', hours: '30+ hrs/week' },
]

const TOTAL_STEPS = 5

function CreateProjectScreen() {
  const navigate = useNavigate()
  const [currentStep, setCurrentStep] = useState(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    // Step 1: Category
    category: '',
    
    // Step 2: Stage
    stage: '',
    
    // Step 3: Identity
    name: '',
    tagline: '',
    
    // Step 4: Details
    description: '',
    roles: [],
    skills: [],
    commitment: '',
    
    // Step 5: Visibility
    publishToDiscover: true,
  })

  const [errors, setErrors] = useState({})

  const updateField = (field, value) => {
    setFormData(prev => ({ ...prev, [field]: value }))
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: null }))
    }
  }

  const toggleArrayItem = (field, item) => {
    setFormData(prev => ({
      ...prev,
      [field]: prev[field].includes(item)
        ? prev[field].filter(i => i !== item)
        : [...prev[field], item]
    }))
  }

  // Step-specific validation
  const validateStep = (step) => {
    const newErrors = {}
    
    switch (step) {
      case 1:
        if (!formData.category) newErrors.category = 'Please select a category'
        break
      case 2:
        if (!formData.stage) newErrors.stage = 'Please select a stage'
        break
      case 3:
        if (!formData.name.trim()) newErrors.name = 'Project name is required'
        if (!formData.tagline.trim()) newErrors.tagline = 'Tagline is required'
        break
      case 4:
        if (!formData.description.trim()) newErrors.description = 'Description is required'
        if (formData.roles.length === 0) newErrors.roles = 'Select at least one role'
        if (!formData.commitment) newErrors.commitment = 'Select commitment level'
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

    // Create project object
    const projectData = {
      ...formData,
      author: 'You',
      authorImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
      image: getProjectImage(formData.category),
      team: [],
      spotsLeft: formData.roles.length,
    }

    try {
      // Try to save to Supabase first, falls back to localStorage
      const { data, error } = await createProjectAsync(projectData)

      if (error) {
        console.error('Error creating project:', error)
        // Fall back to localStorage
        const project = {
          id: Date.now(),
          ...projectData,
          createdAt: new Date().toISOString(),
        }
        saveProject(project)
      }
    } catch (err) {
      console.error('Error creating project:', err)
      // Fall back to localStorage
      const project = {
        id: Date.now(),
        ...projectData,
        createdAt: new Date().toISOString(),
      }
      saveProject(project)
    }

    setIsSubmitting(false)

    // Navigate to My Projects with success state
    navigate('/matches', { state: { projectCreated: true, projectName: formData.name } })
  }

  // Get step title and subtitle
  const getStepInfo = (step) => {
    switch (step) {
      case 1:
        return { title: 'What are you creating?', subtitle: 'Choose the type of project' }
      case 2:
        return { title: 'What stage is this project in?', subtitle: 'Let people know where you are' }
      case 3:
        return { title: 'Project identity', subtitle: 'Give your project a name and pitch' }
      case 4:
        return { title: 'Project details', subtitle: 'Describe your project and what you need' }
      case 5:
        return { title: 'Visibility & publish', subtitle: 'Choose who can see your project' }
      default:
        return { title: '', subtitle: '' }
    }
  }

  const stepInfo = getStepInfo(currentStep)

  // Check if current step is complete (for continue button state)
  const isStepComplete = () => {
    switch (currentStep) {
      case 1: return !!formData.category
      case 2: return !!formData.stage
      case 3: return formData.name.trim() && formData.tagline.trim()
      case 4: return formData.description.trim() && formData.roles.length > 0 && formData.commitment
      case 5: return true
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

          {/* Step 1: Category Selection */}
          {currentStep === 1 && (
            <div className="step-content">
              <div className="selection-grid">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`selection-card ${formData.category === cat.id ? 'selected' : ''}`}
                    onClick={() => updateField('category', cat.id)}
                  >
                    <span className="selection-icon">{cat.icon}</span>
                    <span className="selection-label">{cat.label}</span>
                    <span className="selection-description">{cat.description}</span>
                    {formData.category === cat.id && (
                      <div className="selection-check">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {errors.category && <span className="step-error">{errors.category}</span>}
            </div>
          )}

          {/* Step 2: Stage Selection */}
          {currentStep === 2 && (
            <div className="step-content">
              <div className="selection-grid stage-grid">
                {STAGES.map(stage => (
                  <button
                    key={stage.id}
                    type="button"
                    className={`selection-card stage-card ${formData.stage === stage.id ? 'selected' : ''}`}
                    onClick={() => updateField('stage', stage.id)}
                  >
                    <span className="selection-icon">{stage.icon}</span>
                    <span className="selection-label">{stage.label}</span>
                    <span className="selection-description">{stage.description}</span>
                    {formData.stage === stage.id && (
                      <div className="selection-check">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                          <polyline points="20 6 9 17 4 12"/>
                        </svg>
                      </div>
                    )}
                  </button>
                ))}
              </div>
              {errors.stage && <span className="step-error">{errors.stage}</span>}
            </div>
          )}

          {/* Step 3: Project Identity */}
          {currentStep === 3 && (
            <div className="step-content">
              {/* Project Icon Placeholder */}
              <div className="project-icon-upload">
                <div className="project-icon-preview">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="1.5">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                </div>
                <span className="project-icon-label">Project icon (optional)</span>
              </div>

              <div className="step-form-group">
                <label className="step-form-label">Project Name *</label>
                <input
                  type="text"
                  className={`step-form-input ${errors.name ? 'input-error' : ''}`}
                  placeholder="e.g., ClimateTech Dashboard"
                  value={formData.name}
                  onChange={(e) => updateField('name', e.target.value)}
                  maxLength={60}
                  autoFocus
                />
                {errors.name && <span className="step-error">{errors.name}</span>}
                <span className="step-form-hint">{formData.name.length}/60</span>
              </div>

              <div className="step-form-group">
                <label className="step-form-label">Tagline *</label>
                <input
                  type="text"
                  className={`step-form-input ${errors.tagline ? 'input-error' : ''}`}
                  placeholder="One sentence describing your project"
                  value={formData.tagline}
                  onChange={(e) => updateField('tagline', e.target.value)}
                  maxLength={100}
                />
                {errors.tagline && <span className="step-error">{errors.tagline}</span>}
                <span className="step-form-hint">{formData.tagline.length}/100</span>
              </div>
            </div>
          )}

          {/* Step 4: Project Details */}
          {currentStep === 4 && (
            <div className="step-content step-content-scrollable">
              <div className="step-form-group">
                <label className="step-form-label">About this project *</label>
                <textarea
                  className={`step-form-textarea ${errors.description ? 'input-error' : ''}`}
                  placeholder="What's the idea? What problem does it solve? What makes it exciting?"
                  value={formData.description}
                  onChange={(e) => updateField('description', e.target.value)}
                  rows={4}
                  maxLength={500}
                />
                {errors.description && <span className="step-error">{errors.description}</span>}
                <span className="step-form-hint">{formData.description.length}/500</span>
              </div>

              <div className="step-form-group">
                <label className="step-form-label">Roles Needed *</label>
                <p className="step-form-sublabel">Select all that apply</p>
                <div className="chips-grid">
                  {ROLES.map(role => (
                    <button
                      key={role.id}
                      type="button"
                      className={`chip ${formData.roles.includes(role.id) ? 'selected' : ''}`}
                      onClick={() => toggleArrayItem('roles', role.id)}
                      style={{ '--chip-color': role.color }}
                    >
                      {role.label}
                      {formData.roles.includes(role.id) && (
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                          <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z"/>
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
                {errors.roles && <span className="step-error">{errors.roles}</span>}
              </div>

              <div className="step-form-group">
                <label className="step-form-label">Skills (optional)</label>
                <p className="step-form-sublabel">Specific technologies or expertise</p>
                <div className="chips-grid skills-chips">
                  {SKILLS.map(skill => (
                    <button
                      key={skill}
                      type="button"
                      className={`chip skill-chip ${formData.skills.includes(skill) ? 'selected' : ''}`}
                      onClick={() => toggleArrayItem('skills', skill)}
                    >
                      {skill}
                    </button>
                  ))}
                </div>
              </div>

              <div className="step-form-group">
                <label className="step-form-label">Commitment Level *</label>
                <div className="commitment-options">
                  {COMMITMENTS.map(commit => (
                    <button
                      key={commit.id}
                      type="button"
                      className={`commitment-option ${formData.commitment === commit.id ? 'selected' : ''}`}
                      onClick={() => updateField('commitment', commit.id)}
                    >
                      <div className="commitment-option-header">
                        <span className="commitment-option-label">{commit.label}</span>
                        <span className="commitment-option-hours">{commit.hours}</span>
                      </div>
                      <span className="commitment-option-description">{commit.description}</span>
                      {formData.commitment === commit.id && (
                        <div className="commitment-check">
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3">
                            <polyline points="20 6 9 17 4 12"/>
                          </svg>
                        </div>
                      )}
                    </button>
                  ))}
                </div>
                {errors.commitment && <span className="step-error">{errors.commitment}</span>}
              </div>
            </div>
          )}

          {/* Step 5: Visibility & Publish */}
          {currentStep === 5 && (
            <div className="step-content">
              {/* Project Summary */}
              <div className="publish-preview">
                <div className="publish-preview-icon">
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="1.5">
                    <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/>
                    <polyline points="3.27 6.96 12 12.01 20.73 6.96"/>
                    <line x1="12" y1="22.08" x2="12" y2="12"/>
                  </svg>
                </div>
                <h3 className="publish-preview-title">{formData.name || 'Your Project'}</h3>
                <p className="publish-preview-tagline">{formData.tagline || 'Your tagline'}</p>
                <div className="publish-preview-badges">
                  <span className="publish-badge">{CATEGORIES.find(c => c.id === formData.category)?.label || 'Category'}</span>
                  <span className="publish-badge">{STAGES.find(s => s.id === formData.stage)?.label || 'Stage'}</span>
                  <span className="publish-badge">{formData.roles.length} role{formData.roles.length !== 1 ? 's' : ''}</span>
                </div>
              </div>

              {/* Visibility Toggle */}
              <div className="visibility-option">
                <div className="visibility-option-content">
                  <div className="visibility-option-icon">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                      <circle cx="12" cy="12" r="10"/>
                      <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"/>
                    </svg>
                  </div>
                  <div className="visibility-option-text">
                    <span className="visibility-option-label">Publish to Discover</span>
                    <span className="visibility-option-description">
                      Your project will appear in Discover for other students to find and join
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  className={`toggle-btn ${formData.publishToDiscover ? 'active' : ''}`}
                  onClick={() => updateField('publishToDiscover', !formData.publishToDiscover)}
                >
                  <span className="toggle-btn-knob" />
                </button>
              </div>

              {!formData.publishToDiscover && (
                <div className="visibility-warning">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#F59E0B" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <line x1="12" y1="8" x2="12" y2="12"/>
                    <line x1="12" y1="16" x2="12.01" y2="16"/>
                  </svg>
                  <span>Private projects won't appear in Discover. You can change this later.</span>
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
          <div /> // Spacer
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
                Create Project
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

// Helper function to get a project image based on category
function getProjectImage(category) {
  const images = {
    'startup': 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=800&fit=crop',
    'class-project': 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=600&h=800&fit=crop',
    'side-project': 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=800&fit=crop',
    'research': 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&h=800&fit=crop',
  }
  return images[category] || images['side-project']
}

export default CreateProjectScreen
