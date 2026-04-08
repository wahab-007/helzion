export const notFound = (_req, _res, next) => {
  const error = new Error("Route not found");
  error.statusCode = 404;
  next(error);
};

export const errorHandler = (error, _req, res, _next) => {
  res.status(error.statusCode || 500).json({
    message: error.message || "Internal server error"
  });
};
