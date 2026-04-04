// src/app/actions.ts
// Barrel file — re-exports all server actions from domain modules.
// Existing imports from '@/app/actions' continue to work without changes.

export { inviteAdmin, inviteCollaborator, deleteCollaborator } from './actions/users';
export { handleAlignContent, toggleStarContent } from './actions/content';
export { submitMissionProof, completeMissionSelf, reviewMissionProof } from './actions/missions';
export { redeemReward, markRescueAsPaid } from './actions/rewards';
export { getCompanyRanking, recalculatePoints, type RankedUser } from './actions/points';
