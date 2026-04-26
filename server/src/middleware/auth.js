const jwt = require('jsonwebtoken');
const pool = require('../config/database');

const authMiddleware = async (req, res, next) => {
  try {
    // Получаем токен из заголовка или из query параметра (для preview)
    let token = req.headers.authorization?.replace('Bearer ', '');
    
    // Если токен не в заголовке, проверяем query (для iframe preview)
    if (!token && req.query.token) {
      token = req.query.token;
    }

    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const decoded = jwt.verify(token, jwtSecret);

    // Получаем пользователя из БД
    const result = await pool.query(
      'SELECT id, email, full_name, role, position FROM users WHERE id = $1',
      [decoded.userId]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Пользователь не найден' });
    }

    req.user = result.rows[0];
    next();
  } catch (error) {
    console.error('Ошибка авторизации:', error.message);
    return res.status(401).json({ error: 'Недействительный токен' });
  }
};

module.exports = authMiddleware;