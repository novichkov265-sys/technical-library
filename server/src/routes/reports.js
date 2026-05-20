const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
router.use(authMiddleware);
router.use(roleMiddleware(['librarian', 'admin']));
router.get('/stats', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    let dateCondition = '';
    const params = [];
    if (date_from) {
      params.push(date_from);
      dateCondition += ` AND d.created_at >= $${params.length}`;
    }
    if (date_to) {
      params.push(date_to);
      dateCondition += ` AND d.created_at <= $${params.length}::date + interval '1 day'`;
    }
    const totalDocs = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'in_library') as in_library,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'pending_approval') as pending,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'archived') as archived,
        COALESCE(SUM(views), 0) as total_views,
        COALESCE(SUM(downloads), 0) as total_downloads
      FROM documents d
      WHERE 1=1 ${dateCondition}
    `, params);
    const byType = await pool.query(`
      SELECT 
        type,
        COUNT(*) as count,
        COALESCE(SUM(views), 0) as views,
        COALESCE(SUM(downloads), 0) as downloads
      FROM documents d
      WHERE 1=1 ${dateCondition}
      GROUP BY type
      ORDER BY count DESC
    `, params);
    const byCategory = await pool.query(`
      SELECT 
        COALESCE(c.name, 'Без категории') as category,
        COUNT(*) as count,
        COALESCE(SUM(d.views), 0) as views,
        COALESCE(SUM(d.downloads), 0) as downloads
      FROM documents d
      LEFT JOIN categories c ON d.category_id = c.id
      WHERE 1=1 ${dateCondition}
      GROUP BY c.name
      ORDER BY count DESC
    `, params);
    const topDocuments = await pool.query(`
      SELECT 
        d.id,
        d.title,
        d.code,
        d.type,
        COALESCE(d.views, 0) as views,
        COALESCE(d.downloads, 0) as downloads,
        c.name as category_name
      FROM documents d
      LEFT JOIN categories c ON d.category_id = c.id
      WHERE d.status = 'in_library' ${dateCondition}
      ORDER BY d.views DESC NULLS LAST
      LIMIT 10
    `, params);
    const userActivity = await pool.query(`
      SELECT 
        u.full_name,
        u.role,
        COUNT(*) FILTER (WHERE al.action = 'document_view') as views,
        COUNT(*) FILTER (WHERE al.action = 'document_download') as downloads,
        COUNT(*) FILTER (WHERE al.action = 'document_create') as created
      FROM users u
      LEFT JOIN audit_log al ON u.id = al.user_id
      WHERE al.created_at >= COALESCE($1::date, NOW() - interval '30 days')
        AND al.created_at <= COALESCE($2::date + interval '1 day', NOW())
      GROUP BY u.id, u.full_name, u.role
      ORDER BY views DESC
      LIMIT 10
    `, [date_from || null, date_to || null]);
    const approvalStats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'approved') as approved,
        COUNT(*) FILTER (WHERE status = 'rejected') as rejected,
        COUNT(*) FILTER (WHERE status = 'pending') as pending
      FROM approval_tickets
      WHERE created_at >= COALESCE($1::date, NOW() - interval '30 days')
        AND created_at <= COALESCE($2::date + interval '1 day', NOW())
    `, [date_from || null, date_to || null]);
    res.json({
      summary: totalDocs.rows[0],
      byType: byType.rows,
      byCategory: byCategory.rows,
      topDocuments: topDocuments.rows,
      userActivity: userActivity.rows,
      approvalStats: approvalStats.rows[0]
    });
  } catch (error) {
    console.error('Ошибка получения статистики:', error);
    res.status(500).json({ error: 'Ошибка сервера' });
  }
});
router.get('/export/excel', async (req, res) => {
  try {
    const { date_from, date_to } = req.query;
    const ExcelJS = require('exceljs');
    
    let dateCondition = '';
    const params = [];
    if (date_from) {
      params.push(date_from);
      dateCondition += ` AND d.created_at >= $${params.length}`;
    }
    if (date_to) {
      params.push(date_to);
      dateCondition += ` AND d.created_at <= $${params.length}::date + interval '1 day'`;
    }
    const documents = await pool.query(`
      SELECT 
        d.code,
        d.title,
        d.type,
        d.status,
        c.name as category,
        d.views,
        d.downloads,
        d.created_at,
        u.full_name as created_by
      FROM documents d
      LEFT JOIN categories c ON d.category_id = c.id
      LEFT JOIN users u ON d.created_by = u.id
      WHERE 1=1 ${dateCondition}
      ORDER BY d.created_at DESC
    `, params);
    const stats = await pool.query(`
      SELECT 
        COUNT(*) as total,
        COUNT(*) FILTER (WHERE status = 'in_library') as in_library,
        COUNT(*) FILTER (WHERE status = 'draft') as draft,
        COUNT(*) FILTER (WHERE status = 'pending_approval') as pending,
        COUNT(*) FILTER (WHERE status = 'archived') as archived,
        COALESCE(SUM(views), 0) as total_views,
        COALESCE(SUM(downloads), 0) as total_downloads
      FROM documents d
      WHERE 1=1 ${dateCondition}
    `, params);
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Техническая библиотека';
    workbook.created = new Date();
    const summarySheet = workbook.addWorksheet('Сводка');
    summarySheet.columns = [
      { header: 'Показатель', key: 'name', width: 30 },
      { header: 'Значение', key: 'value', width: 15 }
    ];
    const summary = stats.rows[0];
    summarySheet.addRows([
      { name: 'Всего документов', value: parseInt(summary.total) },
      { name: 'В библиотеке', value: parseInt(summary.in_library) },
      { name: 'Черновики', value: parseInt(summary.draft) },
      { name: 'На согласовании', value: parseInt(summary.pending) },
      { name: 'В архиве', value: parseInt(summary.archived) },
      { name: 'Всего просмотров', value: parseInt(summary.total_views) },
      { name: 'Всего скачиваний', value: parseInt(summary.total_downloads) }
    ]);
    summarySheet.getRow(1).font = { bold: true };
    summarySheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    };
    summarySheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    const docsSheet = workbook.addWorksheet('Документы');
    docsSheet.columns = [
      { header: 'Код', key: 'code', width: 15 },
      { header: 'Название', key: 'title', width: 40 },
      { header: 'Тип', key: 'type', width: 15 },
      { header: 'Статус', key: 'status', width: 15 },
      { header: 'Категория', key: 'category', width: 20 },
      { header: 'Просмотры', key: 'views', width: 12 },
      { header: 'Скачивания', key: 'downloads', width: 12 },
      { header: 'Создан', key: 'created_at', width: 20 },
      { header: 'Автор', key: 'created_by', width: 25 }
    ];
    const typeNames = {
      drawing: 'Чертеж',
      standard: 'Стандарт',
      specification: 'Спецификация',
      instruction: 'Инструкция',
      manual: 'Руководство',
      other: 'Другое'
    };
    const statusNames = {
      draft: 'Черновик',
      pending_approval: 'На согласовании',
      approved: 'Утвержден',
      in_library: 'В библиотеке',
      archived: 'В архиве'
    };
    documents.rows.forEach(doc => {
      docsSheet.addRow({
        code: doc.code,
        title: doc.title,
        type: typeNames[doc.type] || doc.type,
        status: statusNames[doc.status] || doc.status,
        category: doc.category || 'Без категории',
        views: doc.views || 0,
        downloads: doc.downloads || 0,
        created_at: new Date(doc.created_at).toLocaleString('ru-RU'),
        created_by: doc.created_by
      });
    });
    docsSheet.getRow(1).font = { bold: true };
    docsSheet.getRow(1).fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF2563EB' }
    };
    docsSheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename=report_${Date.now()}.xlsx`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (error) {
    console.error('Ошибка генерации Excel:', error);
    res.status(500).json({ error: 'Ошибка генерации отчета' });
  }
});
module.exports = router;