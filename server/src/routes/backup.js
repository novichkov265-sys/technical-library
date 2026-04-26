const express = require('express');
const router = express.Router();
const backupController = require('../controllers/backupController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

// Все маршруты только для админа
router.use(authMiddleware);
router.use(roleMiddleware(['admin']));

router.get('/', backupController.getAll);
router.post('/', backupController.create);
router.post('/restore/:filename', backupController.restore);  // НОВЫЙ маршрут
router.get('/download/:filename', backupController.download);
router.delete('/:id', backupController.delete);

module.exports = router;