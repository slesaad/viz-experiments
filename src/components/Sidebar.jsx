import React from 'react';
import { Link } from 'react-router-dom';

export function Sidebar({ data, active }) {
  return (
    <nav className="sidebar">
      <Link
        to="/"
        className={`sidebar-link ${active === '/' ? 'active' : ''}`}
      >
        Home
      </Link>
      {data.map((item) => (
        <Link
          key={item.label}
          to={item.path}
          className={`sidebar-link ${item.path === active ? 'active' : ''}`}
        >
          {item.label}
        </Link>
      ))}
    </nav>
  );
}