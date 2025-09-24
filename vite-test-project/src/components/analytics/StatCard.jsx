import React from 'react';
import './StatCard.css';

const StatCard = ({ title, value, unit = '' }) => {
  return (
    <div className="stat-card">
      <div className="stat-value">{value}{unit}</div>
      <div className="stat-title">{title}</div>
    </div>
  );
};

export default StatCard;