import { useEffect, useState, type FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import * as academic from '../api/academic';
import { ApiError } from '../api/client';
import { createStudent, getStudent, updateStudent } from '../api/students';
import { shareCredentialsViaWhatsApp } from '../utils/whatsapp';

export function StudentFormPage() {
  const { id } = useParams();
  const isEdit = Boolean(id);
  const navigate = useNavigate();

  const [years, setYears] = useState<academic.AcademicYear[]>([]);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [sections, setSections] = useState<academic.Section[]>([]);

  const [admissionNo, setAdmissionNo] = useState('');
  const [aadharNumber, setAadharNumber] = useState('');
  const [name, setName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('');
  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [guardianName, setGuardianName] = useState('');
  const [guardianPhone, setGuardianPhone] = useState('');
  const [guardianEmail, setGuardianEmail] = useState('');
  const [address, setAddress] = useState('');
  const [admissionDate, setAdmissionDate] = useState('');
  const [isActive, setIsActive] = useState(true);

  const [loading, setLoading] = useState(isEdit);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createdLogin, setCreatedLogin] = useState<{ email: string; alias: string; temporaryPassword: string } | null>(null);

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

  // Preload the year/class chain for an existing student so the cascading
  // selects resolve to the right academic year even though the API only
  // stores classId/sectionId.
  useEffect(() => {
    if (!id) return;
    setLoading(true);
    getStudent(Number(id))
      .then(async (student) => {
        setAdmissionNo(student.admissionNo ?? '');
        setAadharNumber(student.aadharNumber ?? '');
        setName(student.name);
        setDateOfBirth(student.dateOfBirth?.slice(0, 10) ?? '');
        setGender(student.gender ?? '');
        setGuardianName(student.guardianName ?? '');
        setGuardianPhone(student.guardianPhone ?? '');
        setGuardianEmail(student.guardianEmail ?? '');
        setAddress(student.address ?? '');
        setAdmissionDate(student.admissionDate.slice(0, 10));
        setIsActive(student.isActive);

        const allYears = await academic.listAcademicYears();
        for (const year of allYears) {
          const yearClasses = await academic.listClasses(year.id);
          if (yearClasses.some((c) => c.id === student.class.id)) {
            setYearId(String(year.id));
            setClasses(yearClasses);
            break;
          }
        }
        setClassId(String(student.class.id));
        setSectionId(String(student.section.id));
      })
      .catch((err) => setError(err instanceof ApiError ? err.message : 'Failed to load student'))
      .finally(() => setLoading(false));
  }, [id]);

  const onSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const payload = {
        admissionNo: admissionNo.trim() || undefined,
        aadharNumber: aadharNumber.trim() || undefined,
        name,
        dateOfBirth: dateOfBirth || undefined,
        gender: gender || undefined,
        classId: Number(classId),
        sectionId: Number(sectionId),
        guardianName: guardianName || undefined,
        guardianPhone: guardianPhone || undefined,
        guardianEmail: guardianEmail || undefined,
        address: address || undefined,
        admissionDate: admissionDate || undefined,
      };
      if (isEdit) {
        await updateStudent(Number(id), { ...payload, isActive });
        navigate('/students');
      } else {
        const created = await createStudent(payload);
        setCreatedLogin(created.login);
      }
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to save student');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <p className="muted">Loading…</p>;

  if (createdLogin) {
    return (
      <>
        <h1>Student admitted</h1>
        <div className="card">
          <p>
            A portal login was created automatically. Copy these credentials now — the password
            can't be shown again after you leave this page.
          </p>
          <label className="field">
            <span>Login email</span>
            <input value={createdLogin.email} readOnly onFocus={(e) => e.target.select()} />
          </label>
          <label className="field">
            <span>Short login ID (use this to sign in instead)</span>
            <input value={createdLogin.alias} readOnly onFocus={(e) => e.target.select()} />
          </label>
          <label className="field">
            <span>Temporary password</span>
            <input
              value={createdLogin.temporaryPassword}
              readOnly
              onFocus={(e) => e.target.select()}
            />
          </label>
          <div className="form-actions">
            <button
              type="button"
              className="secondary"
              onClick={() =>
                shareCredentialsViaWhatsApp({
                  name,
                  loginId: createdLogin.alias,
                  password: createdLogin.temporaryPassword,
                })
              }
            >
              Share via WhatsApp
            </button>
            <button type="button" onClick={() => navigate('/students')}>
              Done
            </button>
          </div>
        </div>
      </>
    );
  }

  return (
    <>
      <h1>{isEdit ? 'Edit student' : 'Admit student'}</h1>

      <form className="card" onSubmit={onSubmit}>
        <label className="field">
          <span>Admission number</span>
          <input value={admissionNo} onChange={(e) => setAdmissionNo(e.target.value)} />
        </label>

        <label className="field">
          <span>Aadhar number</span>
          <input value={aadharNumber} onChange={(e) => setAadharNumber(e.target.value)} />
        </label>

        <label className="field">
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} required />
        </label>

        <label className="field">
          <span>Date of birth</span>
          <input type="date" value={dateOfBirth} onChange={(e) => setDateOfBirth(e.target.value)} />
        </label>

        <label className="field">
          <span>Gender</span>
          <select value={gender} onChange={(e) => setGender(e.target.value)}>
            <option value="">Prefer not to say</option>
            <option value="Male">Male</option>
            <option value="Female">Female</option>
            <option value="Other">Other</option>
          </select>
        </label>

        <label className="field">
          <span>Academic year</span>
          <select
            value={yearId}
            onChange={(e) => {
              setYearId(e.target.value);
              setClassId('');
              setSectionId('');
            }}
            required
          >
            <option value="" disabled>
              Select a year
            </option>
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
            required
          >
            <option value="" disabled>
              Select a class
            </option>
            {classes.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Section</span>
          <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} disabled={!classId} required>
            <option value="" disabled>
              Select a section
            </option>
            {sections.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </label>

        <label className="field">
          <span>Admission date</span>
          <input type="date" value={admissionDate} onChange={(e) => setAdmissionDate(e.target.value)} />
        </label>

        <label className="field">
          <span>Guardian name</span>
          <input value={guardianName} onChange={(e) => setGuardianName(e.target.value)} />
        </label>

        <label className="field">
          <span>Guardian phone</span>
          <input value={guardianPhone} onChange={(e) => setGuardianPhone(e.target.value)} />
        </label>

        <label className="field">
          <span>Guardian email</span>
          <input type="email" value={guardianEmail} onChange={(e) => setGuardianEmail(e.target.value)} />
        </label>

        <label className="field">
          <span>Address</span>
          <input value={address} onChange={(e) => setAddress(e.target.value)} />
        </label>

        {isEdit && (
          <label className="field field-checkbox">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)} />
            <span>Active</span>
          </label>
        )}

        {error && (
          <div className="status down">
            <strong>Couldn't save</strong>
            <p>{error}</p>
          </div>
        )}

        <div className="form-actions">
          <button type="submit" disabled={submitting}>
            {submitting ? 'Saving…' : 'Save'}
          </button>
          <button type="button" className="secondary" onClick={() => navigate('/students')}>
            Cancel
          </button>
        </div>
      </form>
    </>
  );
}
