import prisma from "../utils/prisma.js";
import { success, error } from "../utils/response.js";
import { buildDateFilter, validateDateQuery, getMonthBoundaries, formatDateString, getMonthDates } from "../utils/dateUtils.js";

/**
 * GET /api/feedback/me
 * Get current authenticated user information
 */
async function getCurrentUser(req, res, next) {
  try {
    console.log('=== GET CURRENT USER DEBUG ===');
    console.log('User:', req.user);

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    const user = await prisma.user.findUnique({
      where: { id: req.user.id },
      select: {
        id: true,
        name: true,
        email: true,
        department: true,
        role: true,
        avatarUrl: true,
        isVerified: true,
        createdAt: true
      }
    });

    if (!user) {
      return error(res, "User not found.", 404);
    }

    return success(res, user);
  } catch (err) {
    console.error('Get current user error:', err);
    next(err);
  }
}

/**
 * GET /api/feedback?productId=xxx&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&date=YYYY-MM-DD
 * Get all feedback for a product with nested replies
 * Supports date filtering with startDate/endDate or single date
 */
async function getFeedback(req, res, next) {
  try {
    console.log('=== GET FEEDBACK DEBUG ===');
    console.log('Query params:', req.query);
    console.log('User:', req.user);

    const { productId, startDate, endDate, date } = req.query;

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    if (!productId) {
      return error(res, "Product ID is required.", 400);
    }

    // Verify product exists
    const productExists = await prisma.product.findUnique({
      where: { id: productId }
    });
    if (!productExists) {
      return error(res, "Product not found.", 404);
    }

    // Validate date parameters
    const dateValidation = validateDateQuery({ startDate, endDate, date });
    if (!dateValidation.isValid) {
      return error(res, dateValidation.errors.join(', '), 400);
    }

    // Build query filters
    const whereClause = { productId };
    
    // Add date filter if provided
    const dateFilter = buildDateFilter(startDate, endDate, date);
    if (dateFilter) {
      Object.assign(whereClause, dateFilter);
    }

    console.log('Final where clause:', whereClause);

    const feedbacks = await prisma.feedback.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: { id: true, name: true, email: true, department: true, role: true, avatarUrl: true },
        },
        product: {
          select: { id: true, name: true }
        },
        replies: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: { id: true, name: true, email: true, department: true, role: true, avatarUrl: true },
            },
          },
        },
      },
    });

    console.log(`Found ${feedbacks.length} feedback items`);

    // Process feedback data with permission checks
    const now = new Date();
    const sanitized = feedbacks.map((fb) => {
      const feedbackAge = now - new Date(fb.createdAt);
      const canDelete = fb.author?.id === req.user.id && feedbackAge <= 60000; // 60 seconds for self-deletion
      const canAdminDelete = req.user.role === 'ADMIN' || req.user.role === 'MANAGEMENT';
      
      return {
        id: fb.id,
        message: fb.message,
        createdAt: fb.createdAt,
        updatedAt: fb.updatedAt || fb.createdAt,
        author: fb.author ? {
          id: fb.author.id,
          name: fb.author.name || fb.author.email.split("@")[0],
          email: fb.author.email,
          department: fb.author.department,
          role: fb.author.role,
          avatarUrl: fb.author.avatarUrl,
        } : {
          id: null,
          name: "Unknown User",
          email: "unknown@neokred.tech",
          department: null,
          role: "EMPLOYEE",
          avatarUrl: null,
        },
        product: fb.product,
        isOwner: fb.author?.id === req.user.id,
        canDelete: canDelete || canAdminDelete,
        canReply: req.user.role === 'ADMIN' || req.user.role === 'MANAGEMENT' || fb.author?.id === req.user.id,
        replies: fb.replies.map((r) => {
          const replyAge = now - new Date(r.createdAt);
          const canDeleteReply = r.author?.id === req.user.id && replyAge <= 60000;
          const canAdminDeleteReply = req.user.role === 'ADMIN' || req.user.role === 'MANAGEMENT';
          
          return {
            id: r.id,
            message: r.message,
            createdAt: r.createdAt,
            author: r.author ? {
              id: r.author.id,
              name: r.author.name || r.author.email.split("@")[0],
              email: r.author.email,
              department: r.author.department,
              role: r.author.role,
              avatarUrl: r.author.avatarUrl,
            } : {
              id: null,
              name: "Unknown User",
              email: "unknown@neokred.tech",
              department: null,
              role: "EMPLOYEE",
              avatarUrl: null,
            },
            isOwner: r.author?.id === req.user.id,
            canDelete: canDeleteReply || canAdminDeleteReply,
          };
        }),
        replyCount: fb.replies.length,
      };
    });

    return success(res, sanitized);
  } catch (err) {
    console.error('Get feedback error:', err);
    next(err);
  }
}

/**
 * POST /api/feedback
 * Post feedback for a product
 * Body: { message, productId }
 */
async function createFeedback(req, res, next) {
  try {
    console.log('=== CREATE FEEDBACK DEBUG ===');
    console.log('Request body:', req.body);
    console.log('User:', req.user);

    const { message, productId } = req.body;

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    // Validation
    if (!message || !message.trim()) {
      return error(res, "Message is required.", 400);
    }
    if (!productId) {
      return error(res, "Product ID is required.", 400);
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId }
    });
    if (!product) {
      return error(res, "Product not found.", 404);
    }

    // Rate limiting - check if user posted feedback recently
    const recentFeedback = await prisma.feedback.findFirst({
      where: {
        authorId: req.user.id,
        productId: productId,
        createdAt: {
          gte: new Date(Date.now() - 30000) // 30 seconds ago
        }
      }
    });

    if (recentFeedback) {
      return error(res, "Please wait before posting another feedback.", 429);
    }

    console.log('Creating feedback with data:', {
      message: message.trim(),
      productId,
      authorId: req.user.id,
    });

    const feedback = await prisma.feedback.create({
      data: {
        message: message.trim(),
        productId,
        authorId: req.user.id,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, department: true, role: true, avatarUrl: true },
        },
        product: {
          select: { id: true, name: true }
        },
        replies: {
          orderBy: { createdAt: "asc" },
          include: {
            author: {
              select: { id: true, name: true, email: true, department: true, role: true, avatarUrl: true },
            },
          },
        },
      },
    });

    console.log('Feedback created:', feedback.id);

    const response = {
      id: feedback.id,
      message: feedback.message,
      createdAt: feedback.createdAt,
      updatedAt: feedback.updatedAt || feedback.createdAt,
      author: {
        id: feedback.author.id,
        name: feedback.author.name || feedback.author.email.split("@")[0],
        email: feedback.author.email,
        department: feedback.author.department,
        role: feedback.author.role,
        avatarUrl: feedback.author.avatarUrl,
      },
      product: feedback.product,
      isOwner: true,
      canDelete: true,
      canReply: req.user.role === 'ADMIN' || req.user.role === 'MANAGEMENT' || true, // Author can always reply to their own feedback
      replies: [],
      replyCount: 0,
    };

    return success(res, response, 201);
  } catch (err) {
    console.error('Create feedback error:', err);
    next(err);
  }
}

/**
 * DELETE /api/feedback/:id
 * Delete feedback (author within 60 seconds or admin/management)
 */
async function deleteFeedback(req, res, next) {
  try {
    console.log('=== DELETE FEEDBACK DEBUG ===');
    console.log('Params:', req.params);
    console.log('User:', req.user);

    const { id } = req.params;

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    if (!id) {
      return error(res, "Feedback ID is required.", 400);
    }

    // Find existing feedback
    const existingFeedback = await prisma.feedback.findUnique({
      where: { id },
      select: { id: true, authorId: true, message: true, createdAt: true }
    });

    if (!existingFeedback) {
      return error(res, "Feedback not found.", 404);
    }

    // Permission check
    const feedbackAge = new Date() - new Date(existingFeedback.createdAt);
    const canSelfDelete = existingFeedback.authorId === req.user.id && feedbackAge <= 60000;
    const canAdminDelete = req.user.role === 'ADMIN' || req.user.role === 'MANAGEMENT';
    
    if (!canSelfDelete && !canAdminDelete) {
      return error(res, "Access denied. You can only delete your own feedback within 60 seconds, or be an admin.", 403);
    }

    // Delete the feedback (cascade will handle related replies)
    await prisma.feedback.delete({
      where: { id }
    });

    console.log('Feedback deleted:', id);

    return success(res, { message: "Feedback deleted successfully." });
  } catch (err) {
    console.error('Delete feedback error:', err);
    next(err);
  }
}

/**
 * GET /api/feedback/calendar
 * Get feedback calendar data (count by date for current month)
 */
async function getFeedbackCalendar(req, res, next) {
  try {
    console.log('=== GET FEEDBACK CALENDAR DEBUG ===');
    console.log('Query params:', req.query);
    console.log('User:', req.user);

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    const { month, year, productId } = req.query;
    
    // Get current month boundaries
    const { start, end } = getMonthBoundaries(month, year);
    
    // Build where clause
    const where = {
      createdAt: {
        gte: start,
        lte: end,
      },
    };
    
    if (productId) {
      // Verify product exists
      const productExists = await prisma.product.findUnique({
        where: { id: productId }
      });
      if (!productExists) {
        return error(res, "Product not found.", 404);
      }
      where.productId = productId;
    }

    console.log('Calendar where clause:', where);

    // Get all feedback for the month
    const feedback = await prisma.feedback.findMany({
      where,
      select: {
        id: true,
        createdAt: true,
      },
    });

    // Group by date
    const calendarData = {};
    const dateStrings = getMonthDates(start, end);
    
    // Initialize all dates with 0
    dateStrings.forEach(dateStr => {
      calendarData[dateStr] = 0;
    });
    
    // Count feedback by date
    feedback.forEach(fb => {
      const dateStr = formatDateString(fb.createdAt);
      if (calendarData.hasOwnProperty(dateStr)) {
        calendarData[dateStr]++;
      }
    });

    console.log(`Calendar data for ${dateStrings.length} dates, ${feedback.length} total feedback items`);

    return success(res, {
      month: month || new Date().getMonth() + 1,
      year: year || new Date().getFullYear(),
      productId: productId || null,
      dates: calendarData,
      totalFeedback: feedback.length,
    });
  } catch (err) {
    console.error('Get feedback calendar error:', err);
    next(err);
  }
}

/**
 * GET /api/feedback/date-range?startDate=YYYY-MM-DD&endDate=YYYY-MM-DD&productId=xxx
 * Get feedback statistics for a date range
 */
async function getFeedbackDateRange(req, res, next) {
  try {
    console.log('=== GET FEEDBACK DATE RANGE DEBUG ===');
    console.log('Query params:', req.query);
    console.log('User:', req.user);

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    const { startDate, endDate, productId } = req.query;

    // Validate date parameters
    const dateValidation = validateDateQuery({ startDate, endDate });
    if (!dateValidation.isValid) {
      return error(res, dateValidation.errors.join(', '), 400);
    }

    // Build where clause
    const where = {};
    
    if (productId) {
      // Verify product exists
      const productExists = await prisma.product.findUnique({
        where: { id: productId }
      });
      if (!productExists) {
        return error(res, "Product not found.", 404);
      }
      where.productId = productId;
    }

    // Add date filter
    const dateFilter = buildDateFilter(startDate, endDate);
    if (dateFilter) {
      Object.assign(where, dateFilter);
    }

    console.log('Date range where clause:', where);

    // Get feedback count and basic stats
    const [totalCount, feedback] = await Promise.all([
      prisma.feedback.count({ where }),
      prisma.feedback.findMany({
        where,
        select: {
          id: true,
          createdAt: true,
          author: {
            select: { id: true, department: true }
          },
          replies: {
            select: { id: true }
          }
        },
      })
    ]);

    // Calculate statistics
    const stats = {
      totalFeedback: totalCount,
      totalReplies: feedback.reduce((sum, fb) => sum + fb.replies.length, 0),
      averageRepliesPerFeedback: totalCount > 0 ? (feedback.reduce((sum, fb) => sum + fb.replies.length, 0) / totalCount).toFixed(2) : 0,
      departmentBreakdown: {},
      dailyBreakdown: {},
    };

    // Group by department
    feedback.forEach(fb => {
      const dept = fb.author.department || 'Unknown';
      stats.departmentBreakdown[dept] = (stats.departmentBreakdown[dept] || 0) + 1;
    });

    // Group by date
    feedback.forEach(fb => {
      const dateStr = formatDateString(fb.createdAt);
      stats.dailyBreakdown[dateStr] = (stats.dailyBreakdown[dateStr] || 0) + 1;
    });

    console.log(`Date range stats: ${totalCount} feedback items`);

    return success(res, {
      startDate,
      endDate,
      productId: productId || null,
      ...stats,
    });
  } catch (err) {
    console.error('Get feedback date range error:', err);
    next(err);
  }
}

export {
  getCurrentUser,
  getFeedback,
  createFeedback,
  deleteFeedback,
  getFeedbackCalendar,
  getFeedbackDateRange,
};