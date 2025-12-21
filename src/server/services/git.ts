// This file has been refactored into a modular structure
// All exports now come from the git/ directory

export type { GitConfig, PullResult, SyncChange, SyncPreview } from './git/index.js'

export {
  getGitConfig,
  saveGitConfig,
  getGitStatus,
  pullFromGit,
  previewPull,
  selectivePull,
  pushToGit,
  previewPush,
  selectivePush
} from './git/index.js'
