const pool = require('../config/database');
const path = require('path');
const fs = require('fs');
const auditService = {
  async log(userId, action, entityType, entityId) {
    try {
      await pool.query(
        'INSERT INTO audit_log (user_id, action, entity_type, entity_id) VALUES ($1, $2, $3, $4)',
        [userId, action, entityType, entityId]
      );
    } catch (error) {
      console.error('Ошибка записи в аудит:', error);
    }
  }
};
const documentController = {
  async search(req, res) {
    try {
      const { query, category_id, type, status, tag_id } = req.query;
      let sql = `
        SELECT DISTINCT d.*, 
               c.name as category_name,
               u.full_name as author_name,
               array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tag_names
        FROM documents d
        LEFT JOIN categories c ON d.category_id = c.id
        LEFT JOIN users u ON d.author_id = u.id
        LEFT JOIN document_tags dt ON d.id = dt.document_id
        LEFT JOIN tags t ON dt.tag_id = t.id
        WHERE 1=1
      `;
      const params = [];
      let paramIndex = 1;
      if (req.user.role === 'admin') {
        sql += ` AND d.status IN ('in_library', 'archived')`;
      } else {
        sql += ` AND d.status IN ('in_library', 'archived')`;
      }
      if (query) {
        sql += ` AND (d.title ILIKE $${paramIndex} OR d.code ILIKE $${paramIndex} OR d.description ILIKE $${paramIndex})`;
        params.push(`%${query}%`);
        paramIndex++;
      }
      if (category_id) {
        sql += ` AND d.category_id = $${paramIndex++}`;
        params.push(category_id);
      }
      if (type) {
        sql += ` AND d.type = $${paramIndex++}`;
        params.push(type);
      }
      if (status) {
        sql += ` AND d.status = $${paramIndex++}`;
        params.push(status);
      }
      if (tag_id) {
        sql += ` AND dt.tag_id = $${paramIndex++}`;
        params.push(tag_id);
      }
      sql += ` GROUP BY d.id, c.name, u.full_name`;
      sql += ` ORDER BY d.updated_at DESC`;
      const result = await pool.query(sql, params);
      res.json({ documents: result.rows });
    } catch (error) {
      console.error('Ошибка поиска документов:', error);
      res.status(500).json({ error: 'Ошибка поиска документов' });
    }
  },
  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query(`
        SELECT d.*, 
               c.name as category_name,
               u.full_name as author_name
        FROM documents d
        LEFT JOIN categories c ON d.category_id = c.id
        LEFT JOIN users u ON d.author_id = u.id
        WHERE d.id = $1
      `, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Документ не найден' });
      }
      const document = result.rows[0];
      if (req.user.role === 'technical_specialist' && document.status !== 'in_library') {
        return res.status(403).json({ error: 'Нет доступа к этому документу' });
      }
      const tagsResult = await pool.query(`
        SELECT t.* FROM tags t
        JOIN document_tags dt ON t.id = dt.tag_id
        WHERE dt.document_id = $1
      `, [id]);
      document.tags = tagsResult.rows;
      await auditService.log(req.user.id, 'document_view', 'document', id);
      res.json(document);
    } catch (error) {
      console.error('Ошибка получения документа:', error);
      res.status(500).json({ error: 'Ошибка получения документа' });
    }
  },
  async preview(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Документ не найден' });
      }
      const document = result.rows[0];
      if (!document.file_path) {
        return res.status(404).json({ error: 'У документа нет файла' });
      }
      const uploadsDir = path.join(__dirname, '../../uploads');
      const filePath = path.join(uploadsDir, document.file_path);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Файл не найден на сервере' });
      }
      const ext = path.extname(document.file_path).toLowerCase();
      const mimeTypes = {
        '.pdf': 'application/pdf',
        '.doc': 'application/msword',
        '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        '.xls': 'application/vnd.ms-excel',
        '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        '.png': 'image/png',
        '.jpg': 'image/jpeg',
        '.jpeg': 'image/jpeg',
        '.gif': 'image/gif',
      };
      const contentType = mimeTypes[ext] || 'application/octet-stream';
      res.setHeader('Content-Type', contentType);
      res.setHeader('Content-Disposition', 'inline');
      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      console.error('Ошибка просмотра файла:', error);
      res.status(500).json({ error: 'Ошибка просмотра файла' });
    }
  },
  async create(req, res) {
    try {
      const { title, code, type, category_id, description, tags, approver_ids } = req.body;
      const file = req.file;
      if (!title || !code || !type) {
        return res.status(400).json({ error: 'Заполните обязательные поля' });
      }
      if (!approver_ids) {
        return res.status(400).json({ error: 'Выберите согласующих руководителей' });
      }
      const codeCheck = await pool.query('SELECT id FROM documents WHERE code = $1', [code]);
      if (codeCheck.rows.length > 0) {
        return res.status(400).json({ error: 'Документ с таким кодом уже существует' });
      }
      const filePath = file ? file.filename : null;
      const fileSize = file ? file.size : null;
      const result = await pool.query(`
        INSERT INTO documents (title, code, type, category_id, description, file_path, file_size, author_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'pending_approval')
        RETURNING *
      `, [title, code, type, category_id || null, description || null, filePath, fileSize, req.user.id]);
      const documentId = result.rows[0].id;
      const approvers = typeof approver_ids === 'string' ? JSON.parse(approver_ids) : approver_ids;
      const ticketResult = await pool.query(`
        INSERT INTO approval_tickets (document_id, created_by, stage, total_stages, status)
        VALUES ($1, $2, 1, 1, 'pending')
        RETURNING id
      `, [documentId, req.user.id]);
      const ticketId = ticketResult.rows[0].id;
      for (const approverId of approvers) {
        await pool.query(`
          INSERT INTO ticket_approvers (ticket_id, user_id, status)
          VALUES ($1, $2, 'pending')
          ON CONFLICT DO NOTHING
        `, [ticketId, approverId]);
      }
      const newTagResult = await pool.query(
        "SELECT id FROM tags WHERE LOWER(name) IN ('новый', 'новое', 'new') LIMIT 1"
      );
      if (newTagResult.rows.length > 0) {
        await pool.query(
          'INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
          [documentId, newTagResult.rows[0].id]
        );
      }
      if (tags) {
        const tagIds = typeof tags === 'string' ? JSON.parse(tags) : tags;
        if (Array.isArray(tagIds)) {
          for (const tagId of tagIds) {
            const tagExists = await pool.query('SELECT id FROM tags WHERE id = $1', [tagId]);
            if (tagExists.rows.length > 0) {
              await pool.query(
                'INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
                [documentId, tagId]
              );
            }
          }
        }
      }
      await auditService.log(req.user.id, 'document_create', 'document', documentId);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Ошибка создания документа:', error);
      res.status(500).json({ error: 'Ошибка создания документа: ' + error.message });
    }
  },
  async update(req, res) {
    try {
      const { id } = req.params;
      const { title, code, type, category_id, description, tags } = req.body;
      const file = req.file;
      const docCheck = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
      if (docCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Документ не найден' });
      }
      const currentDoc = docCheck.rows[0];
      const isInLibrary = currentDoc.status === 'in_library';
      let updateFields = [];
      let params = [];
      let paramIndex = 1;
      if (title) {
        updateFields.push(`title = $${paramIndex++}`);
        params.push(title);
      }
      if (code) {
        updateFields.push(`code = $${paramIndex++}`);
        params.push(code);
      }
      if (type) {
        updateFields.push(`type = $${paramIndex++}`);
        params.push(type);
      }
      updateFields.push(`category_id = $${paramIndex++}`);
      params.push(category_id || null);
      if (description !== undefined) {
        updateFields.push(`description = $${paramIndex++}`);
        params.push(description);
      }
      if (file) {
        updateFields.push(`file_path = $${paramIndex++}`);
        params.push(file.filename);
        updateFields.push(`file_size = $${paramIndex++}`);
        params.push(file.size);
        if (isInLibrary) {
          updateFields.push(`current_version = current_version + 1`);
        }
      }
      updateFields.push(`updated_at = CURRENT_TIMESTAMP`);
      params.push(id);
      const result = await pool.query(`
        UPDATE documents SET ${updateFields.join(', ')}
        WHERE id = $${paramIndex}
        RETURNING *
      `, params);
      if (tags !== undefined) {
        await pool.query('DELETE FROM document_tags WHERE document_id = $1', [id]);
        const tagIds = typeof tags === 'string' ? JSON.parse(tags) : tags;
        if (Array.isArray(tagIds)) {
          for (const tagId of tagIds) {
            await pool.query(
              'INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING',
              [id, tagId]
            );
          }
        }
      }
      if (file && isInLibrary) {
        await pool.query(`
          INSERT INTO document_versions (document_id, version_number, file_path, file_size, created_by, comment)
          VALUES ($1, $2, $3, $4, $5, 'Обновление документа')
        `, [id, result.rows[0].current_version, file.filename, file.size, req.user.id]);
      }
      await auditService.log(req.user.id, 'document_update', 'document', id);
      res.json(result.rows[0]);
    } catch (error) {
      console.error('Ошибка обновления документа:', error);
      res.status(500).json({ error: 'Ошибка обновления документа' });
    }
  },
  async download(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Документ не найден' });
      }
      const document = result.rows[0];
      if (!document.file_path) {
        return res.status(404).json({ error: 'У документа нет файла' });
      }
      const uploadsDir = path.join(__dirname, '../../uploads');
      const filePath = path.join(uploadsDir, document.file_path);
      if (!fs.existsSync(filePath)) {
        return res.status(404).json({ error: 'Файл не найден на сервере' });
      }
      await auditService.log(req.user.id, 'document_download', 'document', id);
      const ext = path.extname(document.file_path);
      const downloadName = `${document.code}${ext}`;
      res.download(filePath, downloadName);
    } catch (error) {
      console.error('Ошибка скачивания файла:', error);
      res.status(500).json({ error: 'Ошибка скачивания файла' });
    }
  },
  async delete(req, res) {
    try {
      const { id } = req.params;
      const docCheck = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
      if (docCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Документ не найден' });
      }
      const document = docCheck.rows[0];
      if (document.status === 'in_library') {
        await pool.query(
          `UPDATE documents SET status = 'pending_deletion', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
          [id]
        );
        await auditService.log(req.user.id, 'document_delete_request', 'document', id);
        return res.json({ message: 'Запрос на удаление отправлен руководителю' });
      }
      await pool.query('DELETE FROM ticket_approvers WHERE ticket_id IN (SELECT id FROM approval_tickets WHERE document_id = $1)', [id]);
      await pool.query('DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM approval_tickets WHERE document_id = $1)', [id]);
      await pool.query('DELETE FROM document_versions WHERE document_id = $1', [id]);
      await pool.query('DELETE FROM document_tags WHERE document_id = $1', [id]);
      await pool.query('DELETE FROM comments WHERE document_id = $1', [id]);
      await pool.query('DELETE FROM favorites WHERE document_id = $1', [id]);
      await pool.query('DELETE FROM approval_tickets WHERE document_id = $1', [id]);
      await pool.query('DELETE FROM documents WHERE id = $1', [id]);
      await auditService.log(req.user.id, 'document_delete', 'document', id);
      res.json({ message: 'Документ удален' });
    } catch (error) {
      console.error('Ошибка удаления документа:', error);
      res.status(500).json({ error: 'Ошибка удаления документа' });
    }
  },
  async getComments(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query(`
        SELECT c.*, u.full_name as author_name
        FROM comments c
        JOIN users u ON c.user_id = u.id
        WHERE c.document_id = $1 AND c.user_id = $2
        ORDER BY c.created_at DESC
      `, [id, req.user.id]);
      res.json(result.rows);
    } catch (error) {
      console.error('Ошибка получения заметок:', error);
      res.status(500).json({ error: 'Ошибка получения заметок' });
    }
  },
  async addComment(req, res) {
    try {
      const { id } = req.params;
      const { content } = req.body;
      if (!content || !content.trim()) {
        return res.status(400).json({ error: 'Введите текст заметки' });
      }
      const result = await pool.query(`
        INSERT INTO comments (document_id, user_id, content)
        VALUES ($1, $2, $3)
        RETURNING *
      `, [id, req.user.id, content.trim()]);
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Ошибка добавления заметки:', error);
      res.status(500).json({ error: 'Ошибка добавления заметки' });
    }
  },
  async deleteComment(req, res) {
    try {
      const { id, commentId } = req.params;
      const check = await pool.query(
        'SELECT id FROM comments WHERE id = $1 AND user_id = $2',
        [commentId, req.user.id]
      );
      if (check.rows.length === 0) {
        return res.status(403).json({ error: 'Нет доступа к этой заметке' });
      }
      await pool.query('DELETE FROM comments WHERE id = $1', [commentId]);
      res.json({ message: 'Заметка удалена' });
    } catch (error) {
      console.error('Ошибка удаления заметки:', error);
      res.status(500).json({ error: 'Ошибка удаления заметки' });
    }
  },
  async addToFavorites(req, res) {
    try {
      const { id } = req.params;
      await pool.query(`
        INSERT INTO favorites (user_id, document_id)
        VALUES ($1, $2)
        ON CONFLICT DO NOTHING
      `, [req.user.id, id]);
      res.json({ message: 'Добавлено в избранное' });
    } catch (error) {
      res.status(500).json({ error: 'Ошибка добавления в избранное' });
    }
  },
  async removeFromFavorites(req, res) {
    try {
      const { id } = req.params;
      await pool.query(
        'DELETE FROM favorites WHERE user_id = $1 AND document_id = $2',
        [req.user.id, id]
      );
      res.json({ message: 'Удалено из избранного' });
    } catch (error) {
      res.status(500).json({ error: 'Ошибка удаления из избранного' });
    }
  },
  async getFavorites(req, res) {
    try {
      const result = await pool.query(`
        SELECT d.*, c.name as category_name
        FROM favorites f
        JOIN documents d ON f.document_id = d.id
        LEFT JOIN categories c ON d.category_id = c.id
        WHERE f.user_id = $1 AND d.status = 'in_library'
        ORDER BY f.created_at DESC
      `, [req.user.id]);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Ошибка получения избранного' });
    }
  },
  async getVersions(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query(`
        SELECT v.*, u.full_name as created_by_name
        FROM document_versions v
        LEFT JOIN users u ON v.created_by = u.id
        WHERE v.document_id = $1
        ORDER BY v.version_number DESC
      `, [id]);
      res.json(result.rows);
    } catch (error) {
      res.status(500).json({ error: 'Ошибка получения версий' });
    }
  },
  async generateReport(req, res) {
    try {
      const result = await pool.query(`
        SELECT 
          d.code, d.title, d.type, d.status,
          c.name as category_name,
          u.full_name as author_name,
          d.current_version, d.created_at, d.updated_at
        FROM documents d
        LEFT JOIN categories c ON d.category_id = c.id
        LEFT JOIN users u ON d.author_id = u.id
        ORDER BY d.created_at DESC
      `);
      const typeNames = {
        drawing: 'Чертеж', standard: 'Стандарт', specification: 'Спецификация',
        instruction: 'Инструкция', manual: 'Руководство', other: 'Другое'
      };
      const statusNames = {
        pending_approval: 'На согласовании', in_library: 'В библиотеке',
        archived: 'В архиве', withdrawn: 'Отозван', pending_deletion: 'На удаление'
      };
      let csv = 'Код;Название;Тип;Статус;Категория;Автор;Версия;Создан;Обновлен\n';
      result.rows.forEach(row => {
        const createdAt = new Date(row.created_at).toLocaleDateString('ru-RU');
        const updatedAt = new Date(row.updated_at).toLocaleDateString('ru-RU');
        csv += `${row.code};${row.title};${typeNames[row.type] || row.type};${statusNames[row.status] || row.status};${row.category_name || '-'};${row.author_name || '-'};${row.current_version};${createdAt};${updatedAt}\n`;
      });
      res.setHeader('Content-Type', 'text/csv; charset=utf-8');
      res.setHeader('Content-Disposition', 'attachment; filename=report.csv');
      res.send('\uFEFF' + csv);
    } catch (error) {
      res.status(500).json({ error: 'Ошибка формирования отчета' });
    }
  },
  async approveDeletion(req, res) {
    try {
      const { id } = req.params;
      const docCheck = await pool.query('SELECT file_path FROM documents WHERE id = $1', [id]);
      if (docCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Документ не найден' });
      }
      if (docCheck.rows[0].file_path) {
        const filePath = path.join(__dirname, '../../uploads', docCheck.rows[0].file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      await pool.query('DELETE FROM ticket_approvers WHERE ticket_id IN (SELECT id FROM approval_tickets WHERE document_id = $1)', [id]);
      await pool.query('DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM approval_tickets WHERE document_id = $1)', [id]);
      await pool.query('DELETE FROM document_versions WHERE document_id = $1', [id]);
      await pool.query('DELETE FROM document_tags WHERE document_id = $1', [id]);
      await pool.query('DELETE FROM comments WHERE document_id = $1', [id]);
      await pool.query('DELETE FROM favorites WHERE document_id = $1', [id]);
      await pool.query('DELETE FROM approval_tickets WHERE document_id = $1', [id]);
      await pool.query('DELETE FROM documents WHERE id = $1', [id]);
      await auditService.log(req.user.id, 'document_delete_approved', 'document', id);
      res.json({ message: 'Документ удален' });
    } catch (error) {
      res.status(500).json({ error: 'Ошибка удаления документа' });
    }
  },
  async rejectDeletion(req, res) {
    try {
      const { id } = req.params;
      await pool.query(
        `UPDATE documents SET status = 'in_library', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      );
      await auditService.log(req.user.id, 'document_delete_rejected', 'document', id);
      res.json({ message: 'Запрос на удаление отменен' });
    } catch (error) {
      res.status(500).json({ error: 'Ошибка' });
    }
  },
  async archive(req, res) {
    try {
      const { id } = req.params;
      const docCheck = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
      if (docCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Документ не найден' });
      }
      const document = docCheck.rows[0];
      if (document.status !== 'in_library') {
        return res.status(400).json({ error: 'Можно архивировать только документы из библиотеки' });
      }
      await pool.query(
        `UPDATE documents SET status = 'archived', archived_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      );
      await auditService.log(req.user.id, 'document_archive', 'document', id);
      res.json({ message: 'Документ перемещен в архив' });
    } catch (error) {
      console.error('Ошибка архивирования:', error);
      res.status(500).json({ error: 'Ошибка архивирования документа' });
    }
  },
  async restore(req, res) {
    try {
      const { id } = req.params;
      const docCheck = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
      if (docCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Документ не найден' });
      }
      if (docCheck.rows[0].status !== 'archived') {
        return res.status(400).json({ error: 'Документ не находится в архиве' });
      }
      await pool.query(
        `UPDATE documents SET status = 'in_library', archived_at = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [id]
      );
      await auditService.log(req.user.id, 'document_restore', 'document', id);
      res.json({ message: 'Документ восстановлен из архива' });
    } catch (error) {
      console.error('Ошибка восстановления:', error);
      res.status(500).json({ error: 'Ошибка восстановления документа' });
    }
  }
};
module.exports = documentController;