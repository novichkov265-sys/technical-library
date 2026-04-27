const pool = require('../config/database');
const bcrypt = require('bcryptjs');
async function getSetting(key, defaultValue = null) {
  try {
    const result = await pool.query('SELECT value FROM system_settings WHERE key = $1', [key]);
    return result.rows.length > 0 ? result.rows[0].value : defaultValue;
  } catch (err) {
    return defaultValue;
  }
}
async function validatePassword(password) {
  const minLength = parseInt(await getSetting('password_min_length', '6'));
  const errors = [];
  if (!password || password.length < minLength) {
    errors.push(`минимум ${minLength} символов`);
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('заглавная буква');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('строчная буква');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('цифра');
  }
  if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?`~]/.test(password)) {
    errors.push('спецсимвол (!@#$%^&*...)');
  }
  return errors;
}
const userController = {
  async getAll(req, res) {
    try {
      const result = await pool.query(
        'SELECT id, email, full_name, position, role, avatar_url, created_at FROM users ORDER BY created_at DESC'
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Ошибка получения пользователей:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },
  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query(
        'SELECT id, email, full_name, position, role, avatar_url, created_at FROM users WHERE id = $1',
        [id]
      );
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Ошибка получения пользователя:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },
  async create(req, res) {
    try {
      const { email, password, full_name, position, role } = req.body;
      if (!email || !password || !full_name || !role) {
        return res.status(400).json({ error: 'Заполните все обязательные поля' });
      }
      const passwordErrors = await validatePassword(password);
      if (passwordErrors.length > 0) {
        return res.status(400).json({
          error: `Пароль должен содержать: ${passwordErrors.join(', ')}`
        });
      }
      const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
      if (existing.rows.length > 0) {
        return res.status(400).json({ error: 'Пользователь с таким email уже существует' });
      }
      const salt = await bcrypt.genSalt(10);
      const passwordHash = await bcrypt.hash(password, salt);
      const result = await pool.query(
        `INSERT INTO users (email, password_hash, full_name, position, role)
         VALUES ($1, $2, $3, $4, $5)
         RETURNING id, email, full_name, position, role, created_at`,
        [email.toLowerCase(), passwordHash, full_name, position || null, role]
      );
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Ошибка создания пользователя:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },
  async update(req, res) {
    try {
      const { id } = req.params;
      const { email, password, full_name, position, role } = req.body;
      if (password) {
        const passwordErrors = await validatePassword(password);
        if (passwordErrors.length > 0) {
          return res.status(400).json({
            error: `Пароль должен содержать: ${passwordErrors.join(', ')}`
          });
        }
      }
      let query = `
        UPDATE users 
        SET email = COALESCE($1, email),
            full_name = COALESCE($2, full_name),
            position = COALESCE($3, position),
            role = COALESCE($4, role),
            updated_at = CURRENT_TIMESTAMP
      `;
      let params = [email?.toLowerCase(), full_name, position, role];
      if (password) {
        const salt = await bcrypt.genSalt(10);
        const passwordHash = await bcrypt.hash(password, salt);
        query += `, password_hash = $${params.length + 1}`;
        params.push(passwordHash);
      }
      query += ` WHERE id = $${params.length + 1} RETURNING id, email, full_name, position, role`;
      params.push(id);
      const result = await pool.query(query, params);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Ошибка обновления пользователя:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },
  async delete(req, res) {
    try {
      const { id } = req.params;
      if (parseInt(id) === req.user.id) {
        return res.status(400).json({ error: 'Нельзя удалить собственный аккаунт' });
      }
      const result = await pool.query('DELETE FROM users WHERE id = $1 RETURNING id', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Пользователь не найден' });
      }
      res.json({ message: 'Пользователь удален' });
    } catch (error) {
      console.error('Ошибка удаления пользователя:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },
  async getApprovers(req, res) {
    try {
      const result = await pool.query(
        "SELECT id, full_name, position FROM users WHERE role = 'department_head' ORDER BY full_name"
      );
      res.json(result.rows);
    } catch (error) {
      console.error('Ошибка получения согласующих:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },
  async getAuditLogs(req, res) {
    try {
      const result = await pool.query(`
        SELECT al.id, al.action, al.entity_type, al.entity_id, al.ip_address, al.created_at, u.full_name as user_name
        FROM audit_log al
        LEFT JOIN users u ON al.user_id = u.id
        ORDER BY al.created_at DESC
        LIMIT 500
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Ошибка получения аудита:', error);
      res.status(500).json({ error: 'Ошибка сервера' });
    }
  },
async getAnalytics(req, res) {
  try {
    // Общая статистика документов
    const docsStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COALESCE(SUM(views), 0) as total_views,
        COALESCE(SUM(downloads), 0) as total_downloads
      FROM documents
    `);
    const usersCount = await pool.query('SELECT COUNT(*) FROM users');
    const documentsByType = await pool.query(`
      SELECT type, COUNT(*)::int as count
      FROM documents
      WHERE status = 'in_library'
      GROUP BY type
      ORDER BY count DESC
    `);
    const documentsByStatus = await pool.query(`
      SELECT status, COUNT(*)::int as count
      FROM documents
      GROUP BY status
      ORDER BY count DESC
    `);
    const usersByRole = await pool.query(`
      SELECT role, COUNT(*)::int as count
      FROM users
      GROUP BY role
      ORDER BY count DESC
    `);
    const documentsByCategory = await pool.query(`
      SELECT COALESCE(c.name, 'Без категории') as category, COUNT(d.id)::int as count
      FROM documents d
      LEFT JOIN categories c ON d.category_id = c.id
      WHERE d.status = 'in_library'
      GROUP BY c.name
      ORDER BY count DESC
      LIMIT 10
    `);
    const popularDocuments = await pool.query(`
      SELECT id, title, type, views, downloads
      FROM documents
      WHERE status = 'in_library'
      ORDER BY views DESC, downloads DESC
      LIMIT 10
    `);
    res.json({
      totalDocuments: parseInt(docsStats.rows[0]?.total || 0),
      totalUsers: parseInt(usersCount.rows[0]?.count || 0),
      totalViews: parseInt(docsStats.rows[0]?.total_views || 0),
      totalDownloads: parseInt(docsStats.rows[0]?.total_downloads || 0),
      documentsByType: documentsByType.rows,
      documentsByStatus: documentsByStatus.rows,
      usersByRole: usersByRole.rows,
      documentsByCategory: documentsByCategory.rows,
      popularDocuments: popularDocuments.rows
    });
  } catch (error) {
    console.error('Ошибка получения аналитики:', error);
    res.status(500).json({ error: 'Не удалось загрузить аналитику: ' + error.message });
  }
}
};
module.exports = userController;