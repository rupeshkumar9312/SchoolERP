import React from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts, radius, spacing } from '../theme';
import { Touchable } from './Touchable';

export interface ActionSheetItem {
  key: string;
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  onPress: () => void;
  /** Renders in red, below a divider from the rest — for the one action on
   * the sheet (if any) that can't be undone. Never more than one per sheet:
   * a sheet with several red rows stops meaning anything. */
  destructive?: boolean;
  loading?: boolean;
}

interface ActionSheetProps {
  visible: boolean;
  onClose: () => void;
  /** The row's own name/title — grounds the sheet in which item it's acting
   * on, since it's opened from a list. */
  title?: string;
  items: ActionSheetItem[];
}

/** The overflow menu for a list row's actions — replaces a card's worth of
 * full-width Edit/Delete/etc. buttons with one small trigger (see
 * IconButton) and this sheet. Safe actions group together; a destructive one
 * (if present) sits below a divider, in red, so it's reachable but never the
 * loudest thing on the card underneath. */
export function ActionSheet({ visible, onClose, title, items }: ActionSheetProps): React.JSX.Element {
  const insets = useSafeAreaInsets();
  const safeItems = items.filter((i) => !i.destructive);
  const destructiveItems = items.filter((i) => i.destructive);

  const row = (item: ActionSheetItem) => (
    <Touchable
      key={item.key}
      onPress={() => {
        onClose();
        item.onPress();
      }}
      rippleColor={item.destructive ? colors.dangerTint : colors.primaryTint}
      style={styles.rowTouchable}
    >
      <View style={styles.row}>
        <Ionicons
          name={item.icon}
          size={20}
          color={item.destructive ? colors.danger : colors.textMuted}
        />
        <Text style={[styles.rowLabel, item.destructive && styles.rowLabelDestructive]}>{item.label}</Text>
      </View>
    </Touchable>
  );

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.grabber} />
          {title && <Text style={styles.title}>{title}</Text>}

          <View style={styles.group}>{safeItems.map(row)}</View>

          {destructiveItems.length > 0 && (
            <>
              <View style={styles.divider} />
              <View style={styles.group}>{destructiveItems.map(row)}</View>
            </>
          )}

          <View style={styles.divider} />
          <Touchable onPress={onClose} style={styles.rowTouchable}>
            <View style={styles.row}>
              <Text style={styles.cancelLabel}>Cancel</Text>
            </View>
          </Touchable>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.5)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingTop: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  grabber: {
    alignSelf: 'center',
    width: 36,
    height: 4,
    borderRadius: 2,
    backgroundColor: colors.border,
    marginBottom: spacing.md,
  },
  title: {
    fontSize: 13,
    fontFamily: fonts.bodySemiBold,
    color: colors.textMuted,
    marginBottom: spacing.xs,
  },
  group: { gap: spacing.xs / 2 },
  divider: { height: 1, backgroundColor: colors.border, marginVertical: spacing.sm },
  // Touchable nests its children inside an unstyled wrapper View, so the row
  // layout has to live on this inner View — flexDirection on the Touchable
  // itself would have no child to apply it to (see IconButton/Button, which
  // never hit this because they only ever pass Touchable a single child).
  rowTouchable: { borderRadius: radius.md },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  rowLabel: { fontSize: 15, fontFamily: fonts.bodyMedium, color: colors.text },
  rowLabelDestructive: { color: colors.danger, fontFamily: fonts.bodySemiBold },
  cancelLabel: {
    flex: 1,
    textAlign: 'center',
    fontSize: 15,
    fontFamily: fonts.bodySemiBold,
    color: colors.textMuted,
  },
});
