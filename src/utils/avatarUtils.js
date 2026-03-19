/**
 * Avatar Utilities
 * Generates initials-based avatar URLs as fallback for missing profile pictures
 */

export function getInitialsAvatar(name, size = 100) {
  const displayName = name || 'User'
  return `https://ui-avatars.com/api/?background=5B4AE6&color=fff&name=${encodeURIComponent(displayName)}&size=${size}&font-size=0.4&bold=true`
}
