import { ChangePasswordForm } from '../components/ChangePasswordForm';
import { useToast } from '../components/useToast';

export function SettingsPage() {
  const toast = useToast();

  return (
    <>
      <h1>Settings</h1>
      <p className="subtitle">Change your account password.</p>

      <ChangePasswordForm onSuccess={() => toast('Password changed.')} />
    </>
  );
}
