import express from 'express';
import {
  getConversations,
  createConversation,
  createGroupConversation,
  deleteConversation,
} from '../controllers/conversation.controller.js';
import { protect } from '../middleware/auth.middleware.js';

const router = express.Router();

router.get('/', protect, getConversations);
router.post('/', protect, createConversation);
router.post('/group', protect, createGroupConversation);
router.delete('/:id', protect, deleteConversation);

export default router;
