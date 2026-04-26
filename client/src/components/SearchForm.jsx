import { useState } from 'react';

export default function SearchForm({ onSearch, categories }) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const [type, setType] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    onSearch({ query, category, type });
  };

  const handleReset = () => {
    setQuery('');
    setCategory('');
    setType('');
    onSearch({});
  };

  // Типы документов
  const documentTypes = [
    { value: 'drawing', label: 'Чертёж' },
    { value: 'standard', label: 'Стандарт' },
    { value: 'specification', label: 'Спецификация' },
    { value: 'instruction', label: 'Инструкция' },
    { value: 'manual', label: 'Руководство' },
    { value: 'other', label: 'Другое' },
  ];

  return (
    <form onSubmit={handleSubmit} className="card mb-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {/* Поисковый запрос */}
        <div className="md:col-span-2">
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Поиск по названию или коду
          </label>
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Введите запрос..."
            className="input"
          />
        </div>

        {/* Категория */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Категория
          </label>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value)}
            className="input"
          >
            <option value="">Все категории</option>
            {categories?.map((cat) => (
              <option key={cat.id} value={cat.id}>
                {cat.name}
              </option>
            ))}
          </select>
        </div>

        {/* Тип документа */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Тип документа
          </label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value)}
            className="input"
          >
            <option value="">Все типы</option>
            {documentTypes.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Кнопки */}
      <div className="mt-4 flex space-x-2">
        <button type="submit" className="btn btn-primary">
          Найти
        </button>
        <button type="button" onClick={handleReset} className="btn btn-secondary">
          Сбросить
        </button>
      </div>
    </form>
  );
}