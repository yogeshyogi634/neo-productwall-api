import prisma from "../utils/prisma.js";
import { success, error } from "../utils/response.js";

/**
 * POST /api/votes
 * Cast or toggle a vote on an update
 * Body: { updateId: "xxx", type: "UP" | "DOWN" }
 *
 * Behavior:
 *   - No existing vote → create vote
 *   - Same vote type → remove vote (toggle off)
 *   - Different vote type → switch vote
 */
async function castVote(req, res, next) {
  try {
    const { updateId, type } = req.body;

    if (!updateId) {
      return error(res, "Update ID is required.", 400);
    }
    if (!["UP", "DOWN"].includes(type)) {
      return error(res, 'Vote type must be "UP" or "DOWN".', 400);
    }

    // Verify update exists
    const update = await prisma.update.findUnique({ where: { id: updateId } });
    if (!update) {
      return error(res, "Update not found.", 404);
    }

    // Check for existing vote
    const existingVote = await prisma.vote.findUnique({
      where: {
        userId_updateId: {
          userId: req.user.id,
          updateId,
        },
      },
    });

    let result;

    if (existingVote) {
      if (existingVote.type === type) {
        // Same type → remove vote (toggle off)
        await prisma.vote.delete({ where: { id: existingVote.id } });
        result = { action: "removed", vote: null };
      } else {
        // Different type → switch vote
        const updated = await prisma.vote.update({
          where: { id: existingVote.id },
          data: { type },
        });
        result = { action: "switched", vote: updated };
      }
    } else {
      // No existing → create new vote
      const created = await prisma.vote.create({
        data: {
          type,
          userId: req.user.id,
          updateId,
        },
      });
      result = { action: "created", vote: created };
    }

    // Return updated vote counts
    const votes = await prisma.vote.findMany({ where: { updateId } });
    const up = votes.filter((v) => v.type === "UP").length;
    const down = votes.filter((v) => v.type === "DOWN").length;
    const userVote = votes.find((v) => v.userId === req.user.id);

    return success(res, {
      ...result,
      counts: {
        up,
        down,
        userVote: userVote ? userVote.type : null,
      },
    });
  } catch (err) {
    next(err);
  }
}

/**
 * DELETE /api/votes/:updateId
 * Remove user's vote on an update
 */
async function removeVote(req, res, next) {
  try {
    const { updateId } = req.params;

    const existingVote = await prisma.vote.findUnique({
      where: {
        userId_updateId: {
          userId: req.user.id,
          updateId,
        },
      },
    });

    if (!existingVote) {
      return error(res, "You have not voted on this update.", 404);
    }

    await prisma.vote.delete({ where: { id: existingVote.id } });

    return success(res, { message: "Vote removed." });
  } catch (err) {
    next(err);
  }
}

export { castVote, removeVote };
