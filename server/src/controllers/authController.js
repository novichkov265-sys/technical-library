const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const path = require('path');
const fs = require('fs');

const authController = {
  // Регистрация
  async register(req, res) {
    try {
      const { email, password, full_name, position } = req.body;

      if (!email || !password || !full_name) {
        return res.status(400).json({ error: 'Заполните все обязательные поля' });
      }

      const existingUser = await pool.query(
        'SELECT id FROM users WHERE email = $1',
        [email.toLowerCase()]
      );

      if (existingUser.rows.length > 0) {
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      }

      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);

      const result = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, position, role)
         VALUES ($1, $2, $3, $4, 'technical_specialist')
         RETURNING id, email, full_name, position, role, avatar_url`,
        [email.toLowerCase(), passwordHash, full_name, position || null]
      );

      const user = result.rows[0];

      const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
      const token = jwt.sign({ userId: user.id }, jwtSecret, { expiresIn: '7d' });

      res.status(201).json({
        token,
        user: {
          id: user.id,
          email: user.email,
          full_name: user.full_name,
          position: user.position,
          role: user.role,
          avatar_url: user.avatar_url,
        },
      });
    } catch (error) {
      console.error('Ошибка регистрации:', error);
      res.status(500).json({ error: 'Ошибка сервера при регистрации' });
    }
  },

  // Вход
async login(req, res) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Введите email и пароль' });
    }

    const result = await pool.query(
      'SELECT * FROM users WHERE email = $1',
      [email.toLowerCase()]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const user = result.rows[0];

    const isValidPassword = await bcrypt.compare(password, user.password_hash);

    if (!isValidPassword) {
      return res.status(401).json({ error: 'Неверный email или пароль' });
    }

    const jwtSecret = process.env.JWT_SECRET || 'your-secret-key-change-in-production';
    const token = jwt.sign(
      { userId: user.id, id: user.id, email: user.email, role: user.role },
      jwtSecret,
      { expiresIn: '7d' }
    );

    // Логируем вход
    const ip = req.ip === '::1' ? '127.0.0.1' : (req.ip || req.headers['x-forwarded-for']?.split(',')[0] || 'unknown');
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, created_at)
       VALUES ($1, 'user_login', 'user', $1, $2, NOW())`,
      [user.id, ip]
    );

    res.json({
      token,
      user: {
        id: user.id,
        email: user.email,
        full_name: user.full_name,
        position: user.position,
        role: user.role,
        avatar_url: user.avatar_url,
      },
    });
  } catch (error) {
    console.error('Ошибка входа:', error);
    res.status(500).json({ error: 'Ошибка сервера при входе' });
  }
},

  // Получение профиля
  async getProfile(req, res) {
    try {
      const result = await pool.query(
        'SELECT id, email, full_name, position, role, avatar_url, created_at FROM users WHERE id = $1',
        [req.user.id]
      );

      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Ошибка получения профиля:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  // Обновление профиля
  async updateProfile(req, res) {
    try {
      const { full_name, position, current_password, new_password } = req.body;

      if (new_password) {
        if (!current_password) {
          return res.status(400).json({ error: 'Введите текущий пароль' });
        }

        const userResult = await pool.query(
          'SELECT password_hash FROM users WHERE id = $1',
          [req.user.id]
        );

        const isValidPassword = await bcrypt.compare(
          current_password,
          userResult.rows[0].password_hash
        );

        if (!isValidPassword) {
          return res.status(400).json({ error: 'Неверный текущий пароль' });
        }

        const salt = await bcrypt.genSalt(10);
        const newPasswordHash = await bcrypt.hash(new_password, salt);

        await pool.query(
          'UPDATE users SET password_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2',
          [newPasswordHash, req.user.id]
        );
      }

      const result = await pool.query(
        `UPDATE users 
         SET full_name = COALESCE($1, full_name), 
             position = COALESCE($2, position),
             updated_at = CURRENT_TIMESTAMP
         WHERE id = $3
         RETURNING id, email, full_name, position, role, avatar_url`,
        [full_name, position, req.user.id]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Ошибка обновления профиля:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },

  // Загрузка аватара
  async uploadAvatar(req, res) {
    try {
      if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
      }

      const avatarUrl = `/uploads/avatars/${req.file.filename}`;

      // Удаляем старый аватар
      const oldUser = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
      if (oldUser.rows[0]?.avatar_url) {
        const oldPath = path.join(__dirname, '../../', oldUser.rows[0].avatar_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      const result = await pool.query(
        `UPDATE users SET avatar_url = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 
         RETURNING id, email, full_name, position, role, avatar_url`,
        [avatarUrl, req.user.id]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Ошибка загрузки аватара:', error);
      res.status(500).json({ error: 'Ошибка загрузки аватара' });
    }
  },

  // Удаление аватара
  async deleteAvatar(req, res) {
    try {
      const oldUser = await pool.query('SELECT avatar_url FROM users WHERE id = $1', [req.user.id]);
      if (oldUser.rows[0]?.avatar_url) {
        const oldPath = path.join(__dirname, '../../', oldUser.rows[0].avatar_url);
        if (fs.existsSync(oldPath)) {
          fs.unlinkSync(oldPath);
        }
      }

      const result = await pool.query(
        `UPDATE users SET avatar_url = NULL, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 
         RETURNING id, email, full_name, position, role, avatar_url`,
        [req.user.id]
      );

      res.json(result.rows[0]);
    } catch (error) {
      console.error('Ошибка удаления аватара:', error);
      res.status(500).json({ error: 'Ошибка удаления аватара' });
    }
  },
};

module.exports = authController;