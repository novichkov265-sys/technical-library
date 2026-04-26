const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');

// Все маршруты требуют авторизации
router.use(authMiddleware);

// GET /api/categories - Получение всех категорий (для всех)
router.get('/', categoryController.getAll);

// GET /api/categories/tags - Получение всех тегов (для всех)
router.get('/tags', categoryController.getAllTags);

// Остальные маршруты только для библиотекаря
// POST /api/categories - Создание категории
router.post('/', 
  roleCheck(['librarian']), 
  categoryController.create
);

// PUT /api/categories/:id - Обновление категории
router.put('/:id', 
  roleCheck(['librarian']), 
  categoryController.update
);

// DELETE /api/categories/:id - Удаление категории
router.delete('/:id', 
  roleCheck(['librarian']), 
  categoryController.delete
);

// POST /api/categories/tags - Создание тега
router.post('/tags', 
  roleCheck(['librarian']), 
  categoryController.createTag
);

// PUT /api/categories/tags/:id - Обновление тега
router.put('/tags/:id', 
  roleCheck(['librarian']), 
  categoryController.updateTag
);

// DELETE /api/categories/tags/:id - Удаление тега
router.delete('/tags/:id', 
  roleCheck(['librarian']), 
  categoryController.deleteTag
);

module.exports = router;