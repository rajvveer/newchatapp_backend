import express from 'express';
import {
  getMessages,
  sendMessage,
  markAsRead,
  deleteMessage,
} from '../controllers/message.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';

const router = express.Router();

router.get('/:conversationId', protect, getMessages);
router.post('/', protect, upload.single('media'), sendMessage);
router.put('/read/:conversationId', protect, markAsRead);
router.delete('/:id', protect, deleteMessage);

export default router;
