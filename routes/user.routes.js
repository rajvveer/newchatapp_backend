import express from 'express';
import {
  getUsers,
  searchUsers,
  updateProfile,
  uploadAvatar,
  getUserById,
  followUser,      // Add
  unfollowUser,    // Add
  getUserFollowers,  // Add
  getUserFollowing,  // Add
} from '../controllers/user.controller.js';
import { protect } from '../middleware/auth.middleware.js';
import { upload } from '../middleware/upload.middleware.js';

const router = express.Router();

router.get('/', protect, getUsers);
router.get('/search', protect, searchUsers);
router.get('/:id', protect, getUserById);
router.put('/profile', protect, updateProfile);
router.post('/avatar', protect, upload.single('avatar'), uploadAvatar);

// NEW ROUTES
router.post('/:userId/follow', protect, followUser);
router.delete('/:userId/follow', protect, unfollowUser);
router.get('/:userId/followers', protect, getUserFollowers);
router.get('/:userId/following', protect, getUserFollowing);

export default router;
