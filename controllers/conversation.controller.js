import Conversation from '../models/Conversation.js';
import Message from '../models/Message.js';

// @desc    Get all conversations for logged in user
// @route   GET /api/conversations
// @access  Private
export const getConversations = async (req, res) => {
  try {
    const conversations = await Conversation.find({
      participants: req.user._id,
    })
      .populate('participants', '-password')
      .populate('lastMessage')
      .sort({ updatedAt: -1 });

    res.status(200).json({
      success: true,
      count: conversations.length,
      data: conversations,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create or get one-to-one conversation
// @route   POST /api/conversations
// @access  Private
export const createConversation = async (req, res) => {
  try {
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        message: 'User ID is required',
      });
    }

    // Check if conversation already exists
    let conversation = await Conversation.findOne({
      isGroupChat: false,
      participants: { $all: [req.user._id, userId] },
    })
      .populate('participants', '-password')
      .populate('lastMessage');

    if (conversation) {
      return res.status(200).json({
        success: true,
        data: conversation,
      });
    }

    // Create new conversation
    conversation = await Conversation.create({
      participants: [req.user._id, userId],
      isGroupChat: false,
    });

    conversation = await conversation.populate('participants', '-password');

    res.status(201).json({
      success: true,
      message: 'Conversation created successfully',
      data: conversation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Create group conversation
// @route   POST /api/conversations/group
// @access  Private
export const createGroupConversation = async (req, res) => {
  try {
    const { participants, groupName } = req.body;

    if (!participants || participants.length < 2) {
      return res.status(400).json({
        success: false,
        message: 'Group must have at least 2 participants',
      });
    }

    if (!groupName) {
      return res.status(400).json({
        success: false,
        message: 'Group name is required',
      });
    }

    // Add current user to participants
    const allParticipants = [...participants, req.user._id];

    const conversation = await Conversation.create({
      participants: allParticipants,
      isGroupChat: true,
      groupName,
      groupAdmin: req.user._id,
    });

    await conversation.populate('participants', '-password');

    res.status(201).json({
      success: true,
      message: 'Group conversation created successfully',
      data: conversation,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete conversation
// @route   DELETE /api/conversations/:id
// @access  Private
export const deleteConversation = async (req, res) => {
  try {
    const conversation = await Conversation.findById(req.params.id);

    if (!conversation) {
      return res.status(404).json({
        success: false,
        message: 'Conversation not found',
      });
    }

    // Delete all messages in conversation
    await Message.deleteMany({ conversation: conversation._id });

    // Delete conversation
    await conversation.deleteOne();

    res.status(200).json({
      success: true,
      message: 'Conversation deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
