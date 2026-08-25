import type { ReactNode } from 'react';

interface EmptyStateProps {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}

export function EmptyState({ icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="py-20 px-6 glass-card text-center border-white/5 flex flex-col items-center gap-4">
      <div className="text-gray-600">{icon}</div>
      <div className="space-y-2 max-w-md">
        <p className="text-gray-400 font-black uppercase text-xs tracking-widest">{title}</p>
        {description && (
          <p className="text-gray-600 text-sm font-medium">{description}</p>
        )}
      </div>
      {action && <div className="mt-2">{action}</div>}
    </div>
  );
}
