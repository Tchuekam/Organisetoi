import React from 'react';

interface SkeletonCardProps {
  lines?: number;
  height?: string;
  hasHeader?: boolean;
}

const SkeletonCard = ({ lines = 3, height = '120px', hasHeader = true }: SkeletonCardProps) => (
  <div className="section-card animate-pulse" style={{ minHeight: height }}>
    {hasHeader && <div className="h-4 w-1/3 bg-gray-100 rounded mb-4" />}
    <div className="space-y-2">
      {Array.from({ length: lines }).map((_, i) => (
        <div 
          key={i} 
          className="h-3 bg-gray-100 rounded" 
          style={{ width: `${90 - i * 15}%` }} 
        />
      ))}
    </div>
  </div>
);

export default SkeletonCard;
