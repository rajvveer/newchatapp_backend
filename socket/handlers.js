import Message from '../models/Message.js';
import Conversation from '../models/Conversation.js';

export const handleSocketEvents = (io, socket) => {
  // Join conversation room
  socket.on('conversation:join', (conversationId) => {
    socket.join(conversationId);
    console.log(`User ${socket.userId} joined conversation ${conversationId}`);
  });

  // Leave conversation room
  socket.on('conversation:leave', (conversationId) => {
    socket.leave(conversationId);
    console.log(`User ${socket.userId} left conversation ${conversationId}`);
  });

  // Send message with reply support - FIXED
  socket.on('message:send', async (payload) => {
    try {
      // Accept payload object from client
      const { conversationId, content = '', messageType = 'text', replyTo = null, mediaUrl = null } = payload || {};

      console.log('📩 Received message:', { conversationId, messageType, replyTo });

      // Create message - include replyTo if provided
      const message = await Message.create({
        sender: socket.userId,
        conversation: conversationId,
        content: content || '',
        messageType,
        mediaUrl: mediaUrl || null,
        replyTo: replyTo || null,
      });

      // Update conversation last message and timestamp
      await Conversation.findByIdAndUpdate(conversationId, {
        lastMessage: message._id,
        updatedAt: Date.now(),
      });

      // Populate sender and replyTo sender info before emitting
      await message.populate('sender', 'username avatar');
      if (message.replyTo) {
        await message.populate({
          path: 'replyTo',
          populate: { path: 'sender', select: 'username avatar' },
        });
      }

      console.log('✅ Message created and populated:', message._id);

      // Emit the newly created (and populated) message to the conversation room
      io.to(conversationId).emit('message:received', {
        success: true,
        data: message,
      });
    } catch (err) {
      console.error('❌ Socket message send error:', err);
      socket.emit('message:error', { success: false, message: err.message });
    }
  });

  // Typing indicators
  socket.on('typing:start', ({ conversationId, username }) => {
    socket.to(conversationId).emit('typing:start', {
      userId: socket.userId,
      conversationId,
      username,
    });
  });

  socket.on('typing:stop', ({ conversationId }) => {
    socket.to(conversationId).emit('typing:stop', {
      userId: socket.userId,
      conversationId,
    });
  });

  // MESSAGE REACTIONS
  socket.on('message:react', async ({ messageId, emoji, conversationId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        return socket.emit('message:error', { error: 'Message not found' });
      }

      // Toggle reaction
      const existingReaction = message.reactions.find(
        (r) => r.user.toString() === socket.userId && r.emoji === emoji
      );

      if (existingReaction) {
        message.reactions = message.reactions.filter(
          (r) => !(r.user.toString() === socket.userId && r.emoji === emoji)
        );
      } else {
        message.reactions.push({
          emoji,
          user: socket.userId,
        });
      }

      await message.save();
      await message.populate('reactions.user', 'username avatar');

      // Emit to all users in conversation
      io.to(conversationId).emit('message:reaction', {
        messageId,
        reactions: message.reactions,
      });

      console.log(`✅ Reaction ${emoji} ${existingReaction ? 'removed' : 'added'}`);
    } catch (error) {
      console.error('❌ Error with reaction:', error);
      socket.emit('message:error', { error: 'Failed to add reaction' });
    }
  });

  // CALL EVENTS
  socket.on('call:initiate', ({ conversationId, callType, receiverId, callerInfo }) => {
    console.log(`📞 Call initiated: ${callType} from ${socket.userId} to ${receiverId}`);
    io.to(conversationId).emit('call:incoming', {
      callType,
      from: socket.userId,
      callerInfo,
      conversationId,
    });
  });

  socket.on('call:accept', ({ conversationId, callerId }) => {
    console.log(`✅ Call accepted in conversation ${conversationId}`);
    io.to(conversationId).emit('call:accepted', {
      from: socket.userId,
      conversationId,
    });
  });

  socket.on('call:reject', ({ conversationId, callerId }) => {
    console.log(`❌ Call rejected in conversation ${conversationId}`);
    io.to(conversationId).emit('call:rejected', {
      from: socket.userId,
      conversationId,
    });
  });

  socket.on('call:end', ({ conversationId }) => {
    console.log(`📴 Call ended in conversation ${conversationId}`);
    io.to(conversationId).emit('call:ended', {
      from: socket.userId,
      conversationId,
    });
  });

  // WEBRTC SIGNALING
  socket.on('webrtc:signal', ({ signal, to, from, conversationId }) => {
    console.log(`📡 WebRTC signal from ${from} to ${to}`);
    io.to(conversationId).emit('webrtc:signal', { signal, from });
  });

  // Delete message
  socket.on('message:delete', async ({ messageId, conversationId }) => {
    try {
      const message = await Message.findById(messageId);
      if (!message) {
        return socket.emit('message:error', { error: 'Message not found' });
      }

      if (message.sender.toString() !== socket.userId) {
        return socket.emit('message:error', {
          error: 'Not authorized to delete this message'
        });
      }

      await message.deleteOne();
      io.to(conversationId).emit('message:deleted', { messageId });
      console.log(`🗑️ Message ${messageId} deleted`);
    } catch (error) {
      console.error('Error deleting message:', error);
      socket.emit('message:error', { error: 'Failed to delete message' });
    }
  });

  // Mark messages as read
  socket.on('messages:read', async ({ conversationId }) => {
    try {
      await Message.updateMany(
        {
          conversation: conversationId,
          sender: { $ne: socket.userId },
          readBy: { $ne: socket.userId },
        },
        { $push: { readBy: socket.userId } }
      );

      socket.to(conversationId).emit('messages:read', {
        conversationId,
        userId: socket.userId,
      });
    } catch (error) {
      console.error('Error marking messages as read:', error);
    }
  });
};
