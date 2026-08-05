import { useCallback, useEffect, useState, type FormEvent } from 'react';
import * as academic from '../api/academic';
import type { AcademicYear } from '../api/academic';
import { useAuth } from '../auth/useAuth';
import { NamedItemList } from './academic/NamedItemList';

export function AcademicSetupPage() {
  const { hasPermission } = useAuth();
  const canManage = hasPermission('academic.manage');

  const [years, setYears] = useState<AcademicYear[]>([]);
  const [selectedYearId, setSelectedYearId] = useState<number | null>(null);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [selectedClassId, setSelectedClassId] = useState<number | null>(null);
  const [sections, setSections] = useState<academic.Section[]>([]);
  const [subjects, setSubjects] = useState<academic.Subject[]>([]);

  const [newYearName, setNewYearName] = useState('');
  const [newYearCurrent, setNewYearCurrent] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busyYearId, setBusyYearId] = useState<number | null>(null);

  const loadYears = useCallback(async () => {
    const rows = await academic.listAcademicYears();
    setYears(rows);
  }, []);

  useEffect(() => {
    void loadYears();
  }, [loadYears]);

  const loadClasses = useCallback(async (yearId: number) => {
    const rows = await academic.listClasses(yearId);
    setClasses(rows);
  }, []);

  useEffect(() => {
    if (selectedYearId === null) {
      setClasses([]);
      return;
    }
    void loadClasses(selectedYearId);
  }, [selectedYearId, loadClasses]);

  const loadSectionsAndSubjects = useCallback(async (classId: number) => {
    const [sectionRows, subjectRows] = await Promise.all([
      academic.listSections(classId),
      academic.listSubjects(classId),
    ]);
    setSections(sectionRows);
    setSubjects(subjectRows);
  }, []);

  useEffect(() => {
    if (selectedClassId === null) {
      setSections([]);
      setSubjects([]);
      return;
    }
    void loadSectionsAndSubjects(selectedClassId);
  }, [selectedClassId, loadSectionsAndSubjects]);

  const selectYear = (id: number) => {
    setSelectedYearId(id);
    setSelectedClassId(null);
  };

  const submitNewYear = async (e: FormEvent) => {
    e.preventDefault();
    if (!newYearName.trim()) return;
    setError(null);
    try {
      await academic.createAcademicYear(newYearName.trim(), newYearCurrent);
      setNewYearName('');
      setNewYearCurrent(false);
      await loadYears();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create academic year');
    }
  };

  const setCurrent = async (id: number) => {
    setBusyYearId(id);
    setError(null);
    try {
      await academic.updateAcademicYear(id, { isCurrent: true });
      await loadYears();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update academic year');
    } finally {
      setBusyYearId(null);
    }
  };

  const deleteYear = async (year: AcademicYear) => {
    if (!window.confirm(`Delete academic year "${year.name}"?`)) return;
    setBusyYearId(year.id);
    setError(null);
    try {
      await academic.deleteAcademicYear(year.id);
      if (selectedYearId === year.id) setSelectedYearId(null);
      await loadYears();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete academic year');
    } finally {
      setBusyYearId(null);
    }
  };

  const selectedYear = years.find((y) => y.id === selectedYearId) ?? null;
  const selectedClass = classes.find((c) => c.id === selectedClassId) ?? null;

  return (
    <>
      <h1>Academic Setup</h1>
      <p className="subtitle">Academic year → classes → sections &amp; subjects.</p>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      <section className="card">
        <h2>Academic years</h2>

        {years.length === 0 && <p className="muted">No academic years yet.</p>}

        <ul className="named-item-list">
          {years.map((year) => (
            <li key={year.id} className={selectedYearId === year.id ? 'named-item-selected' : ''}>
              <button className="named-item-name link-button" onClick={() => selectYear(year.id)}>
                {year.name}
              </button>
              {year.isCurrent && <span className="badge">Current</span>}
              {canManage && (
                <div className="row-actions">
                  {!year.isCurrent && (
                    <button onClick={() => void setCurrent(year.id)} disabled={busyYearId === year.id}>
                      Set current
                    </button>
                  )}
                  <button onClick={() => void deleteYear(year)} disabled={busyYearId === year.id}>
                    {busyYearId === year.id ? 'Deleting…' : 'Delete'}
                  </button>
                </div>
              )}
            </li>
          ))}
        </ul>

        {canManage && (
          <form className="named-item-add" onSubmit={(e) => void submitNewYear(e)}>
            <input
              value={newYearName}
              onChange={(e) => setNewYearName(e.target.value)}
              placeholder="e.g. 2026-27"
            />
            <label className="field-checkbox inline-checkbox">
              <input
                type="checkbox"
                checked={newYearCurrent}
                onChange={(e) => setNewYearCurrent(e.target.checked)}
              />
              <span>Current</span>
            </label>
            <button type="submit" disabled={!newYearName.trim()}>
              Add year
            </button>
          </form>
        )}
      </section>

      {selectedYear && (
        <section className="card">
          <h2>Classes in {selectedYear.name}</h2>
          <NamedItemList
            items={classes}
            canManage={canManage}
            onAdd={async (name) => {
              await academic.createClass(name, selectedYear.id);
              await loadClasses(selectedYear.id);
            }}
            onRename={async (id, name) => {
              await academic.updateClass(id, name);
              await loadClasses(selectedYear.id);
            }}
            onDelete={async (id) => {
              await academic.deleteClass(id);
              if (selectedClassId === id) setSelectedClassId(null);
              await loadClasses(selectedYear.id);
            }}
            onSelect={setSelectedClassId}
            selectedId={selectedClassId ?? undefined}
            addPlaceholder="e.g. 1, 2, 10"
            emptyText="No classes yet for this academic year."
          />
        </section>
      )}

      {selectedClass && (
        <div className="academic-detail-grid">
          <section className="card">
            <h2>Sections in Class {selectedClass.name}</h2>
            <NamedItemList
              items={sections}
              canManage={canManage}
              onAdd={async (name) => {
                await academic.createSection(name, selectedClass.id);
                await loadSectionsAndSubjects(selectedClass.id);
              }}
              onRename={async (id, name) => {
                await academic.updateSection(id, name);
                await loadSectionsAndSubjects(selectedClass.id);
              }}
              onDelete={async (id) => {
                await academic.deleteSection(id);
                await loadSectionsAndSubjects(selectedClass.id);
              }}
              addPlaceholder="e.g. A, B"
              emptyText="No sections yet for this class."
            />
          </section>

          <section className="card">
            <h2>Subjects in Class {selectedClass.name}</h2>
            <NamedItemList
              items={subjects}
              canManage={canManage}
              onAdd={async (name) => {
                await academic.createSubject(name, selectedClass.id);
                await loadSectionsAndSubjects(selectedClass.id);
              }}
              onRename={async (id, name) => {
                await academic.updateSubject(id, name);
                await loadSectionsAndSubjects(selectedClass.id);
              }}
              onDelete={async (id) => {
                await academic.deleteSubject(id);
                await loadSectionsAndSubjects(selectedClass.id);
              }}
              addPlaceholder="e.g. Mathematics"
              emptyText="No subjects yet for this class."
            />
          </section>
        </div>
      )}
    </>
  );
}
