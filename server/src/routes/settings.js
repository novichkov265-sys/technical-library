const express = require('express');
const router = express.Router();
const settingsController = require('../controllers/settingsController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');

router.use(authMiddleware);

// Публичные настройки - для всех авторизованных
router.get('/public', settingsController.getPublic);

// Все настройки - только для админа
router.get('/', roleMiddleware(['admin']), settingsController.getAll);
router.put('/', roleMiddleware(['admin']), settingsController.update);

module.exports = router;