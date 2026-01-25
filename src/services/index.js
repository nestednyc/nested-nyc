/**
 * Services Index
 * Export all services from a single entry point
 */

export { profileService } from './profileService'
export { projectService } from './projectService'
export { nestService } from './nestService'
export { eventService } from './eventService'
export { lookupService } from './lookupService'

// Also export as default object for convenient importing
import { profileService } from './profileService'
import { projectService } from './projectService'
import { nestService } from './nestService'
import { eventService } from './eventService'
import { lookupService } from './lookupService'

export default {
  profile: profileService,
  project: projectService,
  nest: nestService,
  event: eventService,
  lookup: lookupService
}
