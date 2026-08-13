import React, { useState } from 'react';
import { Alert, StyleSheet, Text, TextInput, View } from 'react-native';
import { colors, fonts, radius, spacing } from '../theme';
import { Button } from './Button';
import { Touchable } from './Touchable';

interface NamedItem {
  id: number;
  name: string;
}

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

interface NamedItemListProps {
  items: NamedItem[];
  canManage: boolean;
  onAdd: (name: string) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onSelect?: (id: number) => void;
  selectedId?: number | null;
  addPlaceholder: string;
  emptyText: string;
}

/** Shared "list of named rows with inline add/rename/delete" — mirrors
 * web's NamedItemList.tsx (classes/sections/subjects share this shape). */
export function NamedItemList({
  items,
  canManage,
  onAdd,
  onRename,
  onDelete,
  onSelect,
  selectedId,
  addPlaceholder,
  emptyText,
}: NamedItemListProps): React.JSX.Element {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedItems = [...items].sort((a, b) => collator.compare(a.name, b.name));

  const submitAdd = async () => {
    if (!newName.trim()) return;
    setAdding(true);
    setError(null);
    try {
      await onAdd(newName.trim());
      setNewName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add');
    } finally {
      setAdding(false);
    }
  };

  const startEdit = (item: NamedItem) => {
    setEditingId(item.id);
    setEditingName(item.name);
  };

  const submitEdit = async () => {
    if (editingId === null || !editingName.trim()) return;
    setBusyId(editingId);
    setError(null);
    try {
      await onRename(editingId, editingName.trim());
      setEditingId(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to rename');
    } finally {
      setBusyId(null);
    }
  };

  const remove = (item: NamedItem) => {
    Alert.alert(`Delete "${item.name}"?`, undefined, [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: async () => {
          setBusyId(item.id);
          setError(null);
          try {
            await onDelete(item.id);
          } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.container}>
      {error && <Text style={styles.error}>{error}</Text>}
      {items.length === 0 && <Text style={styles.muted}>{emptyText}</Text>}

      {sortedItems.map((item) => (
        <View key={item.id} style={[styles.row, selectedId === item.id && styles.rowSelected]}>
          {editingId === item.id ? (
            <View style={styles.editRow}>
              <TextInput
                style={styles.editInput}
                value={editingName}
                onChangeText={setEditingName}
                autoFocus
                placeholderTextColor={colors.textMuted}
              />
              <Touchable style={styles.iconBtn} onPress={submitEdit} disabled={busyId === item.id}>
                <Text style={styles.iconBtnText}>Save</Text>
              </Touchable>
              <Touchable style={styles.iconBtn} onPress={() => setEditingId(null)}>
                <Text style={styles.iconBtnTextMuted}>Cancel</Text>
              </Touchable>
            </View>
          ) : (
            <>
              <Touchable
                style={styles.nameWrap}
                onPress={onSelect ? () => onSelect(item.id) : undefined}
                disabled={!onSelect}
              >
                <Text style={onSelect ? styles.nameLink : styles.name}>{item.name}</Text>
              </Touchable>
              {canManage && (
                <View style={styles.actions}>
                  <Touchable style={styles.iconBtn} onPress={() => startEdit(item)} disabled={busyId === item.id}>
                    <Text style={styles.iconBtnText}>Rename</Text>
                  </Touchable>
                  <Touchable style={styles.iconBtn} onPress={() => remove(item)} disabled={busyId === item.id}>
                    <Text style={styles.iconBtnDanger}>{busyId === item.id ? 'Deleting…' : 'Delete'}</Text>
                  </Touchable>
                </View>
              )}
            </>
          )}
        </View>
      ))}

      {canManage && (
        <View style={styles.addRow}>
          <TextInput
            style={styles.addInput}
            value={newName}
            onChangeText={setNewName}
            placeholder={addPlaceholder}
            placeholderTextColor={colors.textMuted}
          />
          <Button label={adding ? 'Adding…' : 'Add'} onPress={submitAdd} disabled={adding || !newName.trim()} />
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs },
  error: { color: colors.danger, fontSize: 13, fontFamily: fonts.body },
  muted: { fontSize: 13, fontFamily: fonts.body, color: colors.textMuted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
    paddingVertical: spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  rowSelected: { backgroundColor: colors.primaryTint, borderRadius: radius.sm, paddingHorizontal: spacing.sm },
  nameWrap: { flex: 1, paddingVertical: spacing.xs },
  name: { fontSize: 15, fontFamily: fonts.body, color: colors.text },
  nameLink: { fontSize: 15, fontFamily: fonts.bodySemiBold, color: colors.primary },
  actions: { flexDirection: 'row', gap: spacing.md },
  iconBtn: { paddingVertical: spacing.xs, paddingHorizontal: spacing.xs },
  iconBtnText: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.primary },
  iconBtnTextMuted: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.textMuted },
  iconBtnDanger: { fontSize: 13, fontFamily: fonts.bodySemiBold, color: colors.danger },
  editRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  editInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    fontSize: 14,
    fontFamily: fonts.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
  addRow: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm, alignItems: 'center' },
  addInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm + 2,
    fontSize: 15,
    fontFamily: fonts.body,
    color: colors.text,
    backgroundColor: colors.surface,
  },
});
