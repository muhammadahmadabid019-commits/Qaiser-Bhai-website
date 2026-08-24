const jwt = require('jsonwebtoken');

module.exports = (req, res, next) => {
  try {
    // 1. Get token from Authorization header
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({
        success: false,
        message: 'Access Denied. No token provided or invalid format.'
      });
    }

    // 2. Extract token
    const token = authHeader.split(' ')[1];

    // 3. Verify token
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // 4. Append decoded user payload (id, role, etc) to req.user
    req.user = decoded;

    next();
  } catch (err) {
    console.error('JWT Verification Error:', err.message);
    
    // Check if token expired
    if (err.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token has expired. Please log in again.'
      });
    }

    return res.status(403).json({
      success: false,
      message: 'Access Denied. Invalid or tampered token.'
    });
  }
};
