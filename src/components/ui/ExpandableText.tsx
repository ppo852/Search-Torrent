import React, { useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';

interface ExpandableTextProps {
  text: string;
  maxLines?: number;
  className?: string;
}

export function ExpandableText({ text, maxLines = 3, className = "" }: ExpandableTextProps) {
  const [isExpanded, setIsExpanded] = useState(false);

  if (!text) return null;

  return (
    <div className={`space-y-2 ${className}`}>
      <p 
        className={`text-gray-300 leading-relaxed font-medium transition-all duration-300 ${
          isExpanded ? '' : 'line-clamp-3'
        }`}
        style={!isExpanded ? {
          display: '-webkit-box',
          WebkitLineClamp: maxLines,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden'
        } : {}}
      >
        {text}
      </p>
      
      {text.length > 150 && (
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="flex items-center gap-1.5 text-[10px] font-black text-blue-500 uppercase tracking-widest hover:text-blue-400 transition-colors group"
        >
          {isExpanded ? (
            <>
              <ChevronUp size={14} className="group-hover:-translate-y-0.5 transition-transform" />
              Réduire
            </>
          ) : (
            <>
              <ChevronDown size={14} className="group-hover:translate-y-0.5 transition-transform" />
              Lire la suite
            </>
          )}
        </button>
      )}
    </div>
  );
}
