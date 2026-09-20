import React from 'react';
import { Folder } from 'lucide-react';
import { FilterSelect } from '../../ui/FilterSelect';

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
  className = '',
}) => {
  const options = [
    { value: '', label: 'Toutes les catégories' },
    ...categories.map((category) => ({ value: category, label: category })),
  ];

  return (
    <FilterSelect
      className={className}
      value={currentCategory}
      onChange={onCategoryChange}
      options={options}
      icon={<Folder className="h-4 w-4" />}
    />
  );
};
