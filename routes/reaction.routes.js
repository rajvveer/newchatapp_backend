import express from 'express';
import { protect } from '../middleware/auth.middleware.js';
import { addReaction, removeReaction } from '../controllers/reaction.controller.js';

const router = express.Router();

router.post('/:messageId/reactions', protect, addReaction);
router.delete('/:messageId/reactions/:emoji', protect, removeReaction);

export default router;
