/**
 * Standard success response
 */
function success(res, data, statusCode = 200) {
  return res.status(statusCode).json({
    success: true,
    data,
  });
}

/**
 * Standard error response
 */
function error(res, message, statusCode = 400) {
  return res.status(statusCode).json({
    success: false,
    error: message,
  });
}

export { success, error };
