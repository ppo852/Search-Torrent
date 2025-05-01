import React from 'react';

interface CategoryFilterProps {
  categories: string[];
  currentCategory: string;
  onCategoryChange: (category: string) => void;
  className?: string;
}

export const CategoryFilter: React.FC<CategoryFilterProps> = ({
  categories,
  currentCategory,
  onCategoryChange,
  className = ''
}) => {
  return (
    <div className={`relative ${className}`}>
      <select
        className="w-full appearance-none pl-10 pr-4 py-2 bg-gray-800 rounded-lg text-white focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
        value={currentCategory}
        onChange={(e) => onCategoryChange(e.target.value)}
      >
        <option value="">Toutes les catégories</option>
        {categories.map((category) => (
          <option key={category} value={category}>
            {category}
          </option>
        ))}
      </select>
      <div className="absolute left-3 top-0 h-full flex items-center text-gray-400">
        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M4 20h16a2 2 0 0 0 2-2V8a2 2 0 0 0-2-2h-7.93a2 2 0 0 1-1.66-.9l-.82-1.2A2 2 0 0 0 7.93 3H4a2 2 0 0 0-2 2v13c0 1.1.9 2 2 2Z"></path>
        </svg>
      </div>
    </div>
  );
};
