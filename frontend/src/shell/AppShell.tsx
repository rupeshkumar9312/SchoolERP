import type { ReactElement } from "react";
import { useEffect, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import edvanceMarkDark from "../assets/edvance-logo-dark.png";
import edvanceMark from "../assets/edvance-logo.png";
import { useAuth } from "../auth/useAuth";
import {
  IconAcademicCap,
  IconBookOpen,
  IconBriefcase,
  IconChartBar,
  IconClipboardCheck,
  IconClipboardList,
  IconGraduate,
  IconHistory,
  IconHome,
  IconMegaphone,
  IconNotebookPen,
  IconSettings,
  IconShieldCheck,
  IconUserCheck,
  IconUsersGroup,
} from "../components/NavIcons";
import { navItems } from "./navConfig";

const NAV_ICONS: Record<
  string,
  (props: { className?: string }) => ReactElement
> = {
  "/": IconHome,
  "/users": IconUsersGroup,
  "/academic-setup": IconAcademicCap,
  "/teachers": IconBriefcase,
  "/students": IconGraduate,
  "/my-classes": IconBookOpen,
  "/my-students": IconGraduate,
  "/attendance/mark": IconClipboardCheck,
  "/attendance/history": IconHistory,
  "/my-attendance": IconUserCheck,
  "/staff-attendance": IconClipboardList,
  "/reports": IconChartBar,
  "/assignments": IconNotebookPen,
  "/announcements": IconMegaphone,
  "/audit-logs": IconShieldCheck,
  "/settings": IconSettings,
};

export function AppShell() {
  const { state, logout, hasPermission } = useAuth();
  const user = state.status === "authenticated" ? state.user : null;
  const [drawerOpen, setDrawerOpen] = useState(false);
  const location = useLocation();

  // Close the mobile drawer whenever a nav link is followed.
  useEffect(() => setDrawerOpen(false), [location.pathname]);

  const visibleItems = navItems.filter((item) => {
    if (item.permission && !hasPermission(item.permission)) return false;
    if (item.roles && !(user && item.roles.includes(user.role.name)))
      return false;
    return true;
  });

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="topbar-left">
          <button
            className="drawer-toggle"
            aria-label={drawerOpen ? "Close menu" : "Open menu"}
            aria-expanded={drawerOpen}
            onClick={() => setDrawerOpen((open) => !open)}
          >
            <span />
            <span />
            <span />
          </button>
          <span className="brand">
            <img
              src={edvanceMarkDark}
              alt="EDVANCE"
              className="brand-mark theme-dark-only"
            />
            <img
              src={edvanceMark}
              alt="EDVANCE"
              className="brand-mark theme-light-only"
            />
            {/* <span className="brand-text">EDVANCE</span> */}
          </span>
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
        {drawerOpen && (
          <div
            className="drawer-backdrop"
            onClick={() => setDrawerOpen(false)}
          />
        )}
        <aside className={`sidebar ${drawerOpen ? "sidebar-open" : ""}`}>
          <nav>
            {visibleItems.map((item) => {
              const Icon = NAV_ICONS[item.path];
              return (
                <NavLink
                  key={item.path}
                  to={item.path}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? "nav-link-active" : ""}`
                  }
                  end={item.path === "/"}
                >
                  {Icon && <Icon />}
                  {item.label}
                </NavLink>
              );
            })}
          </nav>
        </aside>
        <main className="content">
          <div key={location.pathname} className="page-transition">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
