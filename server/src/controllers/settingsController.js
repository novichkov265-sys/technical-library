const pool = require('../config/database');

const settingsController = {
  // Получить все настройки (для админа)
  async getAll(req, res) {
    try {
      const result = await pool.query(`
        SELECT * FROM system_settings 
        ORDER BY key
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Ошибка получения настроек:', error);
      res.status(500).json({ error: 'Ошибка получения настроек' });
    }
  },

   // Получить публичные настройки (для всех авторизованных)
  async getPublic(req, res) {
    try {
      const result = await pool.query(`
        SELECT key, value FROM system_settings 
        WHERE key IN ('app_name', 'max_file_size', 'allowed_extensions', 'password_min_length')
      `);
      
      const settings = {};
      result.rows.forEach(row => {
        settings[row.key] = row.value;
      });
      
      res.json(settings);
    } catch (error) {
      console.error('Ошибка получения настроек:', error);
      res.status(500).json({ error: 'Ошибка получения настроек' });
    }
  },

  // Обновить настройку
  async update(req, res) {
    try {
      const { key, value } = req.body;
      
      if (!key) {
        return res.status(400).json({ error: 'Не указан ключ настройки' });
      }
      
      await pool.query(`
        UPDATE system_settings 
        SET value = $1, updated_at = CURRENT_TIMESTAMP 
        WHERE key = $2
      `, [value, key]);
      
      res.json({ message: 'Настройка обновлена' });
    } catch (error) {
      console.error('Ошибка обновления настройки:', error);
      res.status(500).json({ error: 'Ошибка обновления настройки' });
    }
  }
};

module.exports = settingsController;