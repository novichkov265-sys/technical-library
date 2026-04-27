const pool = require('../config/database');
const { createNotification } = require('../routes/notifications');
const logAudit = async (userId, action, entityType, entityId, ipAddress, details = null) => {
  try {
    const ip = ipAddress === '::1' ? '127.0.0.1' : (ipAddress || 'unknown');
    await pool.query(
      `INSERT INTO audit_log (user_id, action, entity_type, entity_id, ip_address, details, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, NOW())`,
      [userId, action, entityType, entityId, ip, details]
    );
  } catch (err) {
    console.error('Ошибка записи в аудит:', err);
  }
};
const ticketController = {
  async getAll(req, res) {
    try {
      const userId = req.user.id;
      const userRole = req.user.role;
      let query = `
        SELECT t.*, 
               d.title as document_title, 
               d.code as document_code,
               d.type as document_type,
               u.full_name as created_by_name
        FROM approval_tickets t
        LEFT JOIN documents d ON t.document_id = d.id
        LEFT JOIN users u ON t.created_by = u.id
      `;
      let params = [];
if (userRole === 'user') {
  query += ` WHERE t.created_by = $1`;
  params.push(userId);
} else if (userRole === 'department_head') {
  query += ` WHERE t.created_by = $1 OR t.assigned_to = $1`;
  params.push(userId);
}
      query += ` ORDER BY t.created_at DESC`;
      const result = await pool.query(query, params);
      res.json(result.rows);
    } catch (error) {
      console.error('Ошибка получения тикетов:', error);
      res.status(500).json({ error: 'Не удалось загрузить заявки: ' + error.message });
    }
  },
  async getById(req, res) {
    try {
      const { id } = req.params;
      const result = await pool.query(`
        SELECT t.*, 
               d.title as document_title, 
               d.code as document_code,
               d.type as document_type,
               d.file_path,
               d.file_name,
               d.description as document_description,
               u.full_name as created_by_name,
               u.email as created_by_email
        FROM approval_tickets t
        LEFT JOIN documents d ON t.document_id = d.id
        LEFT JOIN users u ON t.created_by = u.id
        WHERE t.id = $1
      `, [id]);
      if (result.rows.length === 0) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }
      const messagesResult = await pool.query(`
        SELECT tm.*, u.full_name as author_name, u.role as author_role
        FROM ticket_messages tm
        JOIN users u ON tm.user_id = u.id
        WHERE tm.ticket_id = $1
        ORDER BY tm.created_at ASC
      `, [id]);
      const ticket = result.rows[0];
      const messages = messagesResult.rows;
      res.json({ ticket, messages });
    } catch (error) {
      console.error('Ошибка получения тикета:', error);
      res.status(500).json({ error: 'Не удалось загрузить заявку: ' + error.message });
    }
  },
  async addMessage(req, res) {
    try {
      const { id } = req.params;
      const { message } = req.body;
      const userId = req.user.id;
      if (!message || !message.trim()) {
        return res.status(400).json({ error: 'Сообщение не может быть пустым' });
      }
      const ticketCheck = await pool.query('SELECT id, created_by, status FROM approval_tickets WHERE id = $1', [id]);
      if (ticketCheck.rows.length === 0) {
        return res.status(404).json({ error: 'Заявка не найдена' });
      }
      const ticket = ticketCheck.rows[0];
      if (ticket.status === 'approved' || ticket.status === 'rejected') {
        return res.status(400).json({ error: 'Нельзя добавить сообщение в закрытую заявку' });
      }
      const result = await pool.query(`
        INSERT INTO ticket_messages (ticket_id, user_id, message, message_type)
        VALUES ($1, $2, $3, 'comment')
        RETURNING *
      `, [id, userId, message.trim()]);
      if (ticket.created_by !== userId) {
        await createNotification(
          ticket.created_by,
          'ticket_message',
          'Новое сообщение в заявке',
          `В вашей заявке #${id} новое сообщение`,
          'ticket',
          parseInt(id)
        );
      }
      res.status(201).json(result.rows[0]);
    } catch (error) {
      console.error('Ошибка добавления сообщения:', error);
      res.status(500).json({ error: 'Не удалось отправить сообщение: ' + error.message });
    }
  },
  async approve(req, res) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const userId = req.user.id;
      const userRole = req.user.role;
      if (userRole !== 'department_head' && userRole !== 'librarian' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Нет прав на согласование. Требуется роль руководителя, библиотекаря или администратора' });
      }
      await client.query('BEGIN');
      const ticketResult = await client.query(
        'SELECT * FROM approval_tickets WHERE id = $1',
        [id]
      );
      if (ticketResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Заявка не найдена' });
      }
      const ticket = ticketResult.rows[0];
      if (ticket.status === 'approved') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Заявка уже согласована' });
      }
      if (ticket.status === 'rejected') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Заявка уже отклонена, невозможно согласовать' });
      }
      await client.query(
        `UPDATE approval_tickets SET status = 'approved', closed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [id]
      );
      if (ticket.document_id) {
        await client.query(
          `UPDATE documents SET status = 'in_library', updated_at = NOW() WHERE id = $1`,
          [ticket.document_id]
        );
        const autoTags = ['Новое', 'Архив', 'Восстановлено из архива', 'Обновлено'];
        await client.query(
          `DELETE FROM document_tags WHERE document_id = $1 AND tag_id IN (
            SELECT id FROM tags WHERE name = ANY($2)
          )`,
          [ticket.document_id, autoTags]
        );
        let tagResult = await client.query(`SELECT id FROM tags WHERE name = 'Новое'`);
        let tagId;
        if (tagResult.rows.length === 0) {
          const newTag = await client.query(`INSERT INTO tags (name) VALUES ('Новое') RETURNING id`);
          tagId = newTag.rows[0].id;
        } else {
          tagId = tagResult.rows[0].id;
        }
        await client.query(
          `INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [ticket.document_id, tagId]
        );
      }
      const messageText = comment && comment.trim() 
        ? `Заявка согласована. ${comment.trim()}`
        : 'Заявка согласована. Документ добавлен в библиотеку.';
      await client.query(`
        INSERT INTO ticket_messages (ticket_id, user_id, message, message_type)
        VALUES ($1, $2, $3, 'approve')
      `, [id, userId, messageText]);
      await createNotification(
        ticket.created_by,
        'ticket_approved',
        'Заявка согласована',
        `Ваша заявка #${id} была согласована. Документ добавлен в библиотеку.`,
        'ticket',
        parseInt(id)
      );
      await client.query('COMMIT');
      await logAudit(userId, 'ticket_approve', 'ticket', id, req.ip, `Заявка #${id} согласована`);
      res.json({ message: 'Заявка согласована, документ добавлен в библиотеку' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Ошибка согласования:', error);
      res.status(500).json({ error: 'Не удалось согласовать заявку: ' + error.message });
    } finally {
      client.release();
    }
  },
  async reject(req, res) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { comment: reason } = req.body;
      const userId = req.user.id;
      const userRole = req.user.role;
      if (userRole !== 'department_head' && userRole !== 'librarian' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Нет прав на отклонение. Требуется роль руководителя, библиотекаря или администратора' });
      }
      if (!reason || !reason.trim()) {
        return res.status(400).json({ error: 'Укажите причину отклонения' });
      }
      await client.query('BEGIN');
      const ticketResult = await client.query(
        'SELECT * FROM approval_tickets WHERE id = $1',
        [id]
      );
      if (ticketResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Заявка не найдена' });
      }
      const ticket = ticketResult.rows[0];
      if (ticket.status === 'approved') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Заявка уже согласована, невозможно отклонить' });
      }
      if (ticket.status === 'rejected') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Заявка уже отклонена' });
      }
      await client.query(
        `UPDATE approval_tickets SET status = 'rejected', closed_at = NOW(), updated_at = NOW() WHERE id = $1`,
        [id]
      );
      if (ticket.document_id) {
        await client.query(
          `UPDATE documents SET status = 'rejected', updated_at = NOW() WHERE id = $1`,
          [ticket.document_id]
        );
      }
      await client.query(`
        INSERT INTO ticket_messages (ticket_id, user_id, message, message_type)
        VALUES ($1, $2, $3, 'reject')
      `, [id, userId, `Заявка отклонена. Причина: ${reason.trim()}`]);
      await createNotification(
        ticket.created_by,
        'ticket_rejected',
        'Заявка отклонена',
        `Ваша заявка #${id} была отклонена. Причина: ${reason.trim()}`,
        'ticket',
        parseInt(id)
      );
      await client.query('COMMIT');
      await logAudit(userId, 'ticket_reject', 'ticket', id, req.ip, `Заявка #${id} отклонена: ${reason}`);
      res.json({ message: 'Заявка отклонена' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Ошибка отклонения:', error);
      res.status(500).json({ error: 'Не удалось отклонить заявку: ' + error.message });
    } finally {
      client.release();
    }
  },
  async requestChanges(req, res) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const userId = req.user.id;
      const userRole = req.user.role;
      if (userRole !== 'department_head' && userRole !== 'librarian' && userRole !== 'admin') {
        return res.status(403).json({ error: 'Нет прав на запрос изменений. Требуется роль руководителя, библиотекаря или администратора' });
      }
      if (!comment || !comment.trim()) {
        return res.status(400).json({ error: 'Укажите, какие изменения необходимы' });
      }
      await client.query('BEGIN');
      const ticketResult = await client.query(
        'SELECT * FROM approval_tickets WHERE id = $1',
        [id]
      );
      if (ticketResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Заявка не найдена' });
      }
      const ticket = ticketResult.rows[0];
      if (ticket.status === 'approved' || ticket.status === 'rejected') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Невозможно запросить изменения для закрытой заявки' });
      }
      await client.query(
        `UPDATE approval_tickets SET status = 'changes_requested', updated_at = NOW() WHERE id = $1`,
        [id]
      );
      await client.query(`
        INSERT INTO ticket_messages (ticket_id, user_id, message, message_type)
        VALUES ($1, $2, $3, 'changes_requested')
      `, [id, userId, `Требуются изменения: ${comment.trim()}`]);
      await createNotification(
        ticket.created_by,
        'ticket_changes_requested',
        'Требуются изменения',
        `В заявке #${id} запрошены изменения: ${comment.trim()}`,
        'ticket',
        parseInt(id)
      );
      await client.query('COMMIT');
      await logAudit(userId, 'ticket_request_changes', 'ticket', id, req.ip, `Запрошены изменения: ${comment}`);
      res.json({ message: 'Запрос на изменения отправлен' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Ошибка запроса изменений:', error);
      res.status(500).json({ error: 'Не удалось запросить изменения: ' + error.message });
    } finally {
      client.release();
    }
  },
  async resubmit(req, res) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const userId = req.user.id;
      await client.query('BEGIN');
      const ticketResult = await client.query(
        'SELECT * FROM approval_tickets WHERE id = $1',
        [id]
      );
      if (ticketResult.rows.length === 0) {
        await client.query('ROLLBACK');
        return res.status(404).json({ error: 'Заявка не найдена' });
      }
      const ticket = ticketResult.rows[0];
      if (ticket.created_by !== userId) {
        await client.query('ROLLBACK');
        return res.status(403).json({ error: 'Вы можете повторно отправлять только свои заявки' });
      }
      if (ticket.status !== 'changes_requested') {
        await client.query('ROLLBACK');
        return res.status(400).json({ error: 'Повторно отправить можно только заявку со статусом "Требует доработки"' });
      }
      await client.query(
        `UPDATE approval_tickets SET status = 'pending', updated_at = NOW() WHERE id = $1`,
        [id]
      );
      const messageText = comment && comment.trim() 
        ? `Заявка повторно отправлена на согласование. Комментарий: ${comment.trim()}`
        : 'Заявка повторно отправлена на согласование';
      await client.query(`
        INSERT INTO ticket_messages (ticket_id, user_id, message, message_type)
        VALUES ($1, $2, $3, 'resubmit')
      `, [id, userId, messageText]);
      const approversResult = await pool.query(
        `SELECT id FROM users WHERE role IN ('department_head', 'librarian') AND id != $1`,
        [userId]
      );
      for (const approver of approversResult.rows) {
        await createNotification(
          approver.id,
          'ticket_resubmitted',
          'Заявка повторно отправлена',
          `Заявка #${id} повторно отправлена на согласование`,
          'ticket',
          parseInt(id)
        );
      }
      await client.query('COMMIT');
      res.json({ message: 'Заявка повторно отправлена на согласование' });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Ошибка повторной отправки:', error);
      res.status(500).json({ error: 'Не удалось повторно отправить заявку: ' + error.message });
    } finally {
      client.release();
    }
  },
  async updateDocument(req, res) {
    const client = await pool.connect();
    try {
      const { id } = req.params;
      const { comment } = req.body;
      const userId = req.user.id;
      if (!req.file) {
        return res.status(400).json({ error: 'Файл не загружен' });
      }
      await client.query('BEGIN');
      const ticketResult = await client.query(
        'SELECT t.*, d.file_path as old_file_path, d.version FROM approval_tickets t LEFT JOIN documents d ON t.document_id = d.id WHERE t.id = $1',
        [id]
      );
      if (ticketResult.rows.length === 0) {
        await client.query('ROLLBACK');
        const fs = require('fs');
        fs.unlinkSync(req.file.path);
        return res.status(404).json({ error: 'Заявка не найдена' });
      }
      const ticket = ticketResult.rows[0];
      if (ticket.created_by !== userId) {
        await client.query('ROLLBACK');
        const fs = require('fs');
        fs.unlinkSync(req.file.path);
        return res.status(403).json({ error: 'Вы можете обновлять только свои заявки' });
      }
      if (ticket.status !== 'pending' && ticket.status !== 'changes_requested') {
        await client.query('ROLLBACK');
        const fs = require('fs');
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Нельзя обновить документ в заявке со статусом: ' + ticket.status });
      }
      if (!ticket.document_id) {
        await client.query('ROLLBACK');
        const fs = require('fs');
        fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'В заявке нет привязанного документа' });
      }
      const currentVersion = parseInt(ticket.version) || 1;
      const newVersion = currentVersion + 1;
      if (ticket.old_file_path) {
        await client.query(
          `INSERT INTO document_versions (document_id, version_no, file_path, file_name, file_size, author_id, change_description)
           SELECT $1, $2, file_path, file_name, file_size, $3, 'Предыдущая версия (до обновления в заявке)'
           FROM documents WHERE id = $1`,
          [ticket.document_id, currentVersion, userId]
        );
      }
      await client.query(
        `UPDATE documents 
         SET file_path = $1, file_name = $2, file_size = $3, version = $4, updated_at = NOW()
         WHERE id = $5`,
        [req.file.filename, req.file.originalname, req.file.size, newVersion, ticket.document_id]
      );
      await client.query(
        `INSERT INTO document_versions (document_id, version_no, file_path, file_name, file_size, author_id, change_description)
         VALUES ($1, $2, $3, $4, $5, $6, $7)`,
        [ticket.document_id, newVersion, req.file.filename, req.file.originalname, req.file.size, userId, comment || 'Обновление документа в заявке']
      );
      const messageText = comment && comment.trim() 
        ? `Документ обновлен (версия ${newVersion}). Комментарий: ${comment.trim()}`
        : `Документ обновлен (версия ${newVersion})`;
      await client.query(`
        INSERT INTO ticket_messages (ticket_id, user_id, message, message_type)
        VALUES ($1, $2, $3, 'document_updated')
      `, [id, userId, messageText]);
      if (ticket.status === 'changes_requested') {
        await client.query(
          `UPDATE approval_tickets SET status = 'pending', updated_at = NOW() WHERE id = $1`,
          [id]
        );
      }
      const approversResult = await client.query(
        `SELECT id FROM users WHERE role IN ('department_head', 'librarian', 'admin') AND id != $1`,
        [userId]
      );
      for (const approver of approversResult.rows) {
        await createNotification(
          approver.id,
          'document_updated',
          'Документ обновлен',
          `Документ в заявке #${id} был обновлен`,
          'ticket',
          parseInt(id)
        );
      }
      await client.query('COMMIT');
      await logAudit(userId, 'ticket_document_update', 'ticket', id, req.ip, `Документ обновлен до версии ${newVersion}`);
      res.json({ 
        message: 'Документ успешно обновлен', 
        version: newVersion,
        file_name: req.file.originalname
      });
    } catch (error) {
      await client.query('ROLLBACK');
      console.error('Ошибка обновления документа:', error);
      if (req.file) {
        const fs = require('fs');
        try { fs.unlinkSync(req.file.path); } catch (e) {}
      }
      res.status(500).json({ error: 'Не удалось обновить документ: ' + error.message });
    } finally {
      client.release();
    }
  },
};
module.exports = ticketController;