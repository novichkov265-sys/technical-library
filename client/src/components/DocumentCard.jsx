import { Link } from 'react-router-dom';
export default function DocumentCard({ document }) {
  const typeNames = {
    drawing: 'Чертёж',
    standard: 'Стандарт',
    specification: 'Спецификация',
    instruction: 'Инструкция',
    manual: 'Руководство',
    other: 'Другое',
  };
  const statusNames = {
    draft: 'Черновик',
    pending_approval: 'На согласовании',
    approved: 'Утверждён',
    in_library: 'В библиотеке',
    archived: 'В архиве',
    withdrawn: 'Отозван',
  };
  const statusColors = {
    draft: 'bg-gray-100 text-gray-800',
    pending_approval: 'bg-yellow-100 text-yellow-800',
    approved: 'bg-green-100 text-green-800',
    in_library: 'bg-blue-100 text-blue-800',
    archived: 'bg-gray-100 text-gray-600',
    withdrawn: 'bg-red-100 text-red-800',
  };
  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('ru-RU', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    });
  };
  return (
    <Link to={`/documents/${document.id}`} className="block">
      <div className="card hover:shadow-lg transition-shadow cursor-pointer">
        <div className="flex justify-between items-start mb-3">
          <span className="text-sm font-mono text-gray-500">
            {document.code}
          </span>
          <span className={`px-2 py-1 rounded-full text-xs font-medium ${statusColors[document.status]}`}>
            {statusNames[document.status]}
          </span>
        </div>
        <h3 className="text-lg font-semibold text-gray-800 mb-2 line-clamp-2">
          {document.title}
        </h3>
        <div className="text-sm text-gray-600 space-y-1">
          <div className="flex justify-between">
            <span>Тип:</span>
            <span className="font-medium">{typeNames[document.type]}</span>
          </div>
          {document.category_name && (
            <div className="flex justify-between">
              <span>Категория:</span>
              <span className="font-medium">{document.category_name}</span>
            </div>
          )}
          <div className="flex justify-between">
            <span>Версия:</span>
            <span className="font-medium">{document.current_version}</span>
          </div>
          <div className="flex justify-between">
            <span>Обновлён:</span>
            <span className="font-medium">{formatDate(document.updated_at)}</span>
          </div>
        </div>
        {document.tags && document.tags.length > 0 && document.tags[0] && (
          <div className="mt-3 flex flex-wrap gap-1">
            {document.tags.map((tag, index) => (
              <span
                key={index}
                className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs"
              >
                {tag}
              </span>
            ))}
          </div>
        )}
      </div>
    </Link>
  );
}