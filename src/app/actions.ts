// src/app/actions.ts
// Barrel file — re-exports all server actions from domain modules.
// Existing imports from '@/app/actions' continue to work without changes.

export { inviteAdmin, inviteAdminToCompany, inviteCollaborator, deleteCollaborator, inviteStrategist, deleteStrategist, assignCompaniesToStrategist, inviteThoughtLeader, invitePendingThoughtLeader, deleteThoughtLeader, updateCollaboratorProfile, toggleCollaboratorStatus, saveNotificationPrefs, getNotificationPrefs } from './actions/users';
export { handleAlignContent, toggleStarContent, generateHooks, generateWithHook } from './actions/content';
export { submitMissionProof, completeMissionSelf, reviewMissionProof } from './actions/missions';
export { redeemReward, markRescueAsPaid } from './actions/rewards';
export { getCompanyRanking, recalculatePoints, type RankedUser } from './actions/points';
export { createScheduledPost, updateScheduledPost, deleteScheduledPost, getScheduledPosts, type ScheduledPost } from './actions/posts';
export { createPipelinePost, updatePipelinePost, deletePipelinePost, getPipelinePosts, approvePipelineIdea, approvePipelinePost, requestPipelineAdjustment, resolvePipelineAdjustment, markPipelinePostPublished, getAllPipelinePostsForStrategist, getRecentActivitiesForStrategist, getStrategistSidebarData, type PipelinePost, type PipelineStatus, type CalendarPipelinePost, type StrategistSidebarCompany, type Activity } from './actions/content-pipeline';
export { saveContentStrategy, getContentStrategy, saveBrandManual, getBrandManual, getCompanyBrandContext, saveCompanyBrandContext, type ContentStrategyData, type BrandManualData, type BrandContextData } from './actions/content-strategy';
export { getSlackChannels, getSlackConfig, saveSlackConfig, testSlackNotification } from './actions/slack';
