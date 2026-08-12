import { AdminDashboard } from './dashboard/AdminDashboard';
import { StudentDashboard } from './dashboard/StudentDashboard';
import { TeacherDashboard } from './dashboard/TeacherDashboard';
import { useAuth } from '../auth/useAuth';

function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
}

export function DashboardHome() {
  const { state, hasPermission } = useAuth();
  const user = state.status === 'authenticated' ? state.user : null;
  const today = new Date().toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  return (
    <>
      <div className="dashboard-greeting">
        <h1>
          {greeting()}, {user?.name}
        </h1>
        <span className="dashboard-date">{today}</span>
      </div>
      {hasPermission('academic.view') ? (
        <AdminDashboard />
      ) : user?.role.name === 'TEACHER' ? (
        <TeacherDashboard />
      ) : user?.role.name === 'STUDENT' ? (
        <StudentDashboard />
      ) : (
        <p className="subtitle">Logged in as {user?.role.name}.</p>
      )}
    </>
  );
}
