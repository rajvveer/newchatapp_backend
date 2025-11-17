import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';
import cloudinary, { isCloudinaryConfigured } from '../config/cloudinary.js';
import { getIO } from '../socket/socket.js'; // ⭐ Import getIO

// @desc    Get messages for a conversation
// @route   GET /api/messages/:conversationId
// @access  Private
export const getMessages = async (req, res) => {
  try {
    const { conversationId } = req.params;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 50;
    const skip = (page - 1) * limit;

    const messages = await Message.find({ conversation: conversationId })
      .populate('sender', 'username avatar')
      .populate({
        path: 'replyTo',
        populate: {
          path: 'sender',
          select: 'username avatar',
        },
      })
      .populate('reactions.user', 'username avatar')
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    const total = await Message.countDocuments({ conversation: conversationId });

    res.status(200).json({
      success: true,
      count: messages.length,
      total,
      page,
      pages: Math.ceil(total / limit),
      data: messages.reverse(),
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Send message
// @route   POST /api/messages
// @access  Private
export const sendMessage = async (req, res) => {
  try {
    const { conversationId, content, messageType, replyTo } = req.body;

    console.log('📥 Received message:', { conversationId, messageType, hasFile: !!req.file });

    if (!conversationId) {
      return res.status(400).json({
        success: false,
        message: 'Conversation ID is required',
      });
    }

    if (!content && !req.file) {
      return res.status(400).json({
        success: false,
        message: 'Message content or file is required',
      });
    }

    let mediaUrl = null;

    // Upload media if exists
    if (req.file) {
      if (!isCloudinaryConfigured()) {
        console.error('❌ Cloudinary not configured');
        return res.status(500).json({
          success: false,
          message: 'Media upload is not configured.',
        });
      }

      try {
        console.log('☁️ Uploading to Cloudinary...', {
          messageType,
          fileType: req.file.mimetype,
          fileSize: req.file.size
        });

        let uploadOptions = {
          folder: 'chat-app/messages',
          resource_type: 'auto'
        };

        if (messageType === 'image') {
          uploadOptions.resource_type = 'image';
          uploadOptions.transformation = [
            { width: 800, crop: 'limit' },
            { quality: 'auto:good' }
          ];
        } else if (messageType === 'video') {
          uploadOptions.resource_type = 'video';
        } else if (messageType === 'audio') {
          uploadOptions.resource_type = 'video';
        }

        const result = await new Promise((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            uploadOptions,
            (error, result) => {
              if (error) {
                reject(error);
              } else {
                resolve(result);
              }
            }
          );
          uploadStream.end(req.file.buffer);
        });
        
        mediaUrl = result.secure_url;
        console.log('✅ Upload successful:', mediaUrl);
        
      } catch (uploadError) {
        console.error('❌ Media upload failed:', uploadError);
        return res.status(500).json({
          success: false,
          message: `Failed to upload media: ${uploadError.message}`,
        });
      }
    }

    // Create message
    const message = await Message.create({
      sender: req.user._id,
      conversation: conversationId,
      content: content || mediaUrl || '',
      messageType: messageType || 'text',
      mediaUrl,
      replyTo: replyTo || null,
    });

    // Update conversation
    await Conversation.findByIdAndUpdate(conversationId, {
      lastMessage: message._id,
      updatedAt: Date.now(),
    });

    // Populate sender and replyTo
    await message.populate('sender', 'username avatar');
    if (message.replyTo) {
      await message.populate({
        path: 'replyTo',
        populate: {
          path: 'sender',
          select: 'username avatar',
        },
      });
    }

    console.log('✅ Message created:', message._id);

    // ⭐⭐⭐ CRITICAL: Emit via Socket.IO using getIO()
    try {
      const io = getIO();
      io.to(conversationId).emit('message:received', {
        success: true,
        data: message,
      });
      console.log('📡 Socket emitted to conversation:', conversationId);
    } catch (socketError) {
      console.error('❌ Socket emit error:', socketError);
    }

    res.status(201).json({
      success: true,
      message: 'Message sent successfully',
      data: message,
    });
  } catch (error) {
    console.error('❌ Send message error:', error);
    res.status(500).json({
      success: false,
      message: error.message || 'Failed to send message',
    });
  }
};

// @desc    Mark messages as read
// @route   PUT /api/messages/read/:conversationId
// @access  Private
export const markAsRead = async (req, res) => {
  try {
    const { conversationId } = req.params;

    await Message.updateMany(
      {
        conversation: conversationId,
        sender: { $ne: req.user._id },
        readBy: { $ne: req.user._id },
      },
      { $push: { readBy: req.user._id } }
    );

    res.status(200).json({
      success: true,
      message: 'Messages marked as read',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};

// @desc    Delete message
// @route   DELETE /api/messages/:id
// @access  Private
export const deleteMessage = async (req, res) => {
  try {
    const message = await Message.findById(req.params.id);

    if (!message) {
      return res.status(404).json({
        success: false,
        message: 'Message not found',
      });
    }

    if (message.sender.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'Not authorized to delete this message',
      });
    }

    // Delete from Cloudinary if it has media
    if (message.mediaUrl && isCloudinaryConfigured()) {
      try {
        const urlParts = message.mediaUrl.split('/');
        const publicIdWithExtension = urlParts[urlParts.length - 1];
        const publicId = `chat-app/messages/${publicIdWithExtension.split('.')[0]}`;
        
        await cloudinary.uploader.destroy(publicId);
      } catch (cloudinaryError) {
        console.error('Failed to delete from Cloudinary:', cloudinaryError);
      }
    }

    await message.deleteOne();

    // ⭐ Also emit socket event for real-time deletion
    try {
      const io = getIO();
      io.to(message.conversation.toString()).emit('message:deleted', {
        messageId: message._id,
      });
      console.log('📡 Message deletion emitted');
    } catch (socketError) {
      console.error('❌ Socket emit error:', socketError);
    }

    res.status(200).json({
      success: true,
      message: 'Message deleted successfully',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: error.message,
    });
  }
};
