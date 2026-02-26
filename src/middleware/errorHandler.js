function errorHandler(err, req, res, _next) {
  console.error('Error:', err.message);

  if (err.isJoi) {
    return res.status(400).json({ error: 'Validation error', details: err.details.map((d) => d.message) });
  }

  const status = err.status || 500;
  res.status(status).json({
    error: err.message || 'Internal server error',
  });
}

module.exports = { errorHandler };
