const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const authMiddleware = require('../middleware/auth');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { createNotification } = require('./notifications');
const getClientIp = (req) => {
  const ip = req.ip || 
    req.headers['x-forwarded-for']?.split(',')[0] || 
    req.headers['x-real-ip'] ||
    req.connection?.remoteAddress ||
    'unknown';
  return ip === '::1' ? '127.0.0.1' : ip;
};
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
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({
  storage,
  limits: { fileSize: 100 * 1024 * 1024 }
});
async function getSetting(key, defaultValue = null) {
  try {
    const result = await pool.query('SELECT value FROM system_settings WHERE key = $1', [key]);
    return result.rows.length > 0 ? result.rows[0].value : defaultValue;
  } catch (err) {
    console.error('Ошибка получения настройки:', err);
    return defaultValue;
  }
}
async function isExtensionAllowed(filename) {
  const allowedExtensions = await getSetting('allowed_extensions', 'pdf,doc,docx,xls,xlsx,dwg,dxf,jpg,jpeg,png,gif,txt,zip,rar');
  const allowedList = allowedExtensions.split(',').map(ext => ext.trim().toLowerCase());
  const fileExt = path.extname(filename).toLowerCase().replace('.', '');
  return allowedList.includes(fileExt);
}
async function isFileSizeAllowed(size) {
  const maxSize = parseInt(await getSetting('max_file_size', '52428800'));
  return size <= maxSize;
}
async function cleanupOldVersions(documentId) {
  const client = await pool.connect();
  try {
    const keepVersions = await getSetting('keep_versions', 'true');
    if (keepVersions !== 'true') return;
    const maxVersions = parseInt(await getSetting('max_versions', '10'));
    const result = await client.query(
      `SELECT id, file_path FROM document_versions 
       WHERE document_id = $1 
       ORDER BY version_no DESC 
       OFFSET $2`,
      [documentId, maxVersions]
    );
    for (const version of result.rows) {
      if (version.file_path) {
        const filePath = path.join(__dirname, '../../uploads', version.file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      await client.query('DELETE FROM document_versions WHERE id = $1', [version.id]);
    }
    if (result.rows.length > 0) {
      console.log(`Удалено ${result.rows.length} старых версий документа ${documentId}`);
    }
  } catch (err) {
    console.error('Ошибка очистки версий:', err);
  } finally {
    client.release();
  }
}
async function cleanupArchivedDocuments() {
  const client = await pool.connect();
  try {
    const retentionDays = parseInt(await getSetting('archive_retention_days', '365'));
    if (retentionDays <= 0) return;
    const result = await client.query(
      `SELECT id, file_path FROM documents 
       WHERE status = 'archived' 
       AND archived_at < NOW() - INTERVAL '1 day' * $1`,
      [retentionDays]
    );
    for (const doc of result.rows) {
      if (doc.file_path) {
        const filePath = path.join(__dirname, '../../uploads', doc.file_path);
        if (fs.existsSync(filePath)) {
          fs.unlinkSync(filePath);
        }
      }
      const versions = await client.query(
        'SELECT file_path FROM document_versions WHERE document_id = $1',
        [doc.id]
      );
      for (const ver of versions.rows) {
        if (ver.file_path) {
          const verPath = path.join(__dirname, '../../uploads', ver.file_path);
          if (fs.existsSync(verPath)) {
            fs.unlinkSync(verPath);
          }
        }
      }
      await client.query('DELETE FROM document_versions WHERE document_id = $1', [doc.id]);
      await client.query('DELETE FROM comments WHERE document_id = $1', [doc.id]);
      await client.query('DELETE FROM favorites WHERE document_id = $1', [doc.id]);
      await client.query('DELETE FROM document_tags WHERE document_id = $1', [doc.id]);
      await client.query('DELETE FROM documents WHERE id = $1', [doc.id]);
    }
    if (result.rows.length > 0) {
      console.log(`Очищено ${result.rows.length} архивных документов`);
    }
  } catch (err) {
    console.error('Ошибка очистки архива:', err);
  } finally {
    client.release();
  }
}
setInterval(cleanupArchivedDocuments, 24 * 60 * 60 * 1000);
setTimeout(cleanupArchivedDocuments, 5000);
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { search, type, category_id, status, page = 1, limit = 20 } = req.query;
    const offset = (page - 1) * limit;
    const userRole = req.user.role;
    let query = `
      SELECT d.*, c.name as category_name, u.full_name as created_by_name
      FROM documents d
      LEFT JOIN categories c ON d.category_id = c.id
      LEFT JOIN users u ON d.created_by = u.id
      WHERE 1=1
    `;
    const params = [];
    let paramIndex = 1;
    if (status === 'archived') {
      if (userRole !== 'librarian' && userRole !== 'admin') {
        return res.json({ documents: [], total: 0, page: parseInt(page), limit: parseInt(limit) });
      }
      query += ` AND d.status = 'archived'`;
    } else if (status) {
      query += ` AND d.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    } else {
      query += ` AND d.status != 'archived'`;
    }
    if (search) {
      query += ` AND (d.title ILIKE $${paramIndex} OR d.code ILIKE $${paramIndex} OR d.description ILIKE $${paramIndex})`;
      params.push(`%${search}%`);
      paramIndex++;
    }
    if (type) {
      query += ` AND d.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    if (category_id) {
      query += ` AND d.category_id = $${paramIndex}`;
      params.push(category_id);
      paramIndex++;
    }
    query += ` ORDER BY d.created_at DESC LIMIT $${paramIndex} OFFSET $${paramIndex + 1}`;
    params.push(limit, offset);
    const result = await pool.query(query, params);
    let countQuery = `SELECT COUNT(*) FROM documents d WHERE 1=1`;
    const countParams = [];
    let countParamIndex = 1;
    if (status === 'archived') {
      countQuery += ` AND d.status = 'archived'`;
    } else if (status) {
      countQuery += ` AND d.status = $${countParamIndex}`;
      countParams.push(status);
      countParamIndex++;
    } else {
      countQuery += ` AND d.status != 'archived'`;
    }
    if (search) {
      countQuery += ` AND (d.title ILIKE $${countParamIndex} OR d.code ILIKE $${countParamIndex})`;
      countParams.push(`%${search}%`);
      countParamIndex++;
    }
    if (type) {
      countQuery += ` AND d.type = $${countParamIndex}`;
      countParams.push(type);
      countParamIndex++;
    }
    if (category_id) {
      countQuery += ` AND d.category_id = $${countParamIndex}`;
      countParams.push(category_id);
    }
    const countResult = await pool.query(countQuery, countParams);
    res.json({
      documents: result.rows,
      total: parseInt(countResult.rows[0].count),
      page: parseInt(page),
      limit: parseInt(limit)
    });
  } catch (error) {
    console.error('Ошибка получения документов:', error);
    res.status(500).json({ error: 'Не удалось загрузить список документов: ' + error.message });
  }
});
router.get('/search', authMiddleware, async (req, res) => {
  try {
    const { q, type, category, tag_id, status } = req.query;
    const userRole = req.user.role;
    const params = [];
    let paramIndex = 1;
    let statusFilter;
    if (userRole === 'librarian' || userRole === 'admin') {
      statusFilter = "(d.status = 'in_library' OR d.status = 'archived')";
    } else {
      statusFilter = "d.status = 'in_library'";
    }
    let query = `
      SELECT DISTINCT d.*, c.name as category_name,
             array_agg(DISTINCT t.name) FILTER (WHERE t.name IS NOT NULL) as tags
      FROM documents d
      LEFT JOIN categories c ON d.category_id = c.id
      LEFT JOIN document_tags dt ON d.id = dt.document_id
      LEFT JOIN tags t ON dt.tag_id = t.id
      WHERE ${statusFilter}
    `;
    if (q) {
      query += ` AND (d.title ILIKE $${paramIndex} OR d.code ILIKE $${paramIndex} OR d.description ILIKE $${paramIndex})`;
      params.push(`%${q}%`);
      paramIndex++;
    }
    if (type) {
      query += ` AND d.type = $${paramIndex}`;
      params.push(type);
      paramIndex++;
    }
    if (category) {
      query += ` AND d.category_id = $${paramIndex}`;
      params.push(category);
      paramIndex++;
    }
    if (tag_id) {
      query += ` AND EXISTS (SELECT 1 FROM document_tags dt2 WHERE dt2.document_id = d.id AND dt2.tag_id = $${paramIndex})`;
      params.push(tag_id);
      paramIndex++;
    }
    if (status) {
      query += ` AND d.status = $${paramIndex}`;
      params.push(status);
      paramIndex++;
    }
    query += ` GROUP BY d.id, c.name ORDER BY d.updated_at DESC`;
    const result = await pool.query(query, params);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка поиска:', error);
    res.status(500).json({ error: 'Не удалось выполнить поиск: ' + error.message });
  }
});
router.get('/favorites', authMiddleware, async (req, res) => {
  try {
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT d.*, c.name as category_name
      FROM documents d
      JOIN favorites f ON d.id = f.document_id
      LEFT JOIN categories c ON d.category_id = c.id
      WHERE f.user_id = $1 AND d.status != 'archived'
      ORDER BY f.created_at DESC
    `, [userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения избранного:', error);
    res.status(500).json({ error: 'Не удалось загрузить избранное: ' + error.message });
  }
});
router.post('/favorites/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const docCheck = await pool.query('SELECT id FROM documents WHERE id = $1', [id]);
    if (docCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Документ не найден' });
    }
    const existing = await pool.query(
      'SELECT id FROM favorites WHERE user_id = $1 AND document_id = $2',
      [userId, id]
    );
    if (existing.rows.length > 0) {
      return res.status(400).json({ error: 'Документ уже в избранном' });
    }
    await pool.query(
      'INSERT INTO favorites (user_id, document_id) VALUES ($1, $2)',
      [userId, id]
    );
    res.json({ message: 'Добавлено в избранное' });
  } catch (error) {
    console.error('Ошибка добавления в избранное:', error);
    if (error.code === '23505') {
      return res.status(400).json({ error: 'Документ уже в избранном' });
    }
    res.status(500).json({ error: 'Не удалось добавить в избранное: ' + error.message });
  }
});
router.delete('/favorites/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await pool.query(
      'DELETE FROM favorites WHERE user_id = $1 AND document_id = $2 RETURNING id',
      [userId, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Документ не найден в избранном' });
    }
    res.json({ message: 'Удалено из избранного' });
  } catch (error) {
    console.error('Ошибка удаления из избранного:', error);
    res.status(500).json({ error: 'Не удалось удалить из избранного: ' + error.message });
  }
});
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;
    const result = await pool.query(`
      SELECT d.*, c.name as category_name, u.full_name as created_by_name
      FROM documents d
      LEFT JOIN categories c ON d.category_id = c.id
      LEFT JOIN users u ON d.created_by = u.id
      WHERE d.id = $1
    `, [id]);
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Документ не найден' });
    }
    const document = result.rows[0];
    if (document.status === 'archived' && userRole !== 'librarian' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Нет доступа к архивному документу' });
    }
    const tagsResult = await pool.query(`
      SELECT t.id, t.name
      FROM tags t
      JOIN document_tags dt ON t.id = dt.tag_id
      WHERE dt.document_id = $1
    `, [id]);
    document.tags = tagsResult.rows;
    await pool.query('UPDATE documents SET views = COALESCE(views, 0) + 1 WHERE id = $1', [id]);
    await logAudit(req.user.id, 'document_view', 'document', id, req.ip, document.title);
    res.json(document);
  } catch (error) {
    console.error('Ошибка получения документа:', error);
    res.status(500).json({ error: 'Не удалось загрузить документ: ' + error.message });
  }
});
router.get('/:id/preview', async (req, res) => {
  try {
    const token = req.query.token || req.headers.authorization?.replace('Bearer ', '');
    if (!token) {
      return res.status(401).json({ error: 'Требуется авторизация' });
    }
    const jwt = require('jsonwebtoken');
    let decoded;
    try {
      decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key');
    } catch (err) {
      return res.status(401).json({ error: 'Сессия истекла, войдите заново' });
    }
    const { id } = req.params;
    const result = await pool.query(
      'SELECT file_path, file_name, status FROM documents WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Документ не найден' });
    }
    const document = result.rows[0];
    if (document.status === 'archived' && decoded.role !== 'librarian' && decoded.role !== 'admin') {
      return res.status(403).json({ error: 'Нет доступа к архивному документу' });
    }
    const filePath = path.join(__dirname, '../../uploads', document.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл не найден на сервере' });
    }
    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes = {
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.png': 'image/png',
      '.gif': 'image/gif',
      '.webp': 'image/webp',
      '.svg': 'image/svg+xml',
      '.bmp': 'image/bmp',
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.xls': 'application/vnd.ms-excel',
      '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      '.txt': 'text/plain; charset=utf-8',
      '.md': 'text/plain; charset=utf-8',
      '.json': 'application/json',
      '.xml': 'text/xml',
      '.csv': 'text/csv; charset=utf-8',
      '.mp4': 'video/mp4',
      '.webm': 'video/webm',
      '.ogg': 'audio/ogg',
      '.mp3': 'audio/mpeg',
      '.wav': 'audio/wav',
    };
    const contentType = mimeTypes[ext] || 'application/octet-stream';
    const fileBuffer = fs.readFileSync(filePath);
    res.set({
      'Content-Type': contentType,
      'Content-Length': fileBuffer.length,
      'Content-Disposition': 'inline',
      'Cache-Control': 'no-cache'
    });
    res.send(fileBuffer);
  } catch (error) {
    console.error('Ошибка предпросмотра:', error);
    res.status(500).json({ error: 'Не удалось открыть предпросмотр: ' + error.message });
  }
});
router.get('/:id/download', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;
    const result = await pool.query(
      'SELECT file_path, file_name, title, code, status FROM documents WHERE id = $1',
      [id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Документ не найден' });
    }
    const document = result.rows[0];
    if (document.status === 'archived' && userRole !== 'librarian' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Нет доступа к архивному документу' });
    }
    const filePath = path.join(__dirname, '../../uploads', document.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл не найден на сервере' });
    }
    const fileName = document.file_name || `${document.code}${path.extname(document.file_path)}`;
    await pool.query('UPDATE documents SET downloads = COALESCE(downloads, 0) + 1 WHERE id = $1', [id]);
    await logAudit(req.user.id, 'document_download', 'document', id, req.ip, document.title);
    res.download(filePath, fileName);
  } catch (error) {
    console.error('Ошибка скачивания:', error);
    res.status(500).json({ error: 'Не удалось скачать документ: ' + error.message });
  }
});
router.get('/:id/versions', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const result = await pool.query(`
      SELECT dv.id, dv.document_id, dv.version_no as version, dv.file_path, 
             dv.file_name, dv.file_size, dv.change_description, 
             dv.created_at, u.full_name as created_by_name
      FROM document_versions dv
      LEFT JOIN users u ON dv.author_id = u.id
      WHERE dv.document_id = $1
      ORDER BY dv.version_no DESC
    `, [id]);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения версий:', error);
    res.status(500).json({ error: 'Не удалось загрузить версии документа: ' + error.message });
  }
});
router.get('/:id/versions/:versionId/download', authMiddleware, async (req, res) => {
  try {
    const { id, versionId } = req.params;
    const result = await pool.query(
      `SELECT dv.file_path, dv.file_name, dv.version_no, d.code, d.title
       FROM document_versions dv
       JOIN documents d ON dv.document_id = d.id
       WHERE dv.id = $1 AND dv.document_id = $2`,
      [versionId, id]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Версия документа не найдена' });
    }
    const version = result.rows[0];
    const filePath = path.join(__dirname, '../../uploads', version.file_path);
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Файл версии не найден на сервере' });
    }
    const fileName = version.file_name || `${version.code}_v${version.version_no}${path.extname(version.file_path)}`;
    await logAudit(req.user.id, 'document_download', 'document', id, req.ip, `${version.title} (версия ${version.version_no})`);
    res.download(filePath, fileName);
  } catch (error) {
    console.error('Ошибка скачивания версии:', error);
    res.status(500).json({ error: 'Не удалось скачать версию документа: ' + error.message });
  }
});
router.post('/:id/versions', authMiddleware, upload.single('file'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { comment } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    if (!['librarian', 'admin'].includes(userRole)) {
      if (req.file) {
        fs.unlinkSync(req.file.path);
      }
      return res.status(403).json({ error: 'Недостаточно прав для загрузки новой версии' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Файл не загружен' });
    }
    if (!(await isExtensionAllowed(req.file.originalname))) {
      fs.unlinkSync(req.file.path);
      const allowed = await getSetting('allowed_extensions', 'pdf,doc,docx,xls,xlsx,dwg,dxf');
      return res.status(400).json({ error: `Недопустимое расширение. Разрешены: ${allowed}` });
    }
    if (!(await isFileSizeAllowed(req.file.size))) {
      fs.unlinkSync(req.file.path);
      const maxSize = parseInt(await getSetting('max_file_size', '52428800'));
      return res.status(400).json({ error: `Файл слишком большой. Максимум: ${Math.round(maxSize / 1024 / 1024)} МБ` });
    }
    await client.query('BEGIN');
    const docResult = await client.query('SELECT * FROM documents WHERE id = $1', [id]);
    if (docResult.rows.length === 0) {
      await client.query('ROLLBACK');
      fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Документ не найден' });
    }
    const doc = docResult.rows[0];
    if (doc.status !== 'in_library') {
      await client.query('ROLLBACK');
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Можно обновлять только документы со статусом "В библиотеке"' });
    }
    const currentVersion = parseInt(doc.version) || 1;
    const newVersion = currentVersion + 1;
    await client.query(
      `INSERT INTO document_versions (document_id, version_no, file_path, file_name, file_size, author_id, change_description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, currentVersion, doc.file_path, doc.file_name || doc.file_path, doc.file_size || 0, userId, 'Предыдущая версия']
    );
    await client.query(
      `UPDATE documents 
       SET file_path = $1, file_name = $2, file_size = $3, version = $4, updated_at = NOW()
       WHERE id = $5`,
      [req.file.filename, req.file.originalname, req.file.size, newVersion, id]
    );
    await client.query(
      `INSERT INTO document_versions (document_id, version_no, file_path, file_name, file_size, author_id, change_description)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [id, newVersion, req.file.filename, req.file.originalname, req.file.size, userId, comment || 'Новая версия']
    );
    await client.query('COMMIT');
    await cleanupOldVersions(id);
    await logAudit(userId, 'document_version_upload', 'document', id, req.ip, `Загружена версия ${newVersion}`);
    res.json({ 
      message: 'Новая версия загружена', 
      version: newVersion,
      file_name: req.file.originalname
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка загрузки версии:', error);
    if (req.file) {
      try { fs.unlinkSync(req.file.path); } catch (e) {}
    }
    res.status(500).json({ error: 'Ошибка сервера: ' + error.message });
  } finally {
    client.release();
  }
});
router.get('/:id/notes', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT c.*, u.full_name as author_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.document_id = $1 AND c.user_id = $2
      ORDER BY c.created_at DESC
    `, [id, userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения заметок:', error);
    res.status(500).json({ error: 'Не удалось загрузить заметки: ' + error.message });
  }
});
router.post('/:id/notes', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Заметка не может быть пустой' });
    }
    const result = await pool.query(
      'INSERT INTO comments (document_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
      [id, userId, content.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка добавления заметки:', error);
    res.status(500).json({ error: 'Не удалось добавить заметку: ' + error.message });
  }
});
router.delete('/:id/notes/:noteId', authMiddleware, async (req, res) => {
  try {
    const { id, noteId } = req.params;
    const userId = req.user.id;
    const result = await pool.query(
      'DELETE FROM comments WHERE id = $1 AND document_id = $2 AND user_id = $3 RETURNING *',
      [noteId, id, userId]
    );
    if (result.rows.length === 0) {
      return res.status(404).json({ error: 'Заметка не найдена или у вас нет прав на её удаление' });
    }
    res.json({ message: 'Заметка удалена' });
  } catch (error) {
    console.error('Ошибка удаления заметки:', error);
    res.status(500).json({ error: 'Не удалось удалить заметку: ' + error.message });
  }
});
router.post('/', authMiddleware, upload.single('file'), async (req, res) => {
  const client = await pool.connect();
  try {
    const userRole = req.user.role;
    if (userRole !== 'librarian' && userRole !== 'admin') {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Нет прав на создание документа. Требуется роль библиотекаря или администратора' });
    }
    const { title, code, type, category_id, description, tags, approver_ids } = req.body;
    if (!title || !title.trim()) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Название документа обязательно' });
    }
    if (!code || !code.trim()) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Код документа обязателен' });
    }
    if (!type || !type.trim()) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Тип документа обязателен' });
    }
    if (!req.file) {
      return res.status(400).json({ error: 'Файл обязателен для загрузки' });
    }
    const codeCheck = await pool.query('SELECT id FROM documents WHERE code = $1', [code.trim()]);
    if (codeCheck.rows.length > 0) {
      fs.unlinkSync(req.file.path);
      return res.status(400).json({ error: 'Документ с таким кодом уже существует' });
    }
    if (!await isExtensionAllowed(req.file.originalname)) {
      fs.unlinkSync(req.file.path);
      const allowedExt = await getSetting('allowed_extensions', 'pdf,doc,docx,xls,xlsx');
      return res.status(400).json({ error: `Недопустимое расширение файла. Разрешены: ${allowedExt}` });
    }
    if (!await isFileSizeAllowed(req.file.size)) {
      fs.unlinkSync(req.file.path);
      const maxSize = parseInt(await getSetting('max_file_size', '52428800'));
      const maxSizeMB = Math.round(maxSize / 1024 / 1024);
      return res.status(400).json({ error: `Файл слишком большой. Максимальный размер: ${maxSizeMB} МБ` });
    }
    await client.query('BEGIN');
    const result = await client.query(
      `INSERT INTO documents (title, code, type, category_id, description, file_path, file_name, file_size, created_by, status, views, downloads)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'pending_approval', 0, 0)
       RETURNING *`,
      [title.trim(), code.trim(), type.trim(), category_id || null, description, req.file.filename, req.file.originalname, req.file.size, req.user.id]
    );
    const newDoc = result.rows[0];
    if (tags) {
      const tagList = JSON.parse(tags);
      for (const tagName of tagList) {
        let tagResult = await client.query('SELECT id FROM tags WHERE name = $1', [tagName]);
        let tagId;
        if (tagResult.rows.length === 0) {
          const newTag = await client.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [tagName]);
          tagId = newTag.rows[0].id;
        } else {
          tagId = tagResult.rows[0].id;
        }
        await client.query('INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [newDoc.id, tagId]);
      }
    }
    let approverList = [];
    if (approver_ids) {
      try {
        approverList = JSON.parse(approver_ids);
      } catch (e) {
        approverList = [];
      }
    }
    if (approverList.length > 0) {
      console.log('[DEBUG] approverList:', approverList);
      console.log('[DEBUG] approverList.length:', approverList.length);
      for (const approverId of approverList) {
        const ticketResult = await client.query(
          `INSERT INTO approval_tickets (document_id, created_by, assigned_to, status, stage, total_stages)
           VALUES ($1, $2, $3, 'pending', 1, $4)
           RETURNING id`,
          [newDoc.id, req.user.id, approverId, approverList.length]
        );
        await client.query(
          `INSERT INTO ticket_approvers (ticket_id, user_id, status)
           VALUES ($1, $2, 'pending')
           ON CONFLICT DO NOTHING`,
          [ticketResult.rows[0].id, approverId]
        );
        await createNotification(
          approverId,
          'ticket_new',
          'Новая заявка на согласование',
          `Создана новая заявка на добавление документа "${title}"`,
          'ticket',
          ticketResult.rows[0].id
        );
      }
    } else {
      const ticketResult = await client.query(
        `INSERT INTO approval_tickets (document_id, created_by, status)
         VALUES ($1, $2, 'pending')
         RETURNING id`,
        [newDoc.id, req.user.id]
      );
      const staffResult = await pool.query(
        `SELECT id FROM users WHERE role = 'department_head'`
      );
      for (const staff of staffResult.rows) {
        await createNotification(
          staff.id,
          'ticket_new',
          'Новая заявка на согласование',
          `Создана новая заявка на добавление документа "${title}"`,
          'ticket',
          ticketResult.rows[0].id
        );
      }
    }
    await client.query('COMMIT');
    res.status(201).json(newDoc);
  } catch (error) {
    await client.query('ROLLBACK');
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Ошибка создания документа:', error);
    if (error.code === '23505') {
      if (error.constraint?.includes('code')) {
        return res.status(400).json({ error: 'Документ с таким кодом уже существует' });
      }
      return res.status(400).json({ error: 'Такой документ уже существует' });
    }
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Указанная категория не существует' });
    }
    if (error.code === '23502') {
      return res.status(400).json({ error: 'Не заполнены обязательные поля (название, код или тип)' });
    }
    res.status(500).json({ error: 'Не удалось создать документ: ' + error.message });
  } finally {
    client.release();
  }
});
router.put('/:id', authMiddleware, upload.single('file'), async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const userRole = req.user.role;
    if (userRole !== 'librarian' && userRole !== 'admin') {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(403).json({ error: 'Нет прав на редактирование. Требуется роль библиотекаря или администратора' });
    }
    const { title, code, type, category_id, description, tags, change_description } = req.body;
    const currentDoc = await client.query('SELECT * FROM documents WHERE id = $1', [id]);
    if (currentDoc.rows.length === 0) {
      if (req.file) fs.unlinkSync(req.file.path);
      return res.status(404).json({ error: 'Документ не найден' });
    }
    const doc = currentDoc.rows[0];
    const newTitle = title || doc.title;
    const newCode = code || doc.code;
    const newType = type || doc.type;
    const newCategoryId = category_id !== undefined ? category_id : doc.category_id;
    const newDescription = description !== undefined ? description : doc.description;
    if (code && code !== doc.code) {
      const codeCheck = await pool.query('SELECT id FROM documents WHERE code = $1 AND id != $2', [code.trim(), id]);
      if (codeCheck.rows.length > 0) {
        if (req.file) fs.unlinkSync(req.file.path);
        return res.status(400).json({ error: 'Документ с таким кодом уже существует' });
      }
    }
    await client.query('BEGIN');
    if (req.file) {
      if (!await isExtensionAllowed(req.file.originalname)) {
        fs.unlinkSync(req.file.path);
        const allowedExt = await getSetting('allowed_extensions', 'pdf,doc,docx,xls,xlsx');
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Недопустимое расширение файла. Разрешены: ${allowedExt}` });
      }
      if (!await isFileSizeAllowed(req.file.size)) {
        fs.unlinkSync(req.file.path);
        const maxSize = parseInt(await getSetting('max_file_size', '52428800'));
        const maxSizeMB = Math.round(maxSize / 1024 / 1024);
        await client.query('ROLLBACK');
        return res.status(400).json({ error: `Файл слишком большой. Максимальный размер: ${maxSizeMB} МБ` });
      }
      const keepVersions = await getSetting('keep_versions', 'true');
      if (keepVersions === 'true' && doc.file_path) {
        const lastVersion = await client.query(
          'SELECT MAX(version_no) as max_ver FROM document_versions WHERE document_id = $1',
          [id]
        );
        const newVersionNo = (lastVersion.rows[0].max_ver || 0) + 1;
        await client.query(
          `INSERT INTO document_versions (document_id, version_no, file_path, file_name, file_size, author_id, change_description)
           VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [id, newVersionNo, doc.file_path, doc.file_name, doc.file_size, req.user.id, change_description || 'Обновление документа']
        );
        await cleanupOldVersions(id);
      }
const newVersion = (parseInt(doc.version) || 1) + 1;
await client.query(
  `UPDATE documents SET title = $1, code = $2, type = $3, category_id = $4, description = $5,
   file_path = $6, file_name = $7, file_size = $8, version = $9, updated_at = NOW()
   WHERE id = $10`,
  [newTitle, newCode, newType, newCategoryId || null, newDescription, req.file.filename, req.file.originalname, req.file.size, newVersion, id]
);
    } else {
      await client.query(
        `UPDATE documents SET title = $1, code = $2, type = $3, category_id = $4, description = $5, updated_at = NOW()
         WHERE id = $6`,
        [newTitle, newCode, newType, newCategoryId || null, newDescription, id]
      );
    }
    if (tags !== undefined) {
      await client.query('DELETE FROM document_tags WHERE document_id = $1', [id]);
      if (tags) {
        const tagList = JSON.parse(tags);
        for (const tagName of tagList) {
          let tagResult = await client.query('SELECT id FROM tags WHERE name = $1', [tagName]);
          let tagId;
          if (tagResult.rows.length === 0) {
            const newTag = await client.query('INSERT INTO tags (name) VALUES ($1) RETURNING id', [tagName]);
            tagId = newTag.rows[0].id;
          } else {
            tagId = tagResult.rows[0].id;
          }
          await client.query('INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [id, tagId]);
        }
      }
    }
    await client.query('COMMIT');
    await logAudit(req.user.id, 'document_update', 'document', id, req.ip, newTitle);
    const favoritesResult = await pool.query(
      `SELECT DISTINCT f.user_id, u.role 
       FROM favorites f
       JOIN users u ON f.user_id = u.id
       WHERE f.document_id = $1 AND f.user_id != $2`,
      [id, req.user.id]
    );
    for (const fav of favoritesResult.rows) {
      await createNotification(
        fav.user_id,
        'document_updated',
        'Документ обновлён',
        `Документ "${newTitle}" из вашего избранного был обновлён`,
        'document',
        parseInt(id)
      );
    }
    const updatedDoc = await pool.query('SELECT * FROM documents WHERE id = $1', [id]);
    res.json(updatedDoc.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    if (req.file && fs.existsSync(req.file.path)) {
      fs.unlinkSync(req.file.path);
    }
    console.error('Ошибка обновления документа:', error);
    if (error.code === '23505') {
      if (error.constraint?.includes('code')) {
        return res.status(400).json({ error: 'Документ с таким кодом уже существует' });
      }
      return res.status(400).json({ error: 'Конфликт данных при обновлении' });
    }
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Указанная категория не существует' });
    }
    if (error.code === '23502') {
      return res.status(400).json({ error: 'Не заполнены обязательные поля' });
    }
    res.status(500).json({ error: 'Не удалось обновить документ: ' + error.message });
  } finally {
    client.release();
  }
});
router.put('/:id/archive', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const userRole = req.user.role;
    if (userRole !== 'librarian' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Нет прав на архивацию. Требуется роль библиотекаря или администратора' });
    }
    const docResult = await client.query('SELECT title, status FROM documents WHERE id = $1', [id]);
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Документ не найден' });
    }
    if (docResult.rows[0].status === 'archived') {
      return res.status(400).json({ error: 'Документ уже в архиве' });
    }
    await client.query('BEGIN');
    await client.query(
      `UPDATE documents SET status = 'archived', archived_at = NOW(), updated_at = NOW() WHERE id = $1`,
      [id]
    );
    const autoTags = ['Новое', 'Архив', 'Восстановлено из архива', 'Обновлено'];
    await client.query(
      `DELETE FROM document_tags WHERE document_id = $1 AND tag_id IN (
        SELECT id FROM tags WHERE name = ANY($2)
      )`,
      [id, autoTags]
    );
    let tagResult = await client.query(`SELECT id FROM tags WHERE name = 'Архив'`);
    let tagId;
    if (tagResult.rows.length === 0) {
      const newTag = await client.query(`INSERT INTO tags (name) VALUES ('Архив') RETURNING id`);
      tagId = newTag.rows[0].id;
    } else {
      tagId = tagResult.rows[0].id;
    }
    await client.query(
      `INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, tagId]
    );
    await client.query('COMMIT');
    await logAudit(req.user.id, 'document_archive', 'document', id, req.ip, docResult.rows[0].title);
    res.json({ message: 'Документ перемещен в архив' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка архивации:', error);
    res.status(500).json({ error: 'Не удалось архивировать документ: ' + error.message });
  } finally {
    client.release();
  }
});
router.put('/:id/restore', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const userRole = req.user.role;
    if (userRole !== 'librarian' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Нет прав на восстановление. Требуется роль библиотекаря или администратора' });
    }
    const docResult = await client.query('SELECT title, status FROM documents WHERE id = $1', [id]);
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Документ не найден' });
    }
    if (docResult.rows[0].status !== 'archived') {
      return res.status(400).json({ error: 'Документ не в архиве' });
    }
    await client.query('BEGIN');
    await client.query(
      `UPDATE documents SET status = 'in_library', archived_at = NULL, updated_at = NOW() WHERE id = $1`,
      [id]
    );
    const autoTags = ['Новое', 'Архив', 'Восстановлено из архива', 'Обновлено'];
    await client.query(
      `DELETE FROM document_tags WHERE document_id = $1 AND tag_id IN (
        SELECT id FROM tags WHERE name = ANY($2)
      )`,
      [id, autoTags]
    );
    let tagResult = await client.query(`SELECT id FROM tags WHERE name = 'Восстановлено из архива'`);
    let tagId;
    if (tagResult.rows.length === 0) {
      const newTag = await client.query(`INSERT INTO tags (name) VALUES ('Восстановлено из архива') RETURNING id`);
      tagId = newTag.rows[0].id;
    } else {
      tagId = tagResult.rows[0].id;
    }
    await client.query(
      `INSERT INTO document_tags (document_id, tag_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
      [id, tagId]
    );
    await client.query('COMMIT');
    await logAudit(req.user.id, 'document_restore', 'document', id, req.ip, docResult.rows[0].title);
    res.json({ message: 'Документ восстановлен из архива' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка восстановления:', error);
    res.status(500).json({ error: 'Не удалось восстановить документ: ' + error.message });
  } finally {
    client.release();
  }
});
router.delete('/:id', authMiddleware, async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const userRole = req.user.role;
    if (userRole !== 'librarian' && userRole !== 'admin') {
      return res.status(403).json({ error: 'Нет прав на удаление. Требуется роль библиотекаря или администратора' });
    }
    const docResult = await client.query('SELECT file_path, title FROM documents WHERE id = $1', [id]);
    if (docResult.rows.length === 0) {
      return res.status(404).json({ error: 'Документ не найден' });
    }
    const doc = docResult.rows[0];
    const ticketCheck = await client.query(
      `SELECT id FROM approval_tickets WHERE document_id = $1 AND status NOT IN ('approved', 'rejected')`,
      [id]
    );
    if (ticketCheck.rows.length > 0) {
      return res.status(400).json({ error: 'Невозможно удалить: документ связан с активными заявками на согласование' });
    }
    await client.query('BEGIN');
    if (doc.file_path) {
      const filePath = path.join(__dirname, '../../uploads', doc.file_path);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
    const versions = await client.query('SELECT file_path FROM document_versions WHERE document_id = $1', [id]);
    for (const ver of versions.rows) {
      if (ver.file_path) {
        const verPath = path.join(__dirname, '../../uploads', ver.file_path);
        if (fs.existsSync(verPath)) {
          fs.unlinkSync(verPath);
        }
      }
    }
    await client.query('DELETE FROM document_versions WHERE document_id = $1', [id]);
    await client.query('DELETE FROM comments WHERE document_id = $1', [id]);
    await client.query('DELETE FROM favorites WHERE document_id = $1', [id]);
    await client.query('DELETE FROM document_tags WHERE document_id = $1', [id]);
    await client.query('DELETE FROM documents WHERE id = $1', [id]);
    await client.query('COMMIT');
    await logAudit(req.user.id, 'document_delete', 'document', id, req.ip, doc.title);
    res.json({ message: 'Документ удален' });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Ошибка удаления:', error);
    if (error.code === '23503') {
      return res.status(400).json({ error: 'Невозможно удалить: документ связан с другими записями' });
    }
    res.status(500).json({ error: 'Не удалось удалить документ: ' + error.message });
  } finally {
    client.release();
  }
});
router.get('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const result = await pool.query(`
      SELECT c.*, u.full_name as author_name
      FROM comments c
      JOIN users u ON c.user_id = u.id
      WHERE c.document_id = $1 AND c.user_id = $2
      ORDER BY c.created_at DESC
    `, [id, userId]);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения комментариев:', error);
    res.status(500).json({ error: 'Не удалось загрузить комментарии: ' + error.message });
  }
});
router.post('/:id/comments', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    const userId = req.user.id;
    if (!content || !content.trim()) {
      return res.status(400).json({ error: 'Комментарий не может быть пустым' });
    }
    const result = await pool.query(
      'INSERT INTO comments (document_id, user_id, content) VALUES ($1, $2, $3) RETURNING *',
      [id, userId, content.trim()]
    );
    res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error('Ошибка добавления комментария:', error);
    res.status(500).json({ error: 'Не удалось добавить комментарий: ' + error.message });
  }
});
router.delete('/:id/comments/:commentId', authMiddleware, async (req, res) => {
  try {
    const { id, commentId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const comment = await pool.query('SELECT user_id FROM comments WHERE id = $1 AND document_id = $2', [commentId, id]);
    if (comment.rows.length === 0) {
      return res.status(404).json({ error: 'Комментарий не найден' });
    }
    if (comment.rows[0].user_id !== userId && userRole !== 'admin' && userRole !== 'librarian') {
      return res.status(403).json({ error: 'Нет прав на удаление чужого комментария' });
    }
    await pool.query('DELETE FROM comments WHERE id = $1', [commentId]);
    res.json({ message: 'Комментарий удален' });
  } catch (error) {
    console.error('Ошибка удаления комментария:', error);
    res.status(500).json({ error: 'Не удалось удалить комментарий: ' + error.message });
  }
});
module.exports = router;