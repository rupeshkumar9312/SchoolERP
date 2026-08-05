import { useCallback, useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as academic from '../api/academic';
import { ApiError } from '../api/client';
import type { Assignment, ClassTeacherSection } from '../api/teachers';
import {
  createAssignment,
  deleteAssignment,
  getTeacher,
  listAssignments,
  listClassTeacherOf,
  setClassTeacher,
  unsetClassTeacher,
} from '../api/teachers';

export function TeacherAssignmentsPage() {
  const { id } = useParams();
  const teacherId = Number(id);
  const navigate = useNavigate();

  const [teacherName, setTeacherName] = useState('');
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [classTeacherOf, setClassTeacherOf] = useState<ClassTeacherSection[]>([]);

  const [years, setYears] = useState<academic.AcademicYear[]>([]);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [sections, setSections] = useState<academic.Section[]>([]);
  const [subjects, setSubjects] = useState<academic.Subject[]>([]);

  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [subjectIds, setSubjectIds] = useState<number[]>([]);
  const [assignAsClassTeacher, setAssignAsClassTeacher] = useState(false);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [removingId, setRemovingId] = useState<number | null>(null);
  const [removingSectionId, setRemovingSectionId] = useState<number | null>(null);

  const loadAssignments = useCallback(async () => {
    setAssignments(await listAssignments(teacherId));
  }, [teacherId]);

  const loadClassTeacherOf = useCallback(async () => {
    setClassTeacherOf(await listClassTeacherOf(teacherId));
  }, [teacherId]);

  useEffect(() => {
    setLoading(true);
    Promise.all([getTeacher(teacherId), loadAssignments(), loadClassTeacherOf(), academic.listAcademicYears()])
      .then(([teacher, , , yearRows]) => {
        setTeacherName(teacher.name);
        setYears(yearRows);
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load'))
      .finally(() => setLoading(false));
  }, [teacherId, loadAssignments, loadClassTeacherOf]);

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
      setSubjects([]);
      return;
    }
    const id = Number(classId);
    void Promise.all([academic.listSections(id), academic.listSubjects(id)]).then(([s, sub]) => {
      setSections(s);
      setSubjects(sub);
    });
  }, [classId]);

  const toggleSubject = (subjectId: number) => {
    setSubjectIds((prev) => (prev.includes(subjectId) ? prev.filter((s) => s !== subjectId) : [...prev, subjectId]));
  };

  const onAssign = async () => {
    if (!classId || !sectionId || (subjectIds.length === 0 && !assignAsClassTeacher)) return;
    setSubmitting(true);
    setError(null);
    try {
      if (subjectIds.length > 0) {
        const [firstSubjectId, ...restSubjectIds] = subjectIds;
        // Only one create call needs to carry the class-teacher flag — it's a
        // section-level hand-off, not a per-subject one.
        await createAssignment(teacherId, {
          classId: Number(classId),
          sectionId: Number(sectionId),
          subjectId: firstSubjectId,
          isClassTeacher: assignAsClassTeacher,
        });
        for (const subjectId of restSubjectIds) {
          await createAssignment(teacherId, { classId: Number(classId), sectionId: Number(sectionId), subjectId });
        }
      } else {
        await setClassTeacher(teacherId, Number(sectionId));
      }
      setSubjectIds([]);
      setAssignAsClassTeacher(false);
      await Promise.all([loadAssignments(), loadClassTeacherOf()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to assign');
    } finally {
      setSubmitting(false);
    }
  };

  const onRemove = async (assignment: Assignment) => {
    setRemovingId(assignment.id);
    setError(null);
    try {
      await deleteAssignment(teacherId, assignment.id);
      await Promise.all([loadAssignments(), loadClassTeacherOf()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove assignment');
    } finally {
      setRemovingId(null);
    }
  };

  const onRemoveClassTeacher = async (targetSectionId: number) => {
    setRemovingSectionId(targetSectionId);
    setError(null);
    try {
      await unsetClassTeacher(teacherId, targetSectionId);
      await Promise.all([loadAssignments(), loadClassTeacherOf()]);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove class teacher status');
    } finally {
      setRemovingSectionId(null);
    }
  };

  if (loading) return <p className="muted">Loading…</p>;

  return (
    <>
      <h1>Assignments — {teacherName}</h1>
      <p className="subtitle">Pick a class, section and one or more subjects to assign.</p>

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      <section className="card">
        <h2>Current assignments</h2>
        {assignments.length === 0 ? (
          <p className="muted">No assignments yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Section</th>
                <th>Subject</th>
                <th>Class teacher?</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <tr key={a.id}>
                  <td data-label="Class">{a.class.name}</td>
                  <td data-label="Section">{a.section.name}</td>
                  <td data-label="Subject">{a.subject.name}</td>
                  <td data-label="Class teacher?">
                    {a.isClassTeacher ? <span className="badge">Yes</span> : '—'}
                  </td>
                  <td data-label="Actions">
                    <button className="danger" onClick={() => void onRemove(a)} disabled={removingId === a.id}>
                      {removingId === a.id ? 'Removing…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Class teacher of</h2>
        <p className="subtitle">Only the class teacher of a section may mark its attendance.</p>
        {classTeacherOf.length === 0 ? (
          <p className="muted">Not the class teacher of any section yet.</p>
        ) : (
          <table className="data-table">
            <thead>
              <tr>
                <th>Class</th>
                <th>Section</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {classTeacherOf.map((c) => (
                <tr key={c.section.id}>
                  <td data-label="Class">{c.class.name}</td>
                  <td data-label="Section">{c.section.name}</td>
                  <td data-label="Actions">
                    <button
                      className="danger"
                      onClick={() => void onRemoveClassTeacher(c.section.id)}
                      disabled={removingSectionId === c.section.id}
                    >
                      {removingSectionId === c.section.id ? 'Removing…' : 'Remove'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      <section className="card">
        <h2>Add assignment</h2>

        <label className="field">
          <span>Academic year</span>
          <select
            value={yearId}
            onChange={(e) => {
              setYearId(e.target.value);
              setClassId('');
              setSectionId('');
              setSubjectIds([]);
              setAssignAsClassTeacher(false);
            }}
          >
            <option value="">Select a year</option>
            {years.map((y) => (
              <option key={y.id} value={y.id}>
                {y.name}
              </option>
            ))}
          </select>
        </label>

        {yearId && (
          <label className="field">
            <span>Class</span>
            <select
              value={classId}
              onChange={(e) => {
                setClassId(e.target.value);
                setSectionId('');
                setSubjectIds([]);
                setAssignAsClassTeacher(false);
              }}
            >
              <option value="">Select a class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </label>
        )}

        {classId && (
          <>
            <label className="field">
              <span>Section</span>
              <select value={sectionId} onChange={(e) => setSectionId(e.target.value)}>
                <option value="">Select a section</option>
                {sections.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </label>

            {sectionId && (
              <label className="field-checkbox inline-checkbox">
                <input
                  type="checkbox"
                  checked={assignAsClassTeacher}
                  onChange={(e) => setAssignAsClassTeacher(e.target.checked)}
                />
                <span>Set as class teacher of this section (needed to mark its attendance)</span>
              </label>
            )}

            <div className="field">
              <span>Subject(s) (optional if only setting the class teacher above)</span>
              {subjects.length === 0 ? (
                <p className="muted">No subjects defined for this class yet.</p>
              ) : (
                <div className="checkbox-group">
                  {subjects.map((s) => (
                    <label key={s.id} className="field-checkbox inline-checkbox">
                      <input
                        type="checkbox"
                        checked={subjectIds.includes(s.id)}
                        onChange={() => toggleSubject(s.id)}
                      />
                      <span>{s.name}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
          </>
        )}

        <div className="form-actions">
          <button
            onClick={() => void onAssign()}
            disabled={submitting || !classId || !sectionId || (subjectIds.length === 0 && !assignAsClassTeacher)}
          >
            {submitting ? 'Assigning…' : 'Assign'}
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/teachers')}>
            Back to teachers
          </button>
        </div>
      </section>
    </>
  );
}
