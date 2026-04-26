// Проверка роли пользователя
const roleCheck = (allowedRoles) => {
  return (req, res, next) => {
    // Проверяем, есть ли пользователь (должен быть установлен middleware auth)
    if (!req.user) {
      return res.status(401).json({ error: 'Не авторизован' });
    }

    // Проверяем, входит ли роль пользователя в список разрешённых
    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: 'Недостаточно прав для выполнения действия' });
    }

    next();
  };
};

module.exports = roleCheck;