const pool = require('../config/database');
const path = require('path');
const fs = require('fs');
const backupController = {
  async getAll(req, res) {
    try {
      const result = await pool.query(`
        SELECT b.*, u.full_name as created_by_name
        FROM backups b
        LEFT JOIN users u ON b.created_by = u.id
        ORDER BY b.created_at DESC
      `);
      res.json(result.rows);
    } catch (error) {
      console.error('Ошибка получения списка резервных копий:', error);
      res.status(500).json({ error: 'Не удалось загрузить список резервных копий: ' + error.message });
    }
  },
  async create(req, res) {
    try {
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `backup_${timestamp}.json`;
      const backupDir = path.join(__dirname, '../../backups');
      const filePath = path.join(backupDir, filename);
      if (!fs.existsSync(backupDir)) {
        fs.mkdirSync(backupDir, { recursive: true });
      }
      const tables = ['categories', 'tags', 'documents', 'document_tags', 
        'document_versions', 'comments', 'favorites', 
        'approval_tickets', 'ticket_messages', 'system_settings'];
      const backupData = {
        created_at: new Date().toISOString(),
        version: '1.0',
        tables: {}
      };
      for (const table of tables) {
        try {
          const result = await pool.query(`SELECT * FROM ${table}`);
          backupData.tables[table] = result.rows;
        } catch (err) {
          console.log(`Таблица ${table} не найдена, пропускаем`);
        }
      }
const summary = {
  documents: backupData.tables.documents?.length || 0,
  categories: backupData.tables.categories?.length || 0,
  tags: backupData.tables.tags?.length || 0,
  approval_tickets: backupData.tables.approval_tickets?.length || 0,
};
fs.writeFileSync(filePath, JSON.stringify(backupData, null, 2), 'utf-8');
const stats = fs.statSync(filePath);
await pool.query(`
  INSERT INTO backups (filename, size_bytes, created_by, summary)
  VALUES ($1, $2, $3, $4)
`, [filename, stats.size, req.user.id, JSON.stringify(summary)]);
      res.json({ message: 'Резервная копия создана', filename });
    } catch (error) {
      console.error('Ошибка создания резервной копии:', error);
      if (error.code === 'ENOSPC') {
        return res.status(500).json({ error: 'Недостаточно места на диске' });
      }
      if (error.code === 'EACCES') {
        return res.status(500).json({ error: 'Нет доступа к папке backups' });
      }
      res.status(500).json({ error: 'Не удалось создать резервную копию: ' + error.message });
    }
  },
  async restore(req, res) {
    try {
      const { filename } = req.params;
      const safeName = path.basename(filename);
      const filePath = path.join(__dirname, '../../backups', safeName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Файл резервной копии не найден' });
      }
      const backupContent = fs.readFileSync(filePath, 'utf-8');
      const backupData = JSON.parse(backupContent);
      if (!backupData.tables) {
        return res.status(400).json({ error: 'Неверный формат резервной копии' });
      }
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const deleteOrder = [
          'ticket_messages', 'approval_tickets', 'favorites', 'comments',
          'document_versions', 'document_tags', 'documents', 'tags', 'categories'
        ];
        for (const table of deleteOrder) {
          try {
            await client.query(`DELETE FROM ${table}`);
          } catch (err) {
            console.log(`Не удалось очистить ${table}:`, err.message);
          }
        }
        const restoreOrder = [
          'categories', 'tags', 'documents', 'document_tags', 
          'document_versions', 'comments', 'favorites',
          'approval_tickets', 'ticket_messages', 'system_settings'
        ];
        for (const table of restoreOrder) {
          const rows = backupData.tables[table];
          if (!rows || rows.length === 0) continue;
          for (const row of rows) {
            const columns = Object.keys(row);
            const values = Object.values(row);
            const placeholders = columns.map((_, i) => `$${i + 1}`).join(', ');
            try {
              await client.query(
                `INSERT INTO ${table} (${columns.join(', ')}) VALUES (${placeholders}) ON CONFLICT DO NOTHING`,
                values
              );
            } catch (err) {
              console.log(`Ошибка вставки в ${table}:`, err.message);
            }
          }
          try {
            await client.query(`
              SELECT setval(pg_get_serial_sequence('${table}', 'id'), 
                COALESCE((SELECT MAX(id) FROM ${table}), 1))
            `);
          } catch (err) {
          }
        }
        await client.query('COMMIT');
        res.json({ message: 'Данные успешно восстановлены из резервной копии' });
      } catch (err) {
        await client.query('ROLLBACK');
        throw err;
      } finally {
        client.release();
      }
    } catch (error) {
      console.error('Ошибка восстановления:', error);
      res.status(500).json({ error: 'Не удалось восстановить данные: ' + error.message });
    }
  },
  async download(req, res) {
    try {
      const { filename } = req.params;
      const safeName = path.basename(filename);
      const filePath = path.join(__dirname, '../../backups', safeName);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Файл резервной копии не найден' });
      }
      res.download(filePath, safeName);
    } catch (error) {
      console.error('Ошибка скачивания:', error);
      res.status(500).json({ error: 'Не удалось скачать резервную копию: ' + error.message });
    }
  },
  async delete(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT filename FROM backups WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Резервная копия не найдена' });
      }
      const filePath = path.join(__dirname, '../../backups', result.rows[0].filename);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      await pool.query('DELETE FROM backups WHERE id = $1', [id]);
      res.json({ message: 'Резервная копия удалена' });
    } catch (error) {
      console.error('Ошибка удаления:', error);
      res.status(500).json({ error: 'Не удалось удалить резервную копию: ' + error.message });
    }
  }
};
module.exports = backupController;