const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const authMiddleware = require('../middleware/auth');
const roleCheck = require('../middleware/roleCheck');
router.use(authMiddleware);
router.get('/', categoryController.getAll);
router.get('/tags', categoryController.getAllTags);
router.post('/', 
  roleCheck(['librarian']), 
  categoryController.create
);
router.put('/:id', 
  roleCheck(['librarian']), 
  categoryController.update
);
router.delete('/:id', 
  roleCheck(['librarian']), 
  categoryController.delete
);
router.post('/tags', 
  roleCheck(['librarian']), 
  categoryController.createTag
);
router.put('/tags/:id', 
  roleCheck(['librarian']), 
  categoryController.updateTag
);
router.delete('/tags/:id', 
  roleCheck(['librarian']), 
  categoryController.deleteTag
);
module.exports = router;