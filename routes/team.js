const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/auth');
const { financialLimiter } = require('../middleware/rateLimiter');

const {
  createTeam,
  joinTeam,
  acceptJoinRequest,
  rejectJoinRequest,
  promoteMember,
  demoteMember,
  updateMemberRole,
  getMyPendingRequests,
  cancelJoinRequest,
  updateTeamSettings,
  testDiscordWebhook,
  leaveTeam,
  kickMember,
  deleteTeam,
  getTeams,
  getTeamById
} = require('../controllers/teamController');

const {
  deposit,
  withdraw,
  recordLobby,
  settleLobby,
  deleteTransaction,
  editTransaction
} = require('../controllers/walletController');

const {
  recordPayout,
  addCustomMember,
  removeCustomMember
} = require('../controllers/rosterController');

const {
  addTournament,
  updateTournament,
  deleteTournament
} = require('../controllers/tournamentController');

// 1. Team Management & Details
router.post('/create', authMiddleware, createTeam);
router.post('/join', authMiddleware, joinTeam);
router.get('/my-requests', authMiddleware, getMyPendingRequests);
router.post('/cancel-request', authMiddleware, cancelJoinRequest);
router.put('/settings', authMiddleware, updateTeamSettings);
router.post('/webhook/test', authMiddleware, testDiscordWebhook);
router.post('/leave', authMiddleware, leaveTeam);
router.post('/kick', authMiddleware, kickMember);
router.delete('/:teamId/disband', authMiddleware, deleteTeam);
router.get('/', authMiddleware, getTeams);
router.get('/:teamId', authMiddleware, getTeamById);

// 2. Join Requests & Role Management
router.post('/join-requests/accept', authMiddleware, acceptJoinRequest);
router.post('/join-requests/reject', authMiddleware, rejectJoinRequest);
router.put('/members/promote', authMiddleware, promoteMember);
router.put('/members/demote', authMiddleware, demoteMember);
router.put('/member-role', authMiddleware, updateMemberRole);

// 3. Treasury & Match Scrim Transactions
router.post('/deposit', authMiddleware, financialLimiter, deposit);
router.post('/withdraw', authMiddleware, financialLimiter, withdraw);
router.post('/lobby', authMiddleware, financialLimiter, recordLobby);
router.put('/lobby/:transactionId', authMiddleware, settleLobby);
router.put('/transaction/:transactionId', authMiddleware, financialLimiter, editTransaction);
router.delete('/:transactionId', authMiddleware, deleteTransaction);

// 4. Roster & Payout Operations
router.post('/payout', authMiddleware, financialLimiter, recordPayout);
router.post('/custom-members', authMiddleware, addCustomMember);
router.delete('/custom-members/:memberId', authMiddleware, removeCustomMember);

// 5. Tournament Schedule Operations
router.post('/tournaments', authMiddleware, addTournament);
router.put('/tournaments/:tournamentId', authMiddleware, updateTournament);
router.delete('/tournaments/:tournamentId', authMiddleware, deleteTournament);

module.exports = router;