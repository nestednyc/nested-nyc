/**
 * Services Index
 * Export all services from a single entry point
 */

export { profileService } from './profileService'
export { projectService } from './projectService'
export { eventService } from './eventService'
export { lookupService } from './lookupService'
export { orgService } from './orgService'

// Also export as default object for convenient importing
import { profileService } from './profileService'
import { projectService } from './projectService'
import { eventService } from './eventService'
import { lookupService } from './lookupService'
import { orgService } from './orgService'

export default {
  profile: profileService,
  project: projectService,
  event: eventService,
  lookup: lookupService,
  org: orgService
}
