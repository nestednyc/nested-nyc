/**
 * Storage Service
 * Handles file uploads to Supabase Storage
 */

import { supabase, isSupabaseConfigured } from '../lib/supabase'

const AVATAR_BUCKET = 'avatars'

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
      // Create a unique filename
      const fileExt = file.name.split('.').pop()
      const fileName = `${userId}-${Date.now()}.${fileExt}`
      const filePath = `${fileName}`

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
      const fileExt = file.name.split('.').pop()
      const fileName = `project-${projectId}-${Date.now()}.${fileExt}`

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
