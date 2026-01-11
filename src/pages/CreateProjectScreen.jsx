import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { saveProject } from '../utils/projectStorage'

/**
 * CreateProjectScreen - Full project creation flow
 * Multi-section form for publishing projects, startups, or ideas
 */

// Form options
const CATEGORIES = [
  { id: 'startup', label: 'Startup', icon: '🚀' },
  { id: 'class-project', label: 'Class Project', icon: '📚' },
  { id: 'hackathon', label: 'Hackathon', icon: '⚡' },
  { id: 'side-project', label: 'Side Project', icon: '🛠' },
  { id: 'research', label: 'Research', icon: '🔬' },
]

const STAGES = [
  { id: 'idea', label: 'Just an Idea', description: 'Looking for co-founders or early team' },
  { id: 'mvp', label: 'Building MVP', description: 'Working on first version' },
  { id: 'in-progress', label: 'In Progress', description: 'Active development, need help' },
  { id: 'looking-for-team', label: 'Looking for Team', description: 'Have the plan, need builders' },
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

const UNIVERSITIES = [
  'NYU', 'Columbia', 'Parsons', 'The New School', 'Stern', 'Tisch', 
  'NYU Tandon', 'Barnard', 'CUNY', 'Fordham', 'Other'
]

function CreateProjectScreen() {
  const navigate = useNavigate()
  const [isSubmitting, setIsSubmitting] = useState(false)
  
  // Form state
  const [formData, setFormData] = useState({
    // Basics
    name: '',
    tagline: '',
    category: '',
    university: '',
    
    // Description
    description: '',
    stage: '',
    
    // Looking for
    roles: [],
    skills: [],
    commitment: '',
    
    // Visibility
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

  const validateForm = () => {
    const newErrors = {}
    
    if (!formData.name.trim()) newErrors.name = 'Project name is required'
    if (!formData.tagline.trim()) newErrors.tagline = 'Tagline is required'
    if (!formData.category) newErrors.category = 'Select a category'
    if (!formData.description.trim()) newErrors.description = 'Description is required'
    if (!formData.stage) newErrors.stage = 'Select a stage'
    if (formData.roles.length === 0) newErrors.roles = 'Select at least one role'
    if (!formData.commitment) newErrors.commitment = 'Select commitment level'
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async () => {
    if (!validateForm()) {
      // Scroll to first error
      const firstError = document.querySelector('.form-error')
      if (firstError) {
        firstError.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      return
    }

    setIsSubmitting(true)

    // Create project object
    const project = {
      id: Date.now(),
      ...formData,
      createdAt: new Date().toISOString(),
      author: 'You', // Would come from auth
      authorImage: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&h=200&fit=crop',
      image: getProjectImage(formData.category),
      team: [],
      spotsLeft: formData.roles.length,
    }

    // Save to local storage
    saveProject(project)

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500))

    setIsSubmitting(false)
    
    // Navigate to My Projects with success state
    navigate('/matches', { state: { projectCreated: true, projectName: formData.name } })
  }

  return (
    <div className="create-project-screen">
      {/* Header */}
      <div className="create-project-header">
        <button 
          className="back-button"
          onClick={() => navigate(-1)}
        >
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M19 12H5M12 19l-7-7 7-7"/>
          </svg>
          Back
        </button>
        <h1 className="create-project-title">Create Project</h1>
        <div style={{ width: '80px' }} /> {/* Spacer for centering */}
      </div>

      {/* Form Content */}
      <div className="create-project-content">
        <div className="create-project-form">
          
          {/* Section 1: Project Basics */}
          <section className="form-section">
            <div className="section-header">
              <span className="section-number">1</span>
              <div>
                <h2 className="section-title">Project Basics</h2>
                <p className="section-subtitle">What are you building?</p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Project Name *</label>
              <input
                type="text"
                className={`form-input ${errors.name ? 'input-error' : ''}`}
                placeholder="e.g., ClimateTech Dashboard"
                value={formData.name}
                onChange={(e) => updateField('name', e.target.value)}
                maxLength={60}
              />
              {errors.name && <span className="form-error">{errors.name}</span>}
              <span className="form-hint">{formData.name.length}/60 characters</span>
            </div>

            <div className="form-group">
              <label className="form-label">Tagline *</label>
              <input
                type="text"
                className={`form-input ${errors.tagline ? 'input-error' : ''}`}
                placeholder="One sentence describing your project"
                value={formData.tagline}
                onChange={(e) => updateField('tagline', e.target.value)}
                maxLength={100}
              />
              {errors.tagline && <span className="form-error">{errors.tagline}</span>}
              <span className="form-hint">{formData.tagline.length}/100 characters</span>
            </div>

            <div className="form-group">
              <label className="form-label">Category *</label>
              <div className="category-grid">
                {CATEGORIES.map(cat => (
                  <button
                    key={cat.id}
                    type="button"
                    className={`category-card ${formData.category === cat.id ? 'selected' : ''}`}
                    onClick={() => updateField('category', cat.id)}
                  >
                    <span className="category-icon">{cat.icon}</span>
                    <span className="category-label">{cat.label}</span>
                  </button>
                ))}
              </div>
              {errors.category && <span className="form-error">{errors.category}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">University (optional)</label>
              <select
                className="form-select"
                value={formData.university}
                onChange={(e) => updateField('university', e.target.value)}
              >
                <option value="">Select university...</option>
                {UNIVERSITIES.map(uni => (
                  <option key={uni} value={uni}>{uni}</option>
                ))}
              </select>
            </div>
          </section>

          {/* Section 2: Description */}
          <section className="form-section">
            <div className="section-header">
              <span className="section-number">2</span>
              <div>
                <h2 className="section-title">Project Description</h2>
                <p className="section-subtitle">Tell people what you're building</p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Description *</label>
              <textarea
                className={`form-textarea ${errors.description ? 'input-error' : ''}`}
                placeholder="What's the idea? What problem does it solve? What makes it exciting?"
                value={formData.description}
                onChange={(e) => updateField('description', e.target.value)}
                rows={5}
                maxLength={500}
              />
              {errors.description && <span className="form-error">{errors.description}</span>}
              <span className="form-hint">{formData.description.length}/500 characters</span>
            </div>

            <div className="form-group">
              <label className="form-label">Current Stage *</label>
              <div className="stage-grid">
                {STAGES.map(stage => (
                  <button
                    key={stage.id}
                    type="button"
                    className={`stage-card ${formData.stage === stage.id ? 'selected' : ''}`}
                    onClick={() => updateField('stage', stage.id)}
                  >
                    <span className="stage-label">{stage.label}</span>
                    <span className="stage-description">{stage.description}</span>
                  </button>
                ))}
              </div>
              {errors.stage && <span className="form-error">{errors.stage}</span>}
            </div>
          </section>

          {/* Section 3: What You're Looking For */}
          <section className="form-section">
            <div className="section-header">
              <span className="section-number">3</span>
              <div>
                <h2 className="section-title">What You're Looking For</h2>
                <p className="section-subtitle">Who do you need on your team?</p>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Roles Needed *</label>
              <p className="form-sublabel">Select all that apply</p>
              <div className="roles-grid">
                {ROLES.map(role => (
                  <button
                    key={role.id}
                    type="button"
                    className={`role-chip ${formData.roles.includes(role.id) ? 'selected' : ''}`}
                    onClick={() => toggleArrayItem('roles', role.id)}
                    style={{
                      '--role-color': role.color,
                    }}
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
              {errors.roles && <span className="form-error">{errors.roles}</span>}
            </div>

            <div className="form-group">
              <label className="form-label">Skills (optional)</label>
              <p className="form-sublabel">Specific technologies or expertise</p>
              <div className="skills-grid">
                {SKILLS.map(skill => (
                  <button
                    key={skill}
                    type="button"
                    className={`skill-chip ${formData.skills.includes(skill) ? 'selected' : ''}`}
                    onClick={() => toggleArrayItem('skills', skill)}
                  >
                    {skill}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label">Commitment Level *</label>
              <div className="commitment-grid">
                {COMMITMENTS.map(commit => (
                  <button
                    key={commit.id}
                    type="button"
                    className={`commitment-card ${formData.commitment === commit.id ? 'selected' : ''}`}
                    onClick={() => updateField('commitment', commit.id)}
                  >
                    <div className="commitment-header">
                      <span className="commitment-label">{commit.label}</span>
                      <span className="commitment-hours">{commit.hours}</span>
                    </div>
                    <span className="commitment-description">{commit.description}</span>
                  </button>
                ))}
              </div>
              {errors.commitment && <span className="form-error">{errors.commitment}</span>}
            </div>
          </section>

          {/* Section 4: Visibility */}
          <section className="form-section">
            <div className="section-header">
              <span className="section-number">4</span>
              <div>
                <h2 className="section-title">Visibility</h2>
                <p className="section-subtitle">Choose who can see your project</p>
              </div>
            </div>

            <div className="visibility-toggle">
              <div className="toggle-content">
                <div className="toggle-icon">
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#5B4AE6" strokeWidth="2">
                    <circle cx="12" cy="12" r="10"/>
                    <polygon points="16.24,7.76 14.12,14.12 7.76,16.24 9.88,9.88"/>
                  </svg>
                </div>
                <div className="toggle-text">
                  <span className="toggle-label">Publish to Discover</span>
                  <span className="toggle-description">
                    Your project will appear in Discover for other students to find and join
                  </span>
                </div>
              </div>
              <button
                type="button"
                className={`toggle-switch ${formData.publishToDiscover ? 'active' : ''}`}
                onClick={() => updateField('publishToDiscover', !formData.publishToDiscover)}
              >
                <span className="toggle-knob" />
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
          </section>

          {/* Submit Section */}
          <div className="submit-section">
            <div className="submit-preview">
              <h3>Ready to publish?</h3>
              <p>Your project will be visible to students across NYC universities.</p>
            </div>
            
            <button
              type="button"
              className="submit-button"
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
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                  Create Project
                </>
              )}
            </button>

            <button
              type="button"
              className="cancel-button"
              onClick={() => navigate(-1)}
            >
              Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}

// Helper function to get a project image based on category
function getProjectImage(category) {
  const images = {
    'startup': 'https://images.unsplash.com/photo-1552664730-d307ca884978?w=600&h=800&fit=crop',
    'class-project': 'https://images.unsplash.com/photo-1517048676732-d65bc937f952?w=600&h=800&fit=crop',
    'hackathon': 'https://images.unsplash.com/photo-1504384308090-c894fdcc538d?w=600&h=800&fit=crop',
    'side-project': 'https://images.unsplash.com/photo-1522071820081-009f0129c71c?w=600&h=800&fit=crop',
    'research': 'https://images.unsplash.com/photo-1620712943543-bcc4688e7485?w=600&h=800&fit=crop',
  }
  return images[category] || images['side-project']
}

export default CreateProjectScreen





