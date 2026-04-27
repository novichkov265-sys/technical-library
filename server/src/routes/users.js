const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
router.use(authMiddleware);
router.get('/approvers', async (req, res) => {
  try {
    const pool = require('../config/database');
    const result = await pool.query(`
      SELECT id, full_name, position, role 
      FROM users 
      WHERE role = 'department_head'
      ORDER BY full_name
    `);
    res.json(result.rows);
  } catch (error) {
    console.error('Ошибка получения руководителей:', error);
    res.status(500).json({ error: 'Ошибка получения списка' });
  }
});
router.get('/audit', roleMiddleware(['admin']), userController.getAuditLogs);
router.get('/analytics', roleMiddleware(['admin']), userController.getAnalytics);
router.get('/', roleMiddleware(['admin']), userController.getAll);
router.get('/:id', roleMiddleware(['admin']), userController.getById);
router.post('/', roleMiddleware(['admin']), userController.create);
router.put('/:id', roleMiddleware(['admin']), userController.update);
router.delete('/:id', roleMiddleware(['admin']), userController.delete);
module.exports = router;