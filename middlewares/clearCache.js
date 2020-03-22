const { clearHashKey } = require('../services/cache');

module.exports = async (req, res, next) => {
  await next()

  clearHashKey(req.user.id); 
}