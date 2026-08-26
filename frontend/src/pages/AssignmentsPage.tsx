import type { ChangeEvent, FormEvent } from 'react';
import { Fragment, useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import * as academic from '../api/academic';
import { ApiError } from '../api/client';
import type { HomeworkAssignment, HomeworkSubmission } from '../api/homework';
import {
  createHomeworkAssignment,
  deleteHomeworkAssignment,
  deleteHomeworkAttachment,
  downloadHomeworkAttachment,
  listHomeworkAssignments,
  listHomeworkSubmissions,
  setHomeworkSubmission,
  updateHomeworkAssignment,
  uploadHomeworkAttachment,
} from '../api/homework';
import type { Assignment as TeachingAssignment } from '../api/teachers';
import { listMyAssignments } from '../api/teachers';
import { triggerBlobDownload } from '../api/students';
import { useAuth } from '../auth/useAuth';
import { EmptyState } from '../components/EmptyState';
import { Pager } from '../components/Pager';
import { TableSkeleton } from '../components/Skeleton';
import { useConfirm } from '../components/useConfirm';
import { useToast } from '../components/useToast';

const PAGE_SIZE = 25;
const ATTACHMENT_ACCEPT =
  '.pdf,.doc,.docx,.ppt,.pptx,.xls,.xlsx,.png,.jpg,.jpeg,application/pdf,application/msword,image/png,image/jpeg';

function optionKeyFor(o: TeachingAssignment): string {
  return `${o.class.id}-${o.section.id}-${o.subject.id}`;
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function AssignmentsPage() {
  const { state } = useAuth();
  const confirm = useConfirm();
  const toast = useToast();
  const isTeacher = state.status === 'authenticated' && state.user.role.name === 'TEACHER';

  const [assignments, setAssignments] = useState<HomeworkAssignment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Teacher-only: which class+section+subject combos they may set homework
  // for, and the "new assignment" form state.
  const [teachingOptions, setTeachingOptions] = useState<TeachingAssignment[]>([]);
  const [optionKey, setOptionKey] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [repeatWeeklyUntil, setRepeatWeeklyUntil] = useState('');
  const [attachmentFile, setAttachmentFile] = useState<File | null>(null);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const createFileInputRef = useRef<HTMLInputElement>(null);

  // Admin-tier only: read-all filters.
  const [years, setYears] = useState<academic.AcademicYear[]>([]);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [sections, setSections] = useState<academic.Section[]>([]);
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');

  const [editingId, setEditingId] = useState<number | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editDescription, setEditDescription] = useState('');
  const [editDueDate, setEditDueDate] = useState('');
  const [savingEdit, setSavingEdit] = useState(false);
  const [deletingId, setDeletingId] = useState<number | null>(null);

  const [attachmentBusyId, setAttachmentBusyId] = useState<number | null>(null);

  const [expandedSubmissionsId, setExpandedSubmissionsId] = useState<number | null>(null);
  const [submissions, setSubmissions] = useState<HomeworkSubmission[]>([]);
  const [submissionsLoading, setSubmissionsLoading] = useState(false);
  const [submissionsError, setSubmissionsError] = useState<string | null>(null);
  const [remarksDraft, setRemarksDraft] = useState<Record<number, string>>({});
  const [savingSubmissionKey, setSavingSubmissionKey] = useState<string | null>(null);

  useEffect(() => {
    if (isTeacher) {
      void listMyAssignments().then(setTeachingOptions);
    } else {
      void academic.listAcademicYears().then(setYears);
    }
  }, [isTeacher]);

  useEffect(() => {
    if (isTeacher || !yearId) {
      setClasses([]);
      return;
    }
    void academic.listClasses(Number(yearId)).then(setClasses);
  }, [isTeacher, yearId]);

  useEffect(() => {
    if (isTeacher || !classId) {
      setSections([]);
      return;
    }
    void academic.listSections(Number(classId)).then(setSections);
  }, [isTeacher, classId]);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await listHomeworkAssignments(
        isTeacher
          ? { page, limit: PAGE_SIZE }
          : {
              classId: classId ? Number(classId) : undefined,
              sectionId: sectionId ? Number(sectionId) : undefined,
              page,
              limit: PAGE_SIZE,
            },
      );
      setAssignments(result.items);
      setTotal(result.total);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to load assignments');
    } finally {
      setLoading(false);
    }
  }, [isTeacher, classId, sectionId, page]);

  useEffect(() => {
    void load();
  }, [load]);

  const onCreateFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setAttachmentFile(e.target.files?.[0] ?? null);
  };

  const onCreate = async (e: FormEvent) => {
    e.preventDefault();
    const option = teachingOptions.find((o) => optionKeyFor(o) === optionKey);
    if (!option || !title.trim() || !dueDate) return;

    setCreating(true);
    setCreateError(null);
    try {
      let created = await createHomeworkAssignment({
        classId: option.class.id,
        sectionId: option.section.id,
        subjectId: option.subject.id,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate,
        repeatWeeklyUntil: repeatWeeklyUntil || undefined,
      });

      if (attachmentFile) {
        created = await uploadHomeworkAttachment(created.id, attachmentFile);
      }

      if (repeatWeeklyUntil) {
        // Several rows were created server-side — refetch rather than guess at them.
        await load();
        toast('Recurring assignments created.');
      } else {
        setAssignments((prev) => [...prev, created].sort((a, b) => a.dueDate.localeCompare(b.dueDate)));
        setTotal((prev) => prev + 1);
        toast('Assignment created.');
      }

      setTitle('');
      setDescription('');
      setDueDate('');
      setRepeatWeeklyUntil('');
      setOptionKey('');
      setAttachmentFile(null);
      if (createFileInputRef.current) createFileInputRef.current.value = '';
    } catch (err) {
      setCreateError(err instanceof ApiError ? err.message : 'Failed to create assignment');
    } finally {
      setCreating(false);
    }
  };

  const startEdit = (a: HomeworkAssignment) => {
    setEditingId(a.id);
    setEditTitle(a.title);
    setEditDescription(a.description ?? '');
    setEditDueDate(a.dueDate.slice(0, 10));
  };

  const saveEdit = async (id: number) => {
    setSavingEdit(true);
    try {
      const updated = await updateHomeworkAssignment(id, {
        title: editTitle.trim(),
        description: editDescription.trim() || undefined,
        dueDate: editDueDate || undefined,
      });
      setAssignments((prev) =>
        prev.map((a) => (a.id === id ? updated : a)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)),
      );
      setEditingId(null);
      toast('Assignment updated.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to update assignment');
    } finally {
      setSavingEdit(false);
    }
  };

  const onDelete = async (a: HomeworkAssignment) => {
    const ok = await confirm({
      title: `Delete "${a.title}"?`,
      message: "This can't be undone.",
      confirmLabel: 'Delete',
    });
    if (!ok) return;
    setDeletingId(a.id);
    try {
      await deleteHomeworkAssignment(a.id);
      setAssignments((prev) => prev.filter((x) => x.id !== a.id));
      setTotal((prev) => prev - 1);
      if (expandedSubmissionsId === a.id) setExpandedSubmissionsId(null);
      toast('Assignment deleted.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to delete assignment');
    } finally {
      setDeletingId(null);
    }
  };

  // ---- Attachments ----

  const onRowFileChange = async (a: HomeworkAssignment, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setAttachmentBusyId(a.id);
    try {
      const updated = await uploadHomeworkAttachment(a.id, file);
      setAssignments((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
      toast('Attachment uploaded.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to upload attachment');
    } finally {
      setAttachmentBusyId(null);
    }
  };

  const onRemoveAttachment = async (a: HomeworkAssignment) => {
    const ok = await confirm({ title: 'Remove attachment?', confirmLabel: 'Remove' });
    if (!ok) return;
    setAttachmentBusyId(a.id);
    try {
      const updated = await deleteHomeworkAttachment(a.id);
      setAssignments((prev) => prev.map((x) => (x.id === a.id ? updated : x)));
      toast('Attachment removed.');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to remove attachment');
    } finally {
      setAttachmentBusyId(null);
    }
  };

  const onDownloadAttachment = async (a: HomeworkAssignment) => {
    if (!a.attachment) return;
    try {
      const blob = await downloadHomeworkAttachment(a.id);
      triggerBlobDownload(blob, a.attachment.fileName);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to download attachment');
    }
  };

  // ---- Submission tracking ----

  const toggleSubmissions = async (a: HomeworkAssignment) => {
    if (expandedSubmissionsId === a.id) {
      setExpandedSubmissionsId(null);
      return;
    }
    setExpandedSubmissionsId(a.id);
    setSubmissionsLoading(true);
    setSubmissionsError(null);
    try {
      const rows = await listHomeworkSubmissions(a.id);
      setSubmissions(rows);
      setRemarksDraft(Object.fromEntries(rows.map((r) => [r.student.id, r.remarks ?? ''])));
    } catch (err) {
      setSubmissionsError(err instanceof ApiError ? err.message : 'Failed to load submissions');
    } finally {
      setSubmissionsLoading(false);
    }
  };

  const onToggleSubmitted = async (assignmentId: number, row: HomeworkSubmission) => {
    const key = `${assignmentId}-${row.student.id}`;
    const nextSubmitted = !row.submitted;

    // Applied before the request so the checkbox responds on the same click
    // — a controlled checkbox that waits for the API would otherwise flash
    // back to its old state for a moment on every render before the
    // response arrives, since React re-renders with the stale prop first.
    setSubmissions((prev) =>
      prev.map((s) => (s.student.id === row.student.id ? { ...s, submitted: nextSubmitted } : s)),
    );
    setAssignments((prev) =>
      prev.map((a) =>
        a.id === assignmentId
          ? { ...a, submittedCount: a.submittedCount + (nextSubmitted ? 1 : -1) }
          : a,
      ),
    );

    setSavingSubmissionKey(key);
    try {
      const updated = await setHomeworkSubmission(assignmentId, row.student.id, {
        submitted: nextSubmitted,
        remarks: remarksDraft[row.student.id] || undefined,
      });
      setSubmissions((prev) => prev.map((s) => (s.student.id === row.student.id ? updated : s)));
    } catch (err) {
      // Roll back the optimistic update.
      setSubmissions((prev) => prev.map((s) => (s.student.id === row.student.id ? row : s)));
      setAssignments((prev) =>
        prev.map((a) =>
          a.id === assignmentId
            ? { ...a, submittedCount: a.submittedCount + (nextSubmitted ? -1 : 1) }
            : a,
        ),
      );
      setSubmissionsError(err instanceof ApiError ? err.message : 'Failed to update submission');
    } finally {
      setSavingSubmissionKey(null);
    }
  };

  const onSaveRemarks = async (assignmentId: number, row: HomeworkSubmission) => {
    const key = `${assignmentId}-${row.student.id}`;
    setSavingSubmissionKey(key);
    try {
      const updated = await setHomeworkSubmission(assignmentId, row.student.id, {
        submitted: row.submitted,
        remarks: remarksDraft[row.student.id] || undefined,
      });
      setSubmissions((prev) => prev.map((s) => (s.student.id === row.student.id ? updated : s)));
      toast('Remarks saved.');
    } catch (err) {
      setSubmissionsError(err instanceof ApiError ? err.message : 'Failed to save remarks');
    } finally {
      setSavingSubmissionKey(null);
    }
  };

  return (
    <>
      <div className="card-head">
        <h1>Assignments</h1>
        {isTeacher && (
          <Link to="/assignments/bulk-import">
            <button type="button" className="secondary">
              Bulk import
            </button>
          </Link>
        )}
      </div>
      <p className="subtitle">
        {isTeacher
          ? 'Homework you have set for your classes.'
          : 'All assignments set by teachers across the school.'}
      </p>

      {isTeacher && (
        <div className="card">
          {teachingOptions.length === 0 ? (
            <EmptyState
              title="No class assignments yet"
              message="Ask an admin to assign you to teach a class, section and subject before you can set homework."
            />
          ) : (
            <form className="card" onSubmit={(e) => void onCreate(e)}>
              <label className="field">
                <span>Class / Section / Subject</span>
                <select value={optionKey} onChange={(e) => setOptionKey(e.target.value)} required>
                  <option value="" disabled>
                    Select…
                  </option>
                  {teachingOptions.map((o) => (
                    <option key={optionKeyFor(o)} value={optionKeyFor(o)}>
                      {o.class.name} - {o.section.name} - {o.subject.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className="field">
                <span>Title</span>
                <input value={title} onChange={(e) => setTitle(e.target.value)} required />
              </label>

              <label className="field">
                <span>Due date</span>
                <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} required />
              </label>

              <label className="field">
                <span>Repeat weekly until (optional)</span>
                <input
                  type="date"
                  value={repeatWeeklyUntil}
                  onChange={(e) => setRepeatWeeklyUntil(e.target.value)}
                  min={dueDate || undefined}
                />
              </label>

              <label className="field">
                <span>Description (optional)</span>
                <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
              </label>

              <label className="field">
                <span>Attachment (optional)</span>
                <input ref={createFileInputRef} type="file" accept={ATTACHMENT_ACCEPT} onChange={onCreateFileChange} />
              </label>

              {createError && (
                <div className="status down">
                  <strong>Couldn't create assignment</strong>
                  <p>{createError}</p>
                </div>
              )}

              <div className="form-actions">
                <button type="submit" disabled={creating}>
                  {creating ? 'Creating…' : 'New assignment'}
                </button>
              </div>
            </form>
          )}
        </div>
      )}

      {!isTeacher && (
        <div className="filter-bar">
          <label className="field">
            <span>Academic year</span>
            <select
              value={yearId}
              onChange={(e) => {
                setYearId(e.target.value);
                setClassId('');
                setSectionId('');
                setPage(1);
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
                setPage(1);
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
            <select
              value={sectionId}
              onChange={(e) => {
                setSectionId(e.target.value);
                setPage(1);
              }}
              disabled={!classId}
            >
              <option value="">All sections</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </label>
        </div>
      )}

      {error && (
        <div className="status down">
          <strong>Error</strong>
          <p>{error}</p>
        </div>
      )}

      {loading ? (
        <TableSkeleton columns={isTeacher ? 7 : 7} />
      ) : assignments.length === 0 ? (
        <EmptyState
          title="No assignments found"
          message={isTeacher ? 'Set your first assignment above.' : 'Try clearing your filters.'}
        />
      ) : (
        <div className="card">
          <table className="data-table">
            <thead>
              <tr>
                <th>Title</th>
                <th>Class</th>
                <th>Section</th>
                <th>Subject</th>
                {!isTeacher && <th>Teacher</th>}
                <th>Due date</th>
                <th>Attachment</th>
                <th>Submissions</th>
                {isTeacher && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {assignments.map((a) => (
                <Fragment key={a.id}>
                  {editingId === a.id ? (
                    <tr>
                      <td data-label="Title">
                        <input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} />
                      </td>
                      <td data-label="Class">{a.class.name}</td>
                      <td data-label="Section">{a.section.name}</td>
                      <td data-label="Subject">{a.subject.name}</td>
                      <td data-label="Due date">
                        <input
                          type="date"
                          value={editDueDate}
                          onChange={(e) => setEditDueDate(e.target.value)}
                        />
                      </td>
                      <td data-label="Attachment">—</td>
                      <td data-label="Submissions">—</td>
                      <td data-label="Actions">
                        <div className="row-actions">
                          <button onClick={() => void saveEdit(a.id)} disabled={savingEdit}>
                            {savingEdit ? 'Saving…' : 'Save'}
                          </button>
                          <button className="secondary" onClick={() => setEditingId(null)}>
                            Cancel
                          </button>
                        </div>
                      </td>
                    </tr>
                  ) : (
                    <tr>
                      <td data-label="Title">
                        {a.title}
                        {a.seriesId && <span className="badge" style={{ marginLeft: '0.4rem' }}>weekly</span>}
                      </td>
                      <td data-label="Class">{a.class.name}</td>
                      <td data-label="Section">{a.section.name}</td>
                      <td data-label="Subject">{a.subject.name}</td>
                      {!isTeacher && <td data-label="Teacher">{a.teacher.name}</td>}
                      <td data-label="Due date">{formatDate(a.dueDate)}</td>
                      <td data-label="Attachment">
                        {a.attachment ? (
                          <div className="row-actions">
                            <button
                              type="button"
                              className="secondary"
                              onClick={() => void onDownloadAttachment(a)}
                              title={`${a.attachment.fileName} (${formatFileSize(a.attachment.size)})`}
                            >
                              {a.attachment.fileName.length > 18
                                ? `${a.attachment.fileName.slice(0, 15)}…`
                                : a.attachment.fileName}
                            </button>
                            {isTeacher && (
                              <button
                                type="button"
                                className="danger"
                                onClick={() => void onRemoveAttachment(a)}
                                disabled={attachmentBusyId === a.id}
                              >
                                Remove
                              </button>
                            )}
                          </div>
                        ) : isTeacher ? (
                          <label className="secondary" style={{ cursor: 'pointer' }}>
                            <input
                              type="file"
                              accept={ATTACHMENT_ACCEPT}
                              style={{ display: 'none' }}
                              onChange={(e) => void onRowFileChange(a, e)}
                              disabled={attachmentBusyId === a.id}
                            />
                            {attachmentBusyId === a.id ? 'Uploading…' : 'Attach file'}
                          </label>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td data-label="Submissions">
                        <button type="button" className="secondary" onClick={() => void toggleSubmissions(a)}>
                          {a.submittedCount}/{a.totalStudents}{' '}
                          {expandedSubmissionsId === a.id ? 'Hide' : 'View'}
                        </button>
                      </td>
                      {isTeacher && (
                        <td data-label="Actions">
                          <div className="row-actions">
                            <button className="secondary" onClick={() => startEdit(a)}>
                              Edit
                            </button>
                            <button
                              className="danger"
                              onClick={() => void onDelete(a)}
                              disabled={deletingId === a.id}
                            >
                              {deletingId === a.id ? 'Deleting…' : 'Delete'}
                            </button>
                          </div>
                        </td>
                      )}
                    </tr>
                  )}

                  {expandedSubmissionsId === a.id && (
                    <tr>
                      <td colSpan={isTeacher ? 8 : 7}>
                        {submissionsLoading ? (
                          <p className="muted">Loading submissions…</p>
                        ) : submissionsError ? (
                          <div className="status down">
                            <p>{submissionsError}</p>
                          </div>
                        ) : submissions.length === 0 ? (
                          <p className="muted">No students in this class and section.</p>
                        ) : (
                          <table className="data-table">
                            <thead>
                              <tr>
                                <th>Admission No.</th>
                                <th>Student</th>
                                <th>Submitted</th>
                                {isTeacher && <th>Remarks</th>}
                              </tr>
                            </thead>
                            <tbody>
                              {submissions.map((s) => {
                                const key = `${a.id}-${s.student.id}`;
                                return (
                                  <tr key={s.student.id}>
                                    <td data-label="Admission No.">{s.student.admissionNo ?? '—'}</td>
                                    <td data-label="Student">{s.student.name}</td>
                                    <td data-label="Submitted">
                                      {isTeacher ? (
                                        <input
                                          type="checkbox"
                                          checked={s.submitted}
                                          disabled={savingSubmissionKey === key}
                                          onChange={() => void onToggleSubmitted(a.id, s)}
                                        />
                                      ) : (
                                        <span
                                          className={`badge ${s.submitted ? 'status-badge-present' : 'status-badge-absent'}`}
                                        >
                                          {s.submitted ? 'Submitted' : 'Not submitted'}
                                        </span>
                                      )}
                                    </td>
                                    {isTeacher && (
                                      <td data-label="Remarks">
                                        <div className="row-actions">
                                          <input
                                            value={remarksDraft[s.student.id] ?? ''}
                                            onChange={(e) =>
                                              setRemarksDraft((prev) => ({
                                                ...prev,
                                                [s.student.id]: e.target.value,
                                              }))
                                            }
                                          />
                                          <button
                                            type="button"
                                            className="secondary"
                                            disabled={savingSubmissionKey === key}
                                            onClick={() => void onSaveRemarks(a.id, s)}
                                          >
                                            Save
                                          </button>
                                        </div>
                                      </td>
                                    )}
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        )}
                      </td>
                    </tr>
                  )}
                </Fragment>
              ))}
            </tbody>
          </table>
          <Pager page={page} pageSize={PAGE_SIZE} total={total} onPageChange={setPage} />
        </div>
      )}
    </>
  );
}
