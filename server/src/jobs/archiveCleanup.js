const pool = require('../config/database');
const fs = require('fs');
const path = require('path');

async function cleanupArchivedDocuments() {
  try {
    // Получаем настройку срока хранения
    const settingResult = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'archive_retention_days'"
    );
    
    const retentionDays = settingResult.rows.length > 0
      ? parseInt(settingResult.rows[0].value)
      : 365;
    
    // 0 означает хранить вечно
    if (retentionDays === 0) {
      console.log('Автоудаление архива отключено (retention = 0)');
      return;
    }
    
    // Находим документы для удаления
    const expiredDocs = await pool.query(`
      SELECT id, file_path FROM documents
      WHERE status = 'archived'
      AND archived_at IS NOT NULL
      AND archived_at < NOW() - INTERVAL '${retentionDays} days'
    `);
    
    console.log(`Найдено ${expiredDocs.rows.length} документов для удаления из архива`);
    
    for (const doc of expiredDocs.rows) {
      // Удаляем файл
      if (doc.file_path) {
        const filePath = path.join(__dirname, '../../uploads', doc.file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      
      // Удаляем связанные записи
      await pool.query('DELETE FROM ticket_approvers WHERE ticket_id IN (SELECT id FROM approval_tickets WHERE document_id = $1)', [doc.id]);
      await pool.query('DELETE FROM ticket_messages WHERE ticket_id IN (SELECT id FROM approval_tickets WHERE document_id = $1)', [doc.id]);
      await pool.query('DELETE FROM document_versions WHERE document_id = $1', [doc.id]);
      await pool.query('DELETE FROM document_tags WHERE document_id = $1', [doc.id]);
      await pool.query('DELETE FROM comments WHERE document_id = $1', [doc.id]);
      await pool.query('DELETE FROM favorites WHERE document_id = $1', [doc.id]);
      await pool.query('DELETE FROM approval_tickets WHERE document_id = $1', [doc.id]);
      await pool.query('DELETE FROM documents WHERE id = $1', [doc.id]);
      
      console.log(`Удален документ #${doc.id}`);
    }
    
    console.log('Очистка архива завершена');
  } catch (error) {
    console.error('Ошибка очистки архива:', error);
  }
}

async function cleanupOldTickets() {
  try {
    // Получаем настройку срока хранения тикетов
    const settingResult = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'ticket_retention_days'"
    );
    
    const retentionDays = settingResult.rows.length > 0
      ? parseInt(settingResult.rows[0].value)
      : 90;
    
    // 0 означает хранить вечно
    if (retentionDays === 0) {
      console.log('Автоудаление тикетов отключено (retention = 0)');
      return;
    }
    
    // Находим закрытые/отклоненные тикеты для удаления
    const expiredTickets = await pool.query(`
      SELECT id FROM approval_tickets 
      WHERE status IN ('resolved', 'rejected', 'closed')
      AND closed_at IS NOT NULL 
      AND closed_at < NOW() - INTERVAL '${retentionDays} days'
    `);
    
    console.log(`Найдено ${expiredTickets.rows.length} тикетов для удаления`);
    
    for (const ticket of expiredTickets.rows) {
      await pool.query('DELETE FROM ticket_approvers WHERE ticket_id = $1', [ticket.id]);
      await pool.query('DELETE FROM ticket_messages WHERE ticket_id = $1', [ticket.id]);
      await pool.query('DELETE FROM approval_tickets WHERE id = $1', [ticket.id]);
      
      console.log(`Удален тикет #${ticket.id}`);
    }
    
    console.log('Очистка тикетов завершена');
  } catch (error) {
    console.error('Ошибка очистки тикетов:', error);
  }
}

async function runCleanup() {
  console.log('Запуск очистки...');
  await cleanupArchivedDocuments();
  await cleanupOldTickets();
  console.log('Очистка завершена');
}

module.exports = runCleanup;