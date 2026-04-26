const express = require('express');
const router = express.Router();
const ticketController = require('../controllers/ticketController');
const authMiddleware = require('../middleware/auth');
const roleMiddleware = require('../middleware/role');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Настройка загрузки файлов
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

router.use(authMiddleware);

// Роуты доступные всем авторизованным (для своих тикетов)
router.get('/', ticketController.getAll);
router.get('/:id', ticketController.getById);
router.post('/:id/message', ticketController.addMessage);
router.post('/:id/resubmit', ticketController.resubmit);
router.put('/:id/document', upload.single('file'), ticketController.updateDocument);

// Роуты только для согласующих
router.post('/:id/approve', roleMiddleware(['admin', 'librarian', 'department_head']), ticketController.approve);
router.post('/:id/reject', roleMiddleware(['admin', 'librarian', 'department_head']), ticketController.reject);
router.post('/:id/request-changes', roleMiddleware(['admin', 'librarian', 'department_head']), ticketController.requestChanges);

module.exports = router;