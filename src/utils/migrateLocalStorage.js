/**
 * Migration Utility
 * Migrates localStorage profile and projects to Supabase
 * Run this once for users who have data in localStorage but not in Supabase
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'
import { profileService } from '../services/profileService'
import { projectService } from '../services/projectService'

const PROFILE_STORAGE_KEY = 'nested_user_profile'
const PROJECTS_STORAGE_KEY = 'nested_user_projects'

/**
 * Migrate localStorage data to Supabase for the current user
 * @returns {Promise<{success: boolean, profile: boolean, projects: number, errors: string[]}>}
 */
export async function migrateLocalStorageToSupabase() {
  const result = {
    success: false,
    profile: false,
    projects: 0,
    errors: []
  }

  // Check Supabase is configured
  if (!isSupabaseConfigured() || !supabase) {
    result.errors.push('Supabase not configured')
    return result
  }

  // Get current user
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError || !user) {
    result.errors.push('Not authenticated - please sign in first')
    return result
  }

  console.log('🔄 Starting migration for user:', user.id)

  // Migrate Profile
  try {
    const profileJson = localStorage.getItem(PROFILE_STORAGE_KEY)
    if (profileJson) {
      const localProfile = JSON.parse(profileJson)
      console.log('📋 Found localStorage profile:', localProfile)

      // Transform to DB format
      const dbProfile = {
        first_name: localProfile.firstName || null,
        last_name: localProfile.lastName || null,
        university: localProfile.university || null,
        bio: localProfile.bio || null,
        fields: localProfile.fields || [],
        looking_for: localProfile.lookingFor || [],
        skills: localProfile.skills || [],
        projects: localProfile.projects || [],
        links: localProfile.links || {},
        avatar: localProfile.avatar || null,
        onboarding_completed: true
      }

      const { error: profileError } = await profileService.updateProfile(user.id, dbProfile)

      if (profileError) {
        result.errors.push('Profile migration failed: ' + profileError.message)
        console.error('❌ Profile migration failed:', profileError)
      } else {
        result.profile = true
        console.log('✅ Profile migrated successfully')
      }
    } else {
      console.log('ℹ️ No localStorage profile found')
    }
  } catch (err) {
    result.errors.push('Profile migration error: ' + err.message)
    console.error('❌ Profile migration error:', err)
  }

  // Migrate Projects
  try {
    const projectsJson = localStorage.getItem(PROJECTS_STORAGE_KEY)
    if (projectsJson) {
      const localProjects = JSON.parse(projectsJson)
      console.log('📋 Found localStorage projects:', localProjects.length)

      // Get user profile for author info
      const { data: profile } = await supabase
        .from('profiles')
        .select('first_name, last_name, avatar, university')
        .eq('id', user.id)
        .single()

      const authorName = profile
        ? `${profile.first_name || ''} ${profile.last_name || ''}`.trim() || 'You'
        : 'You'

      for (const project of localProjects) {
        try {
          // Transform to DB format
          const dbProject = {
            name: project.name || project.title || 'Untitled Project',
            tagline: project.tagline || null,
            description: project.description || null,
            category: project.category || 'side-project',
            image: project.image || null,
            university: profile?.university || project.university || null,
            author_name: authorName,
            author_image: profile?.avatar || project.authorImage || null,
            roles: project.roles || [],
            skills: project.skills || [],
            commitment: project.commitment || null,
            publish_to_discover: project.publishToDiscover !== false,
            spots_left: project.spotsLeft || project.roles?.length || 0
          }

          const { error: projectError } = await projectService.createProject(dbProject)

          if (projectError) {
            result.errors.push(`Project "${dbProject.name}" failed: ${projectError.message}`)
            console.error('❌ Project migration failed:', dbProject.name, projectError)
          } else {
            result.projects++
            console.log('✅ Project migrated:', dbProject.name)
          }
        } catch (projErr) {
          result.errors.push(`Project error: ${projErr.message}`)
        }
      }
    } else {
      console.log('ℹ️ No localStorage projects found')
    }
  } catch (err) {
    result.errors.push('Projects migration error: ' + err.message)
    console.error('❌ Projects migration error:', err)
  }

  result.success = result.errors.length === 0

  console.log('\n📊 Migration complete:', result)
  return result
}

/**
 * Check what data exists in localStorage
 */
export function checkLocalStorageData() {
  const profile = localStorage.getItem(PROFILE_STORAGE_KEY)
  const projects = localStorage.getItem(PROJECTS_STORAGE_KEY)

  return {
    hasProfile: !!profile,
    profile: profile ? JSON.parse(profile) : null,
    hasProjects: !!projects,
    projects: projects ? JSON.parse(projects) : [],
    projectCount: projects ? JSON.parse(projects).length : 0
  }
}

// Expose to window for console access
if (typeof window !== 'undefined') {
  window.migrateToSupabase = migrateLocalStorageToSupabase
  window.checkLocalData = checkLocalStorageData
}
