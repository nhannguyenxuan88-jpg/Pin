import React from 'react';

const OwnerDisplay: React.FC<{ owner?: string | null }> = ({ owner }) => {
  if (!owner) return <span className="text-slate-500">—</span>;
  return <span>{owner}</span>;
};

export default OwnerDisplay;
