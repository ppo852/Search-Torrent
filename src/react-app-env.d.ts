/// <reference types="react" />
/// <reference types="react-dom" />

// Déclarations pour les modules externes
declare module 'lucide-react';
declare module '@tanstack/react-query' {
  export function useQuery(options: any): any;
  export function useQueryClient(): any;
}
