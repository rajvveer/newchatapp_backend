export const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // 1. Mongoose: Invalid MongoDB ID (CastError)
  if (err.name === 'CastError') {
    message = `Resource not found. Invalid: ${err.path}`;
    statusCode = 404;
  }

  // 2. Mongoose: Duplicate Key (e.g., Email/Username already exists)
  if (err.code === 11000) {
    message = `Duplicate field value entered`;
    statusCode = 400;
  }

  // 3. Mongoose: Validation Errors (e.g., Password too short)
  if (err.name === 'ValidationError') {
    message = Object.values(err.errors).map((val) => val.message).join(', ');
    statusCode = 400;
  }

  // 4. JWT Errors
  if (err.name === 'JsonWebTokenError') {
    message = 'Invalid token. Please log in again.';
    statusCode = 401;
  }

  if (err.name === 'TokenExpiredError') {
    message = 'Your token has expired. Please log in again.';
    statusCode = 401;
  }

  // Log only in dev or if it's a server crash (500)
  if (process.env.NODE_ENV === 'development' || statusCode === 500) {
    console.error('Error:', err);
  }

  res.status(statusCode).json({
    success: false,
    message,
    stack: process.env.NODE_ENV === 'development' ? err.stack : undefined,
  });
};