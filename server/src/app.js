const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();
const cleanupArchivedDocuments = require('./jobs/archiveCleanup');
const app = express();
app.set('trust proxy', true);
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
const authRoutes = require('./routes/auth');
const usersRoutes = require('./routes/users');
const documentsRoutes = require('./routes/documents');
const categoriesRoutes = require('./routes/categories');
const ticketsRoutes = require('./routes/tickets');
const settingsRoutes = require('./routes/settings');
const backupRoutes = require('./routes/backup');
const notificationsRouter = require('./routes/notifications');
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/documents', documentsRoutes);
app.use('/api/categories', categoriesRoutes);
app.use('/api/tickets', ticketsRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/notifications', notificationsRouter);
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok' });
});
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`Сервер запущен на порту ${PORT}`);
async function cleanupOldTickets() {
  try {
    const pool = require('./config/database');
    const settingResult = await pool.query(
      "SELECT value FROM system_settings WHERE key = 'ticket_retention_days'"
    );
    const retentionDays = parseInt(settingResult.rows[0]?.value || '30');
    if (retentionDays <= 0) return;
    const result = await pool.query(`
      DELETE FROM approval_tickets 
      WHERE status IN ('rejected', 'closed', 'approved') 
      AND updated_at < NOW() - INTERVAL '${retentionDays} days'
      RETURNING id
    `);
    if (result.rows.length > 0) {
      console.log(`Очищено ${result.rows.length} старых тикетов`);
    }
  } catch (error) {
    console.error('Ошибка очистки тикетов:', error);
  }
}
cleanupOldTickets();
setInterval(cleanupOldTickets, 24 * 60 * 60 * 1000);
  cleanupArchivedDocuments();
  setInterval(() => {
    const now = new Date();
    if (now.getHours() === 0 && now.getMinutes() === 0) {
      cleanupArchivedDocuments();
    }
  }, 60000);
});