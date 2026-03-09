import prisma from "../utils/prisma.js";
import { success, error } from "../utils/response.js";
import { hasPermission } from "../utils/roleAssignment.js";
import { getStatusDisplayName, getAllStatuses } from "../utils/statusMapping.js";

/**
 * GET /api/updates/statuses
 * Get all available update statuses
 */
async function getStatuses(req, res, next) {
  try {
    const statuses = getAllStatuses();
    return success(res, statuses);
  } catch (err) {
    next(err);
  }
}

/**
 * GET /api/updates?productId=xxx&date=YYYY-MM-DD&status=WIP&startDate=YYYY-MM-DD&endDate=YYYY-MM-DD
 * Get updates for a product, optionally filtered by date and status
 */
async function getUpdates(req, res, next) {
  try {
    console.log('=== GET UPDATES DEBUG ===');
    console.log('Query params:', req.query);
    console.log('User:', req.user);

    const { productId, date, status, startDate, endDate } = req.query;

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    // Build filter
    const where = {};

    if (productId) {
      // Validate product exists
      const productExists = await prisma.product.findUnique({
        where: { id: productId }
      });
      if (!productExists) {
        return error(res, "Product not found.", 404);
      }
      where.productId = productId;
    }

    if (status) {
      where.status = status;
    }

    // Date filtering
    if (date) {
      // Single date filter
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);

      where.createdAt = {
        gte: startOfDay,
        lte: endOfDay,
      };
    } else if (startDate || endDate) {
      // Date range filter
      const dateFilter = {};
      if (startDate) {
        const start = new Date(startDate);
        start.setHours(0, 0, 0, 0);
        dateFilter.gte = start;
      }
      if (endDate) {
        const end = new Date(endDate);
        end.setHours(23, 59, 59, 999);
        dateFilter.lte = end;
      }
      where.createdAt = dateFilter;
    }

    console.log('Final where clause:', where);

    const updates = await prisma.update.findMany({
      where,
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true, department: true, role: true },
        },
        product: {
          select: { id: true, name: true },
        },
        votes: {
          select: { id: true, type: true, userId: true },
        },
      },
    });

    console.log(`Found ${updates.length} updates`);

    // Transform: add vote counts + current user's vote
    const transformed = updates.map((update) => {
      const upvotes = update.votes.filter((v) => v.type === "UP").length;
      const downvotes = update.votes.filter((v) => v.type === "DOWN").length;
      const userVote = update.votes.find((v) => v.userId === req.user.id);

      return {
        id: update.id,
        title: update.title,
        description: update.description,
        status: update.status,
        statusDisplayName: getStatusDisplayName(update.status),
        createdAt: update.createdAt,
        updatedAt: update.updatedAt,
        author: update.author ? {
          id: update.author.id,
          name: update.author.name,
          email: update.author.email,
          avatarUrl: update.author.avatarUrl,
          department: update.author.department,
          role: update.author.role,
        } : {
          id: null,
          name: "Unknown User",
          email: "unknown@neokred.tech",
          avatarUrl: null,
          department: null,
          role: "EMPLOYEE",
        },
        product: update.product,
        isOwner: update.authorId === req.user.id,
        canEdit: update.authorId === req.user.id || hasPermission(req.user.role, "EDIT_ALL_UPDATES"),
        canDelete: update.authorId === req.user.id || hasPermission(req.user.role, "DELETE_ALL_UPDATES"),
        votes: {
          up: upvotes,
          down: downvotes,
          userVote: userVote ? userVote.type : null, // "UP", "DOWN", or null
        },
        statusHistory: [], // Will be implemented later
      };
    });

    return success(res, transformed);
  } catch (err) {
    console.error('Get updates error:', err);
    next(err);
  }
}

/**
 * GET /api/updates/:id
 * Get a single update by ID with full details
 */
async function getUpdateById(req, res, next) {
  try {
    console.log('=== GET UPDATE BY ID DEBUG ===');
    console.log('Params:', req.params);
    console.log('User:', req.user);

    const { id } = req.params;

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    if (!id) {
      return error(res, "Update ID is required.", 400);
    }

    const update = await prisma.update.findUnique({
      where: { id },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true, department: true, role: true },
        },
        product: {
          select: { id: true, name: true },
        },
        votes: {
          select: { id: true, type: true, userId: true },
        },
      },
    });

    if (!update) {
      return error(res, "Update not found.", 404);
    }

    const upvotes = update.votes.filter((v) => v.type === "UP").length;
    const downvotes = update.votes.filter((v) => v.type === "DOWN").length;
    const userVote = update.votes.find((v) => v.userId === req.user.id);

    const response = {
      id: update.id,
      title: update.title,
      description: update.description,
      status: update.status,
      statusDisplayName: getStatusDisplayName(update.status),
      createdAt: update.createdAt,
      updatedAt: update.updatedAt,
      author: update.author ? {
        id: update.author.id,
        name: update.author.name,
        email: update.author.email,
        avatarUrl: update.author.avatarUrl,
        department: update.author.department,
        role: update.author.role,
      } : {
        id: null,
        name: "Unknown User",
        email: "unknown@neokred.tech",
        avatarUrl: null,
        department: null,
        role: "EMPLOYEE",
      },
      product: update.product,
      isOwner: update.authorId === req.user.id,
      canEdit: update.authorId === req.user.id || hasPermission(req.user.role, "EDIT_ALL_UPDATES"),
      canDelete: update.authorId === req.user.id || hasPermission(req.user.role, "DELETE_ALL_UPDATES"),
      votes: {
        up: upvotes,
        down: downvotes,
        userVote: userVote ? userVote.type : null,
      },
      statusHistory: [], // Will be implemented later
    };

    return success(res, response);
  } catch (err) {
    console.error('Get update by ID error:', err);
    next(err);
  }
}

/**
 * POST /api/updates
 * Create a new product update
 * Body: { title, description, status?, productId }
 */
async function createUpdate(req, res, next) {
  try {
    console.log('=== CREATE UPDATE DEBUG ===');
    console.log('Request body:', req.body);
    console.log('User:', req.user);

    const { title, description, status, productId } = req.body;

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    // Permission check
    if (!hasPermission(req.user.role, "CREATE_UPDATE")) {
      return error(
        res, 
        "Access denied. Only management and admin users can create product updates.", 
        403
      );
    }

    // Validation
    if (!title || !title.trim()) {
      return error(res, "Title is required.", 400);
    }
    if (!description || !description.trim()) {
      return error(res, "Description is required.", 400);
    }
    if (!productId) {
      return error(res, "Product ID is required.", 400);
    }

    // Verify product exists
    const product = await prisma.product.findUnique({
      where: { id: productId },
    });
    if (!product) {
      return error(res, "Product not found.", 404);
    }

    const finalStatus = status || "WIP";
    
    console.log('Creating update with data:', {
      title: title.trim(),
      description: description.trim(),
      status: finalStatus,
      productId,
      authorId: req.user.id,
    });
    
    const update = await prisma.update.create({
      data: {
        title: title.trim(),
        description: description.trim(),
        status: finalStatus,
        productId,
        authorId: req.user.id,
      },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true, department: true, role: true },
        },
        product: {
          select: { id: true, name: true },
        },
      },
    });

    console.log('Update created:', update.id);

    // Create initial status history entry
    try {
      await prisma.updateStatusHistory.create({
        data: {
          updateId: update.id,
          fromStatus: null,
          toStatus: finalStatus,
          changedBy: req.user.id,
          reason: "Update created"
        }
      });
      console.log('Status history created');
    } catch (historyErr) {
      console.error('Failed to create status history:', historyErr);
      // Continue even if history fails
    }

    const response = {
      id: update.id,
      title: update.title,
      description: update.description,
      status: update.status,
      statusDisplayName: getStatusDisplayName(update.status),
      createdAt: update.createdAt,
      updatedAt: update.updatedAt,
      author: update.author ? {
        id: update.author.id,
        name: update.author.name,
        email: update.author.email,
        avatarUrl: update.author.avatarUrl,
        department: update.author.department,
        role: update.author.role,
      } : {
        id: null,
        name: "Unknown User",
        email: "unknown@neokred.tech",
        avatarUrl: null,
        department: null,
        role: "EMPLOYEE",
      },
      product: update.product,
      isOwner: true,
      canEdit: true,
      canDelete: true,
      votes: { up: 0, down: 0, userVote: null },
      statusHistory: [],
    };

    return success(res, response, 201);
  } catch (err) {
    console.error('Create update error:', err);
    next(err);
  }
}

/**
 * PUT /api/updates/:id
 * Edit an update (author or admin only)
 * Body: { title?, description?, status? }
 */
async function editUpdate(req, res, next) {
  try {
    console.log('=== EDIT UPDATE DEBUG ===');
    console.log('Params:', req.params);
    console.log('Body:', req.body);
    console.log('User:', req.user);

    const { id } = req.params;
    const { title, description, status } = req.body;

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    if (!id) {
      return error(res, "Update ID is required.", 400);
    }

    // Find existing update
    const existingUpdate = await prisma.update.findUnique({
      where: { id },
      include: { author: true, product: true }
    });

    if (!existingUpdate) {
      return error(res, "Update not found.", 404);
    }

    // Permission check
    const canEdit = existingUpdate.authorId === req.user.id || hasPermission(req.user.role, "EDIT_ALL_UPDATES");
    if (!canEdit) {
      return error(res, "Access denied. You can only edit your own updates unless you're an admin.", 403);
    }

    // Validation
    if (title !== undefined && (!title || !title.trim())) {
      return error(res, "Title cannot be empty.", 400);
    }
    if (description !== undefined && (!description || !description.trim())) {
      return error(res, "Description cannot be empty.", 400);
    }

    // Build update data
    const updateData = {};
    if (title !== undefined) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    if (status !== undefined) updateData.status = status;

    // Track status change for history
    const oldStatus = existingUpdate.status;
    const statusChanged = status !== undefined && status !== oldStatus;

    const updatedUpdate = await prisma.update.update({
      where: { id },
      data: updateData,
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true, department: true, role: true },
        },
        product: {
          select: { id: true, name: true },
        },
        votes: {
          select: { id: true, type: true, userId: true },
        },
      },
    });

    // Create status history entry if status changed
    if (statusChanged) {
      try {
        await prisma.updateStatusHistory.create({
          data: {
            updateId: updatedUpdate.id,
            fromStatus: oldStatus,
            toStatus: status,
            changedBy: req.user.id,
            reason: "Status updated via edit"
          }
        });
        console.log('Status history updated');
      } catch (historyErr) {
        console.error('Failed to create status history:', historyErr);
      }
    }

    const upvotes = updatedUpdate.votes.filter((v) => v.type === "UP").length;
    const downvotes = updatedUpdate.votes.filter((v) => v.type === "DOWN").length;
    const userVote = updatedUpdate.votes.find((v) => v.userId === req.user.id);

    const response = {
      id: updatedUpdate.id,
      title: updatedUpdate.title,
      description: updatedUpdate.description,
      status: updatedUpdate.status,
      statusDisplayName: getStatusDisplayName(updatedUpdate.status),
      createdAt: updatedUpdate.createdAt,
      updatedAt: updatedUpdate.updatedAt,
      author: updatedUpdate.author ? {
        id: updatedUpdate.author.id,
        name: updatedUpdate.author.name,
        email: updatedUpdate.author.email,
        avatarUrl: updatedUpdate.author.avatarUrl,
        department: updatedUpdate.author.department,
        role: updatedUpdate.author.role,
      } : {
        id: null,
        name: "Unknown User",
        email: "unknown@neokred.tech",
        avatarUrl: null,
        department: null,
        role: "EMPLOYEE",
      },
      product: updatedUpdate.product,
      isOwner: updatedUpdate.authorId === req.user.id,
      canEdit: updatedUpdate.authorId === req.user.id || hasPermission(req.user.role, "EDIT_ALL_UPDATES"),
      canDelete: updatedUpdate.authorId === req.user.id || hasPermission(req.user.role, "DELETE_ALL_UPDATES"),
      votes: {
        up: upvotes,
        down: downvotes,
        userVote: userVote ? userVote.type : null,
      },
      statusHistory: [],
    };

    return success(res, response);
  } catch (err) {
    console.error('Edit update error:', err);
    next(err);
  }
}

/**
 * PATCH /api/updates/:id/status
 * Change update status
 * Body: { status, reason? }
 */
async function changeStatus(req, res, next) {
  try {
    console.log('=== CHANGE STATUS DEBUG ===');
    console.log('Params:', req.params);
    console.log('Body:', req.body);
    console.log('User:', req.user);

    const { id } = req.params;
    const { status, reason } = req.body;

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    if (!id) {
      return error(res, "Update ID is required.", 400);
    }

    if (!status) {
      return error(res, "Status is required.", 400);
    }

    // Find existing update
    const existingUpdate = await prisma.update.findUnique({
      where: { id },
    });

    if (!existingUpdate) {
      return error(res, "Update not found.", 404);
    }

    // Permission check
    const canChangeStatus = existingUpdate.authorId === req.user.id || hasPermission(req.user.role, "CHANGE_STATUS");
    if (!canChangeStatus) {
      return error(res, "Access denied. You can only change status of your own updates unless you're authorized.", 403);
    }

    const oldStatus = existingUpdate.status;
    
    if (oldStatus === status) {
      return error(res, "Status is already set to this value.", 400);
    }

    // Update status
    const updatedUpdate = await prisma.update.update({
      where: { id },
      data: { status },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true, department: true, role: true },
        },
        product: {
          select: { id: true, name: true },
        },
        votes: {
          select: { id: true, type: true, userId: true },
        },
      },
    });

    // Create status history entry
    try {
      await prisma.updateStatusHistory.create({
        data: {
          updateId: updatedUpdate.id,
          fromStatus: oldStatus,
          toStatus: status,
          changedBy: req.user.id,
          reason: reason || "Status changed"
        }
      });
      console.log('Status history created');
    } catch (historyErr) {
      console.error('Failed to create status history:', historyErr);
    }

    const upvotes = updatedUpdate.votes.filter((v) => v.type === "UP").length;
    const downvotes = updatedUpdate.votes.filter((v) => v.type === "DOWN").length;
    const userVote = updatedUpdate.votes.find((v) => v.userId === req.user.id);

    const response = {
      id: updatedUpdate.id,
      title: updatedUpdate.title,
      description: updatedUpdate.description,
      status: updatedUpdate.status,
      statusDisplayName: getStatusDisplayName(updatedUpdate.status),
      createdAt: updatedUpdate.createdAt,
      updatedAt: updatedUpdate.updatedAt,
      author: updatedUpdate.author ? {
        id: updatedUpdate.author.id,
        name: updatedUpdate.author.name,
        email: updatedUpdate.author.email,
        avatarUrl: updatedUpdate.author.avatarUrl,
        department: updatedUpdate.author.department,
        role: updatedUpdate.author.role,
      } : {
        id: null,
        name: "Unknown User",
        email: "unknown@neokred.tech",
        avatarUrl: null,
        department: null,
        role: "EMPLOYEE",
      },
      product: updatedUpdate.product,
      isOwner: updatedUpdate.authorId === req.user.id,
      canEdit: updatedUpdate.authorId === req.user.id || hasPermission(req.user.role, "EDIT_ALL_UPDATES"),
      canDelete: updatedUpdate.authorId === req.user.id || hasPermission(req.user.role, "DELETE_ALL_UPDATES"),
      votes: {
        up: upvotes,
        down: downvotes,
        userVote: userVote ? userVote.type : null,
      },
      statusHistory: [],
    };

    return success(res, response);
  } catch (err) {
    console.error('Change status error:', err);
    next(err);
  }
}

/**
 * GET /api/updates/product/:productId
 * Get all updates for a specific product
 */
async function getUpdatesByProduct(req, res, next) {
  try {
    console.log('=== GET UPDATES BY PRODUCT DEBUG ===');
    console.log('Product ID:', req.params.productId);
    console.log('User:', req.user);

    const { productId } = req.params;

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    if (!productId) {
      return error(res, "Product ID is required.", 400);
    }

    // Validate product exists
    const productExists = await prisma.product.findUnique({
      where: { id: productId },
      select: { id: true, name: true }
    });
    if (!productExists) {
      return error(res, "Product not found.", 404);
    }

    const updates = await prisma.update.findMany({
      where: { productId },
      orderBy: { createdAt: "desc" },
      include: {
        author: {
          select: { id: true, name: true, email: true, avatarUrl: true, department: true, role: true },
        },
        product: {
          select: { id: true, name: true },
        },
        votes: {
          select: { id: true, type: true, userId: true },
        },
      },
    });

    console.log(`Found ${updates.length} updates for product ${productExists.name}`);

    // Transform: add vote counts + current user's vote
    const transformed = updates.map((update) => {
      const upvotes = update.votes.filter((v) => v.type === "UP").length;
      const downvotes = update.votes.filter((v) => v.type === "DOWN").length;
      const userVote = update.votes.find((v) => v.userId === req.user.id);

      return {
        id: update.id,
        title: update.title,
        description: update.description,
        status: update.status,
        statusDisplayName: getStatusDisplayName(update.status),
        createdAt: update.createdAt,
        updatedAt: update.updatedAt,
        author: update.author ? {
          id: update.author.id,
          name: update.author.name,
          email: update.author.email,
          avatarUrl: update.author.avatarUrl,
          department: update.author.department,
          role: update.author.role,
        } : {
          id: null,
          name: "Unknown User",
          email: "unknown@neokred.tech",
          avatarUrl: null,
          department: null,
          role: "EMPLOYEE",
        },
        product: update.product,
        isOwner: update.authorId === req.user.id,
        canEdit: update.authorId === req.user.id || hasPermission(req.user.role, "EDIT_ALL_UPDATES"),
        canDelete: update.authorId === req.user.id || hasPermission(req.user.role, "DELETE_ALL_UPDATES"),
        votes: {
          up: upvotes,
          down: downvotes,
          userVote: userVote ? userVote.type : null,
        },
        statusHistory: [],
      };
    });

    return success(res, transformed);
  } catch (err) {
    console.error('Get updates by product error:', err);
    next(err);
  }
}

/**
 * GET /api/updates/:id/history
 * Get status history for an update
 */
async function getStatusHistory(req, res, next) {
  try {
    console.log('=== GET STATUS HISTORY DEBUG ===');
    console.log('Params:', req.params);
    console.log('User:', req.user);

    const { id } = req.params;

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    if (!id) {
      return error(res, "Update ID is required.", 400);
    }

    // Verify update exists
    const updateExists = await prisma.update.findUnique({
      where: { id },
      select: { id: true }
    });

    if (!updateExists) {
      return error(res, "Update not found.", 404);
    }

    const history = await prisma.updateStatusHistory.findMany({
      where: { updateId: id },
      orderBy: { createdAt: 'asc' },
      include: {
        user: {
          select: { id: true, name: true, email: true }
        }
      }
    });

    const transformedHistory = history.map(entry => ({
      id: entry.id,
      fromStatus: entry.fromStatus,
      toStatus: entry.toStatus,
      fromStatusDisplay: entry.fromStatus ? getStatusDisplayName(entry.fromStatus, true) : null,
      toStatusDisplay: getStatusDisplayName(entry.toStatus, true),
      changedBy: entry.user ? {
        name: entry.user.name || entry.user.email.split('@')[0],
        email: entry.user.email
      } : {
        name: "System",
        email: "system@neokred.tech"
      },
      reason: entry.reason,
      timestamp: entry.createdAt
    }));

    return success(res, transformedHistory);
  } catch (err) {
    console.error('Get status history error:', err);
    next(err);
  }
}

/**
 * DELETE /api/updates/:id
 * Delete an update (author or admin only)
 */
async function deleteUpdate(req, res, next) {
  try {
    console.log('=== DELETE UPDATE DEBUG ===');
    console.log('Params:', req.params);
    console.log('User:', req.user);

    const { id } = req.params;

    // Authentication check
    if (!req.user || !req.user.id) {
      return error(res, "Not authenticated. Please login.", 401);
    }

    if (!id) {
      return error(res, "Update ID is required.", 400);
    }

    // Find existing update
    const existingUpdate = await prisma.update.findUnique({
      where: { id },
      select: { id: true, authorId: true, title: true }
    });

    if (!existingUpdate) {
      return error(res, "Update not found.", 404);
    }

    // Permission check
    const canDelete = existingUpdate.authorId === req.user.id || hasPermission(req.user.role, "DELETE_ALL_UPDATES");
    if (!canDelete) {
      return error(res, "Access denied. You can only delete your own updates unless you're an admin.", 403);
    }

    // Delete the update (cascade will handle related records)
    await prisma.update.delete({
      where: { id }
    });

    console.log('Update deleted:', id);

    return success(res, { message: "Update deleted successfully." });
  } catch (err) {
    console.error('Delete update error:', err);
    next(err);
  }
}

export {
  getStatuses,
  getUpdates,
  getUpdateById,
  getUpdatesByProduct,
  createUpdate,
  editUpdate,
  changeStatus,
  getStatusHistory,
  deleteUpdate,
};