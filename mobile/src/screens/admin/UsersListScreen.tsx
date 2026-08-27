import React, { useCallback, useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useFocusEffect } from '@react-navigation/native';
import { Alert, Modal, StyleSheet, Text, TextInput, View } from 'react-native';
import { ApiError } from '../../api/client';
import { PAGE_SIZE } from '../../api/pagination';
import { Role, listRoles } from '../../api/roles';
import { UserListItem, deleteUser, listUsers, resetUserPassword } from '../../api/users';
import { useAuth } from '../../auth/AuthContext';
import { ActionSheet, ActionSheetItem } from '../../components/ActionSheet';
import { Badge } from '../../components/Badge';
import { Button } from '../../components/Button';
import { Card } from '../../components/Card';
import { DataRow, DataRowText } from '../../components/DataRow';
import { ErrorView } from '../../components/ErrorView';
import { IconButton } from '../../components/IconButton';
import { LoadingView } from '../../components/LoadingView';
import { Screen } from '../../components/Screen';
import { SearchInput } from '../../components/SearchInput';
import { SelectField } from '../../components/SelectField';
import { colors, fonts, radius, spacing } from '../../theme';
import { edvanceLoginAlias, sharePasswordResetViaWhatsApp } from '../../utils/whatsapp';
import type { ManageStackParamList } from '../../navigation/types';

type Props = NativeStackScreenProps<ManageStackParamList, 'UsersList'>;

export function UsersListScreen({ navigation }: Props): React.JSX.Element {
  const { hasPermission, user: me } = useAuth();
  const isSuperAdmin = me?.role.name === 'SUPER_ADMIN';
  const canCreate = hasPermission('user.create');
  const canEdit = hasPermission('user.edit');
  const canDelete = hasPermission('user.delete');

  const [users, setUsers] = useState<UserListItem[] | null>(null);
  const [total, setTotal] = useState(0);
  const [roles, setRoles] = useState<Role[]>([]);
  const [roleFilter, setRoleFilter] = useState<number | null>(null);
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [resetResult, setResetResult] = useState<
    { name: string; email: string; edvanceId: string; temporaryPassword: string } | null
  >(null);
  const [menuUser, setMenuUser] = useState<UserListItem | null>(null);

  const load = useCallback(async (filter: number | null, searchText: string) => {
    setError(null);
    try {
      const [result, roleRows] = await Promise.all([
        listUsers({ roleId: filter ?? undefined, search: searchText.trim() || undefined, page: 1, limit: PAGE_SIZE }),
        roles.length ? Promise.resolve(roles) : listRoles(),
      ]);
      setUsers(result.items);
      setTotal(result.total);
      if (!roles.length) setRoles(roleRows);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load users');
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadMore = async () => {
    if (!users) return;
    setLoadingMore(true);
    try {
      const nextPage = Math.floor(users.length / PAGE_SIZE) + 1;
      const result = await listUsers({
        roleId: roleFilter ?? undefined,
        search: search.trim() || undefined,
        page: nextPage,
        limit: PAGE_SIZE,
      });
      setUsers((prev) => [...(prev ?? []), ...result.items]);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Could not load more users');
    } finally {
      setLoadingMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      const timeout = setTimeout(() => load(roleFilter, search), 250);
      return () => clearTimeout(timeout);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [roleFilter, search]),
  );

  const handleDelete = (u: UserListItem) => {
    Alert.alert('Delete user', `Delete ${u.name}? This can't be undone.`, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteUser(u.id);
            setUsers((prev) => (prev ?? []).filter((x) => x.id !== u.id));
            setTotal((prev) => prev - 1);
          } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not delete user');
          }
        },
      },
    ]);
  };

  const handleResetPassword = (u: UserListItem) => {
    Alert.alert(
      `Reset ${u.name}'s password?`,
      'A new temporary password will be generated, and they will be signed out of any active session.',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Reset password',
          onPress: async () => {
            try {
              const { temporaryPassword } = await resetUserPassword(u.id);
              setResetResult({ name: u.name, email: u.email, edvanceId: u.edvanceId, temporaryPassword });
            } catch (err) {
              setError(err instanceof ApiError ? err.message : 'Could not reset password');
            }
          },
        },
      ],
    );
  };

  if (loading) return <LoadingView />;
  if (error && !users) {
    return (
      <Screen>
        <ErrorView message={error} onRetry={() => load(roleFilter, search)} />
      </Screen>
    );
  }

  return (
    <Screen refreshing={loading} onRefresh={() => load(roleFilter, search)}>
      <View style={styles.headerRow}>
        <Text style={styles.heading}>Users</Text>
        {canCreate && <Button label="+ New" onPress={() => navigation.navigate('UserForm', undefined)} />}
      </View>

      <SelectField
        label="Filter by role"
        value={roleFilter}
        onChange={setRoleFilter}
        placeholder="All roles"
        options={[{ value: null, label: 'All roles' }, ...roles.map((r) => ({ value: r.id, label: r.name }))]}
      />
      <SearchInput value={search} onChangeText={setSearch} placeholder="Name or login ID" />

      {error && users && <Text style={styles.error}>{error}</Text>}

      {users && users.length === 0 && (
        <Card>
          <Text style={styles.muted}>No users found. Try clearing your filters, or create the first one.</Text>
        </Card>
      )}

      {users?.map((u) => (
        <Card key={u.id} style={styles.card}>
          <View style={styles.cardHead}>
            <View style={styles.cardHeadMain}>
              <Text style={styles.name} numberOfLines={1}>
                {u.name}
              </Text>
              <Badge label={u.isActive ? 'Active' : 'Inactive'} tone={u.isActive ? 'success' : 'muted'} />
            </View>
            {(canEdit || canDelete || isSuperAdmin) && (
              <IconButton name="ellipsis-vertical" onPress={() => setMenuUser(u)} />
            )}
          </View>
          <DataRowText label="Login ID" value={u.email} />
          <DataRowText label="Phone" value={u.phone ?? '—'} />
          <DataRow label="Role">
            <Badge label={u.role.name} tone="primary" />
          </DataRow>
        </Card>
      ))}

      {users && users.length > 0 && users.length < total && (
        <Button label={`Load more (${users.length} of ${total})`} variant="secondary" onPress={() => void loadMore()} loading={loadingMore} />
      )}

      <Modal
        visible={!!resetResult}
        transparent
        animationType="fade"
        onRequestClose={() => setResetResult(null)}
      >
        <View style={styles.modalBackdrop}>
          <Card style={styles.modalCard}>
            <Text style={styles.heading}>Password reset</Text>
            <Text style={styles.body}>
              New temporary password for <Text style={styles.bold}>{resetResult?.name}</Text> (
              {resetResult?.email}). Copy this now — it can't be shown again after you leave this screen.
            </Text>
            <TextInput
              style={styles.tempInput}
              value={resetResult?.temporaryPassword ?? ''}
              editable={false}
              selectTextOnFocus
            />
            <Button
              label="Share via WhatsApp"
              variant="secondary"
              onPress={() =>
                resetResult &&
                sharePasswordResetViaWhatsApp({
                  name: resetResult.name,
                  loginId: edvanceLoginAlias(resetResult.edvanceId),
                  password: resetResult.temporaryPassword,
                })
              }
            />
            <Button label="Done" onPress={() => setResetResult(null)} />
          </Card>
        </View>
      </Modal>

      <ActionSheet
        visible={!!menuUser}
        onClose={() => setMenuUser(null)}
        title={menuUser?.name}
        items={
          menuUser
            ? ([
                canEdit && {
                  key: 'edit',
                  label: 'Edit',
                  icon: 'create-outline',
                  onPress: () => navigation.navigate('UserForm', { user: menuUser }),
                },
                isSuperAdmin && {
                  key: 'reset',
                  label: 'Reset password',
                  icon: 'key-outline',
                  onPress: () => handleResetPassword(menuUser),
                },
                canDelete && {
                  key: 'delete',
                  label: 'Delete',
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: () => handleDelete(menuUser),
                },
              ].filter(Boolean) as ActionSheetItem[])
            : []
        }
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  headerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  heading: { fontSize: 20, fontFamily: fonts.headingBold, color: colors.text },
  muted: { fontSize: 12, fontFamily: fonts.body, color: colors.textMuted },
  body: { fontSize: 13, fontFamily: fonts.body, color: colors.text, lineHeight: 19 },
  bold: { fontFamily: fonts.bodySemiBold },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  card: { gap: spacing.xs },
  cardHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing.sm },
  cardHeadMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, flexShrink: 1 },
  name: { fontSize: 16, fontFamily: fonts.headingBold, color: colors.text, flexShrink: 1 },
  modalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: spacing.xl,
  },
  modalCard: { width: '100%', gap: spacing.sm },
  tempInput: {
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    fontFamily: fonts.bodySemiBold,
    color: colors.text,
    backgroundColor: colors.bg,
  },
});
