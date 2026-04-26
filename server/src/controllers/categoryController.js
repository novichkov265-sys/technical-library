const pool = require('../config/database');

const categoryController = {
  // Получение всех категорий
  async getAll(req, res) {
    try {
      const result = await pool.query(`
        SELECT c.*, 
               p.name as parent_name,
               COUNT(d.id) as document_count
        FROM categories c
        LEFT JOIN categories p ON c.parent_id = p.id
        LEFT JOIN documents d ON d.category_id = c.id
        GROUP BY c.id, p.name
        ORDER BY c.name
      `);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Ошибка получения категорий:', error);
      res.status(500).json({ error: 'Ошибка получения категорий' });
    }
  },

  // Создание категории
  async create(req, res) {
    try {
      const { name, parent_id, description } = req.body;
      
      const result = await pool.query(`
        INSERT INTO categories (name, parent_id, description)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [name, parent_id, description]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Ошибка создания категории:', error);
      res.status(500).json({ error: 'Ошибка создания категории' });
    }
  },

  // Обновление категории
  async update(req, res) {
    try {
      const { id } = req.params;
      const { name, parent_id, description } = req.body;
      
      const result = await pool.query(`
        UPDATE categories
        SET name = COALESCE($1, name),
            parent_id = $2,
            description = COALESCE($3, description)
        WHERE id = $4
        RETURNING *
      `, [name, parent_id, description, id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Категория не найдена' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Ошибка обновления категории:', error);
      res.status(500).json({ error: 'Ошибка обновления категории' });
    }
  },

  // Удаление категории
  async delete(req, res) {
    try {
      const { id } = req.params;
      
      // Проверяем, есть ли документы в категории
      const docsCheck = await pool.query(
        'SELECT COUNT(*) FROM documents WHERE category_id = $1',
        [id]
      );
      
      if (parseInt(docsCheck.rows[0].count) > 0) {
        return res.status(400).json({ 
          error: 'Невозможно удалить категорию с документами' 
        });
      }
      
      await pool.query('DELETE FROM categories WHERE id = $1', [id]);
      
      res.json({ message: 'Категория удалена' });
    } catch (error) {
      console.error('Ошибка удаления категории:', error);
      res.status(500).json({ error: 'Ошибка удаления категории' });
    }
  },

  // Получение всех тегов
  async getAllTags(req, res) {
    try {
      const result = await pool.query(`
        SELECT t.*, 
               COUNT(dt.document_id) as document_count
        FROM tags t
        LEFT JOIN document_tags dt ON t.id = dt.tag_id
        GROUP BY t.id
        ORDER BY t.name
      `);
      
      res.json(result.rows);
    } catch (error) {
      console.error('Ошибка получения тегов:', error);
      res.status(500).json({ error: 'Ошибка получения тегов' });
    }
  },

  // Создание тега
  async createTag(req, res) {
    try {
      const { name } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Название тега обязательно' });
      }
      
      const result = await pool.query(`
        INSERT INTO tags (name)
        VALUES ($1)
        RETURNING *
      `, [name.trim()]);
      
      res.status(201).json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Тег с таким названием уже существует' });
      }
      console.error('Ошибка создания тега:', error);
      res.status(500).json({ error: 'Ошибка создания тега' });
    }
  },

  // Обновление тега
  async updateTag(req, res) {
    try {
      const { id } = req.params;
      const { name } = req.body;
      
      if (!name || !name.trim()) {
        return res.status(400).json({ error: 'Название тега обязательно' });
      }
      
      const result = await pool.query(`
        UPDATE tags
        SET name = $1
        WHERE id = $2
        RETURNING *
      `, [name.trim(), id]);
      
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Тег не найден' });
      }
      
      res.json(result.rows[0]);
    } catch (error) {
      if (error.code === '23505') {
        return res.status(400).json({ error: 'Тег с таким названием уже существует' });
      }
      console.error('Ошибка обновления тега:', error);
      res.status(500).json({ error: 'Ошибка обновления тега' });
    }
  },

  // Удаление тега
  async deleteTag(req, res) {
    try {
      const { id } = req.params;
      
      // Удаляем связи с документами
      await pool.query('DELETE FROM document_tags WHERE tag_id = $1', [id]);
      
      // Удаляем сам тег
      await pool.query('DELETE FROM tags WHERE id = $1', [id]);
      
      res.json({ message: 'Тег удален' });
    } catch (error) {
      console.error('Ошибка удаления тега:', error);
      res.status(500).json({ error: 'Ошибка удаления тега' });
    }
  }
};

module.exports = categoryController;