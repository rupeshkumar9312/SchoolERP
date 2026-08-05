import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import * as academic from '../api/academic';
import { ApiError } from '../api/client';
import type { Student } from '../api/students';
import { deleteStudent, listStudents } from '../api/students';
import { useAuth } from '../auth/useAuth';

export function StudentsListPage() {
  const { hasPermission } = useAuth();
  const [years, setYears] = useState<academic.AcademicYear[]>([]);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [sections, setSections] = useState<academic.Section[]>([]);

  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [search, setSearch] = useState('');

  const [students, setStudents] = useState<Student[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  useEffect(() => {
    void academic.listAcademicYears().then(setYears);
  }, []);

  useEffect(() => {
    if (!yearId) {
      setClasses([]);
      return;
    }
    void academic.listClasses(Number(yearId)).then(setClasses);
  }, [yearId]);

  useEffect(() => {
    if (!classId) {
      setSections([]);
      return;
    }
    void academic.listSections(Number(classId)).then(setSections);
  }, [classId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setStudents(
        await listStudents({
          classId: classId ? Number(classId) : undefined,
          sectionId: sectionId ? Number(sectionId) : undefined,
          search: search || undefined,
        }),
      );
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load students');
    } finally {
      setLoading(false);
    }
  }, [classId, sectionId, search]);

  useEffect(() => {
    void load();
  }, [load]);

  const onDelete = async (student: Student) => {
    if (!window.confirm(`Delete ${student.name}? This can't be undone.`)) return;
    setDeletingId(student.id);
    try {
      await deleteStudent(student.id);
      setStudents((prev) => prev.filter((s) => s.id !== student.id));
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete student');
    } finally {
      setDeletingId(null);
    }
  };

  const canEdit = hasPermission('student.edit');
  const canDelete = hasPermission('student.delete');
  const showActions = canEdit || canDelete;

  return (
    <>
      <div className="card-head">
        <h1>Students</h1>
        {hasPermission('student.create') && (
          <Link to="/students/new">
            <button>New student</button>
          </Link>
        )}
      </div>

      <div className="filter-bar">
        <label className="field">
          <span>Academic year</span>
          <select
            value={yearId}
            onChange={(e) => {
              setYearId(e.target.value);
              setClassId('');
              setSectionId('');
            }}
          >
            <option value="">All years</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Class</span>
          <select
            value={classId}
            onChange={(e) => {
              setClassId(e.target.value);
              setSectionId('');
            }}
            disabled={!yearId}
          >
            <option value="">All classes</option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Section</span>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId}>
            <option value="">All sections</option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Search</span>
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Name or admission no."
          />
        </label>
      </div>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <p className="muted">Loading…</p>
      ) : students.length === 0 ? (
        <p className="muted">No students found.</p>
      ) : (
        <table className="data-table">
          <thead>
            <tr>
              <th>Admission No.</th>
              <th>Name</th>
              <th>Class</th>
              <th>Section</th>
              <th>Guardian</th>
              <th>Status</th>
              {showActions && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {students.map((student) => (
              <tr key={student.id}>
                <td data-label="Admission No.">{student.admissionNo}</td>
                <td data-label="Name">{student.name}</td>
                <td data-label="Class">{student.class.name}</td>
                <td data-label="Section">{student.section.name}</td>
                <td data-label="Guardian">{student.guardianName ?? '—'}</td>
                <td data-label="Status">{student.isActive ? 'Active' : 'Inactive'}</td>
                {showActions && (
                  <td data-label="Actions">
                    <div className="row-actions">
                      {canEdit && (
                        <Link to={`/students/${student.id}/edit`}>
                          <button>Edit</button>
                        </Link>
                      )}
                      {canDelete && (
                        <button onClick={() => void onDelete(student)} disabled={deletingId === student.id}>
                          {deletingId === student.id ? 'Deleting…' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </>
  );
}
