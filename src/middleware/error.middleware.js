/**
 * Global error handler — catches all unhandled errors
 */
function errorHandler(err, req, res, next) {
  console.error("❌ Error:", err.message);

  if (process.env.NODE_ENV === "development") {
    console.error(err.stack);
  }

  // Prisma known errors
  if (err.code === "P2002") {
    return res.status(409).json({
      success: false,
      error: "A record with this value already exists.",
    });
  }

  if (err.code === "P2025") {
    return res.status(404).json({
      success: false,
      error: "Record not found.",
    });
  }

  // Validation errors
  if (err.name === "ValidationError") {
    return res.status(400).json({
      success: false,
      error: err.message,
    });
  }

  // Default server error
  res.status(err.statusCode || 500).json({
    success: false,
    error: err.message || "Internal server error.",
  });
}

/**
 * 404 handler for unknown routes
 */
function notFound(req, res) {
  res.status(404).json({
    success: false,
    error: `Route ${req.originalUrl} not found.`,
  });
}

export { errorHandler, notFound };
