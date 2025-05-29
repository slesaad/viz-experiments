import React from 'react';

export function Sidebar({ data, active, onChange }) {
  return (
    <nav className="sidebar">
      {data.map((item) => (
        <a
          key={item.label}
          onClick={() => onChange(item.label)}
          className={`sidebar-link ${item.label === active ? 'active' : ''}`}
        >
          {item.label}
        </a>
      ))}
    </nav>
  );
}