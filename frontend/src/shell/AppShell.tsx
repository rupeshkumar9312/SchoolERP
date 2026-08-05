import { useEffect, useState } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../auth/useAuth';
import { navItems } from './navConfig';

export function AppShell() {
  const { state, logout, hasPermission } = useAuth();
  const user = state.status === 'authenticated' ? state.user : null;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever a nav link is followed.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const visibleItems = navItems.filter((item) => {
    if (item.permission && !hasPermission(item.permission)) return false;
    if (item.roles && !(user && item.roles.includes(user.role.name))) return false;
    return true;
  });

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="drawer-toggle"
            aria-label={drawerOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <span className="brand">School ERP</span>
        </div>
        {user && (
          <div className="topbar-user">
            <span>
              {user.name} <span className="role-chip">{user.role.name}</span>
            </span>
            <button className="secondary" onClick={() => void logout()}>
              Log out
            </button>
          </div>
        )}
      </header>

      <div className="app-body">
        {drawerOpen && <div className="drawer-backdrop" onClick={() => setDrawerOpen(false)} />}
        <aside className={`sidebar ${drawerOpen ? 'sidebar-open' : ''}`}>
          <nav>
            {visibleItems.map((item) => (
              <NavLink
                key={item.path}
                to={item.path}
                className={({ isActive }) => `nav-link ${isActive ? 'nav-link-active' : ''}`}
                end={item.path === '/'}
              >
                {item.label}
              </NavLink>
            ))}
          </nav>
        </aside>
        <main className="content">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
