/**
 * Storage Service
 * Handles file uploads to Supabase Storage
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AVATAR_BUCKET = 'avatars'

/**
 * Current authenticated user's id, or null. Storage RLS scopes every write to a
 * `<uid>/` folder (migration 20260602000003), so uploads must live under the
 * uploader's own uid folder or they're rejected.
 */
async function authUid() {
  try {
    const { data } = await supabase.auth.getUser()
    return data?.user?.id || null
  } catch {
    return null
  }
}

export const storageService = {
  /**
   * Upload an avatar image
   * @param {string} userId - The user's UUID
   * @param {File} file - The image file to upload
   * @returns {Promise<{url: string|null, error: object|null}>}
   */
  async uploadAvatar(userId, file) {
    if (!isSupabaseConfigured() || !supabase) {
      return { url: null, error: { message: 'Supabase not configured' } }
    }

    if (!file) {
      return { url: null, error: { message: 'No file provided' } }
    }

    // Validate file type
    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return { url: null, error: { message: 'Invalid file type. Please use JPG, PNG, GIF, or WebP.' } }
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024
    if (file.size > maxSize) {
      return { url: null, error: { message: 'File too large. Maximum size is 5MB.' } }
    }

    try {
      const uid = await authUid()
      if (!uid) return { url: null, error: { message: 'You must be signed in to upload.' } }
      // RLS scopes writes to the uploader's own folder: <uid>/<file>
      const fileExt = file.name.split('.').pop()
      const filePath = `${uid}/${Date.now()}.${fileExt}`

      // Upload to Supabase Storage
      const { data, error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: true
        })

      if (uploadError) {
        console.error('Upload error:', uploadError)
        return { url: null, error: uploadError }
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(filePath)

      return { url: publicUrl, error: null }
    } catch (err) {
      console.error('Avatar upload error:', err)
      return { url: null, error: err }
    }
  },

  /**
   * Upload a profile photo for the multi-photo gallery (up to 3 slots).
   * Reuses the `avatars` bucket — filename is prefixed so we can identify
   * gallery uploads vs. legacy single-avatar uploads.
   * @param {string} userId - The user's UUID
   * @param {File} file - The image file to upload
   * @param {number} slot - 0..2 — which gallery slot this photo occupies
   * @returns {Promise<{url: string|null, error: object|null}>}
   */
  async uploadProfilePhoto(userId, file, slot = 0) {
    if (!isSupabaseConfigured() || !supabase) {
      return { url: null, error: { message: 'Supabase not configured' } }
    }
    if (!file) return { url: null, error: { message: 'No file provided' } }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return { url: null, error: { message: 'Invalid file type. Please use JPG, PNG, GIF, or WebP.' } }
    }
    if (file.size > 5 * 1024 * 1024) {
      return { url: null, error: { message: 'File too large. Maximum size is 5MB.' } }
    }

    try {
      const uid = await authUid()
      if (!uid) return { url: null, error: { message: 'You must be signed in to upload.' } }
      const fileExt = file.name.split('.').pop()
      const fileName = `${uid}/photo-${slot}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(fileName, file, { cacheControl: '3600', upsert: true })

      if (uploadError) {
        console.error('Profile photo upload error:', uploadError)
        return { url: null, error: uploadError }
      }

      const { data: { publicUrl } } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(fileName)

      return { url: publicUrl, error: null }
    } catch (err) {
      console.error('Profile photo upload error:', err)
      return { url: null, error: err }
    }
  },

  /**
   * Delete an avatar image
   * @param {string} filePath - The file path in storage
   * @returns {Promise<{error: object|null}>}
   */
  async deleteAvatar(filePath) {
    if (!isSupabaseConfigured() || !supabase) {
      return { error: { message: 'Supabase not configured' } }
    }

    try {
      const { error } = await supabase.storage
        .from(AVATAR_BUCKET)
        .remove([filePath])

      return { error }
    } catch (err) {
      console.error('Avatar delete error:', err)
      return { error: err }
    }
  },

  /**
   * Upload a project icon image
   * @param {string} projectId - The project's ID
   * @param {File} file - The image file to upload
   * @returns {Promise<{url: string|null, error: object|null}>}
   */
  async uploadProjectIcon(projectId, file) {
    if (!isSupabaseConfigured() || !supabase) {
      return { url: null, error: { message: 'Supabase not configured' } }
    }

    if (!file) {
      return { url: null, error: { message: 'No file provided' } }
    }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return { url: null, error: { message: 'Invalid file type. Please use JPG, PNG, GIF, or WebP.' } }
    }

    const maxSize = 2 * 1024 * 1024
    if (file.size > maxSize) {
      return { url: null, error: { message: 'File too large. Maximum size is 2MB.' } }
    }

    try {
      const uid = await authUid()
      if (!uid) return { url: null, error: { message: 'You must be signed in to upload.' } }
      const fileExt = file.name.split('.').pop()
      const fileName = `${uid}/project-${projectId}-${Date.now()}.${fileExt}`

      const { data, error: uploadError } = await supabase.storage
        .from('project-icons')
        .upload(fileName, file, { cacheControl: '3600', upsert: true })

      if (uploadError) {
        console.error('Project icon upload error:', uploadError)
        return { url: null, error: uploadError }
      }

      const { data: { publicUrl } } = supabase.storage
        .from('project-icons')
        .getPublicUrl(fileName)

      return { url: publicUrl, error: null }
    } catch (err) {
      console.error('Project icon upload error:', err)
      return { url: null, error: err }
    }
  },

  /**
   * Upload a logo for an organization. Reuses the public `avatars` bucket.
   * @param {string} orgIdOrTempKey - The org's UUID, or a temp key if pre-create
   * @param {File} file - The image file to upload
   * @returns {Promise<{url: string|null, error: object|null}>}
   */
  async uploadOrgLogo(orgIdOrTempKey, file) {
    if (!isSupabaseConfigured() || !supabase) {
      return { url: null, error: { message: 'Supabase not configured' } }
    }
    if (!file) return { url: null, error: { message: 'No file provided' } }

    const validTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
    if (!validTypes.includes(file.type)) {
      return { url: null, error: { message: 'Invalid file type. Please use JPG, PNG, GIF, or WebP.' } }
    }
    if (file.size > 5 * 1024 * 1024) {
      return { url: null, error: { message: 'File too large. Maximum size is 5MB.' } }
    }

    try {
      const uid = await authUid()
      if (!uid) return { url: null, error: { message: 'You must be signed in to upload.' } }
      const fileExt = file.name.split('.').pop()
      const fileName = `${uid}/org-${orgIdOrTempKey}-${Date.now()}.${fileExt}`

      const { error: uploadError } = await supabase.storage
        .from(AVATAR_BUCKET)
        .upload(fileName, file, { cacheControl: '3600', upsert: true })

      if (uploadError) return { url: null, error: uploadError }

      const { data: { publicUrl } } = supabase.storage
        .from(AVATAR_BUCKET)
        .getPublicUrl(fileName)
      return { url: publicUrl, error: null }
    } catch (err) {
      return { url: null, error: err }
    }
  },

  /**
   * Convert a file to base64 data URL (for localStorage fallback)
   * @param {File} file - The image file
   * @returns {Promise<string>}
   */
  async fileToDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }
}

export default storageService
