import prisma from "../utils/prisma.js";
import { success, error } from "../utils/response.js";

/**
 * POST /api/replies
 * Create a reply to a feedback message
 * Body: { message, feedbackId }
 */
async function createReply(req, res, next) {
  try {
    console.log('=== CREATE REPLY DEBUG ===');
    console.log('Request body:', req.body);
    console.log('User:', req.user);

    const { message, feedbackId } = req.body;

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    // Permission check - ADMIN, MANAGEMENT, or feedback author can reply
    const isManagement = req.user.role === 'ADMIN' || req.user.role === 'MANAGEMENT';
    
    if (!isManagement) {
      // If not management, check if user is the feedback author
      const feedback = await prisma.feedback.findUnique({
        where: { id: feedbackId },
        select: { authorId: true }
      });
      
      if (!feedback) {
        return error(res, "Feedback not found.", 404);
      }
      
      const isFeedbackAuthor = feedback.authorId === req.user.id;
      
      if (!isFeedbackAuthor) {
        return error(res, "Access denied. Only management or the feedback author can reply.", 403);
      }
    }

    // Validation
    if (!message || !message.trim()) {
      return error(res, "Message is required.", 400);
    }
    if (!feedbackId) {
      return error(res, "Feedback ID is required.", 400);
    }

    // Verify feedback exists (already checked for permission, now get full details)
    const feedbackWithDetails = await prisma.feedback.findUnique({
      where: { id: feedbackId },
      include: {
        replies: {
          include: {
            author: {
              select: { id: true, name: true, email: true, department: true, role: true, avatarUrl: true }
            }
          }
        },
        author: {
          select: { id: true, name: true, email: true, department: true, role: true, avatarUrl: true }
        }
      },
    });

    if (!feedbackWithDetails) {
      return error(res, "Feedback not found.", 404);
    }

    console.log('Creating reply with data:', {
      message: message.trim(),
      feedbackId,
      authorId: req.user.id,
    });

    const reply = await prisma.reply.create({
      data: {
        message: message.trim(),
        feedbackId,
        authorId: req.user.id,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, department: true, role: true, avatarUrl: true },
        },
        feedback: {
          select: { id: true, message: true, productId: true }
        }
      },
    });

    console.log('Reply created:', reply.id);

    const response = {
      id: reply.id,
      message: reply.message,
      createdAt: reply.createdAt,
      author: reply.author ? {
        id: reply.author.id,
        name: reply.author.name || reply.author.email.split("@")[0],
        email: reply.author.email,
        department: reply.author.department,
        role: reply.author.role,
        avatarUrl: reply.author.avatarUrl,
      } : {
        id: null,
        name: "Unknown User",
        email: "unknown@neokred.tech",
        department: null,
        role: "EMPLOYEE",
        avatarUrl: null,
      },
      feedback: reply.feedback,
      isOwner: true,
      canDelete: true,
    };

    return success(res, response, 201);
  } catch (err) {
    console.error('Create reply error:', err);
    next(err);
  }
}

/**
 * DELETE /api/replies/:id
 * Delete a reply (author within 60 seconds or admin/management)
 */
async function deleteReply(req, res, next) {
  try {
    console.log('=== DELETE REPLY DEBUG ===');
    console.log('Params:', req.params);
    console.log('User:', req.user);

    const { id } = req.params;

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    if (!id) {
      return error(res, "Reply ID is required.", 400);
    }

    // Find existing reply
    const existingReply = await prisma.reply.findUnique({
      where: { id },
      select: { id: true, authorId: true, message: true, createdAt: true, feedbackId: true }
    });

    if (!existingReply) {
      return error(res, "Reply not found.", 404);
    }

    // Permission check
    const replyAge = new Date() - new Date(existingReply.createdAt);
    const canSelfDelete = existingReply.authorId === req.user.id && replyAge <= 60000; // 60 seconds
    const canAdminDelete = req.user.role === 'ADMIN' || req.user.role === 'MANAGEMENT';
    
    if (!canSelfDelete && !canAdminDelete) {
      return error(res, "Access denied. You can only delete your own replies within 60 seconds, or be an admin.", 403);
    }

    // Delete the reply
    await prisma.reply.delete({
      where: { id }
    });

    console.log('Reply deleted:', id);

    return success(res, { message: "Reply deleted successfully." });
  } catch (err) {
    console.error('Delete reply error:', err);
    next(err);
  }
}

/**
 * GET /api/replies/feedback/:feedbackId
 * Get all replies for a specific feedback
 */
async function getRepliesByFeedback(req, res, next) {
  try {
    console.log('=== GET REPLIES BY FEEDBACK DEBUG ===');
    console.log('Params:', req.params);
    console.log('User:', req.user);

    const { feedbackId } = req.params;

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    if (!feedbackId) {
      return error(res, "Feedback ID is required.", 400);
    }

    // Verify feedback exists
    const feedbackExists = await prisma.feedback.findUnique({
      where: { id: feedbackId }
    });
    if (!feedbackExists) {
      return error(res, "Feedback not found.", 404);
    }

    const replies = await prisma.reply.findMany({
      where: { feedbackId },
      orderBy: { createdAt: "asc" },
      include: {
        author: {
          select: { id: true, name: true, email: true, department: true, role: true, avatarUrl: true },
        },
        feedback: {
          select: { id: true, message: true }
        }
      },
    });

    console.log(`Found ${replies.length} replies for feedback ${feedbackId}`);

    // Process replies data with permission checks
    const now = new Date();
    const sanitized = replies.map((reply) => {
      const replyAge = now - new Date(reply.createdAt);
      const canDelete = reply.author?.id === req.user.id && replyAge <= 60000; // 60 seconds for self-deletion
      const canAdminDelete = req.user.role === 'ADMIN' || req.user.role === 'MANAGEMENT';
      
      return {
        id: reply.id,
        message: reply.message,
        createdAt: reply.createdAt,
        author: reply.author ? {
          id: reply.author.id,
          name: reply.author.name || reply.author.email.split("@")[0],
          email: reply.author.email,
          department: reply.author.department,
          role: reply.author.role,
          avatarUrl: reply.author.avatarUrl,
        } : {
          id: null,
          name: "Unknown User",
          email: "unknown@neokred.tech",
          department: null,
          role: "EMPLOYEE",
          avatarUrl: null,
        },
        feedback: reply.feedback,
        isOwner: reply.author?.id === req.user.id,
        canDelete: canDelete || canAdminDelete,
      };
    });

    return success(res, sanitized);
  } catch (err) {
    console.error('Get replies by feedback error:', err);
    next(err);
  }
}

export { createReply, deleteReply, getRepliesByFeedback };
