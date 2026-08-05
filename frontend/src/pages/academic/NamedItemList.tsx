import { useState, type FormEvent } from 'react';

interface NamedItem {
  id: number;
  name: string;
}

// So classes sort 1, 2, ... 10 instead of 1, 10, 2 (plain string order).
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' });

interface NamedItemListProps {
  items: NamedItem[];
  canManage: boolean;
  onAdd: (name: string) => Promise<void>;
  onRename: (id: number, name: string) => Promise<void>;
  onDelete: (id: number) => Promise<void>;
  onSelect?: (id: number) => void;
  selectedId?: number;
  addPlaceholder: string;
  emptyText: string;
}

/** Shared "list of named rows with inline add/rename/delete" used for
 * classes, sections and subjects — identical shape, different API calls. */
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
}: NamedItemListProps) {
  const [newName, setNewName] = useState('');
  const [adding, setAdding] = useState(false);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editingName, setEditingName] = useState('');
  const [busyId, setBusyId] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  const sortedItems = [...items].sort((a, b) => collator.compare(a.name, b.name));

  const submitAdd = async (e: FormEvent) => {
    e.preventDefault();
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

  const submitEdit = async (e: FormEvent) => {
    e.preventDefault();
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

  const remove = async (item: NamedItem) => {
    if (!window.confirm(`Delete "${item.name}"?`)) return;
    setBusyId(item.id);
    setError(null);
    try {
      await onDelete(item.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    } finally {
      setBusyId(null);
    }
  };

  return (
    <div>
      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      {items.length === 0 && <p className="muted">{emptyText}</p>}

      <ul className="named-item-list">
        {sortedItems.map((item) => (
          <li key={item.id} className={selectedId === item.id ? 'named-item-selected' : ''}>
            {editingId === item.id ? (
              <form className="named-item-edit" onSubmit={(e) => void submitEdit(e)}>
                <input
                  value={editingName}
                  onChange={(e) => setEditingName(e.target.value)}
                  autoFocus
                  required
                />
                <button type="submit" disabled={busyId === item.id}>
                  Save
                </button>
                <button type="button" className="secondary" onClick={() => setEditingId(null)}>
                  Cancel
                </button>
              </form>
            ) : (
              <>
                {onSelect ? (
                  <button className="named-item-name link-button" onClick={() => onSelect(item.id)}>
                    {item.name}
                  </button>
                ) : (
                  <span className="named-item-name">{item.name}</span>
                )}
                {canManage && (
                  <div className="row-actions">
                    <button className="secondary" onClick={() => startEdit(item)} disabled={busyId === item.id}>
                      Rename
                    </button>
                    <button className="danger" onClick={() => void remove(item)} disabled={busyId === item.id}>
                      {busyId === item.id ? 'Deleting…' : 'Delete'}
                    </button>
                  </div>
                )}
              </>
            )}
          </li>
        ))}
      </ul>

      {canManage && (
        <form className="named-item-add" onSubmit={(e) => void submitAdd(e)}>
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder={addPlaceholder}
          />
          <button type="submit" disabled={adding || !newName.trim()}>
            {adding ? 'Adding…' : 'Add'}
          </button>
        </form>
      )}
    </div>
  );
}
