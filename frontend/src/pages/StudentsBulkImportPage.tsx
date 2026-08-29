import { useEffect, useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  base64ToBlob,
  bulkImportStudents,
  downloadStudentImportTemplate,
  triggerBlobDownload,
  type BulkImportResult,
} from '../api/students';
import { ApiError } from '../api/client';
import { useToast } from '../components/useToast';

// A large file can legitimately take a while (each row is its own DB
// round trip server-side) — past this, a failure is more likely a
// timed-out request than "the API is unreachable," even though the
// browser reports both identically. Surfacing that distinction is the
// difference between a useless error and an actionable one.
const SLOW_IMPORT_HINT_SECONDS = 15;

function buildUploadErrorMessage(err: unknown, elapsedSec: number): string {
  if (err instanceof ApiError) {
    // A response came back (even an error one) — its message is already
    // specific, no need to guess further.
    if (err.status !== undefined) return err.message;
    const hint =
      elapsedSec > SLOW_IMPORT_HINT_SECONDS
        ? ` The request ran for ${elapsedSec}s before failing — that usually means the file is too large for one import (each row is its own database write) and the request timed out, not that the server is down. Try splitting it into smaller batches, e.g. 100 rows at a time.`
        : '';
    return `${err.message}${hint}`;
  }
  return 'Failed to import students — an unexpected error occurred. Check the server logs for details.';
}

export function StudentsBulkImportPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<BulkImportResult | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  // Ticks a visible "Importing… 23s elapsed" while the request is in
  // flight — a large import can take a genuinely long time server-side,
  // and a static "Importing…" with no movement for a minute-plus reads as
  // frozen even when it's still working.
  useEffect(() => {
    if (!uploading) return;
    const startedAt = Date.now();
    const timer = setInterval(() => setElapsedSec(Math.round((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(timer);
  }, [uploading]);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setResult(null);
    setError(null);
  };

  const onUpload = async () => {
    if (!file) return;
    setUploading(true);
    setElapsedSec(0);
    setError(null);
    const startedAt = Date.now();
    try {
      const res = await bulkImportStudents(file);
      setResult(res);
      if (res.failureCount === 0) {
        toast(`${res.successCount} student${res.successCount === 1 ? '' : 's'} imported successfully.`);
      }
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(buildUploadErrorMessage(err, Math.round((Date.now() - startedAt) / 1000)));
    } finally {
      setUploading(false);
    }
  };

  const onDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await downloadStudentImportTemplate();
      triggerBlobDownload(blob, 'student-import-template.xlsx');
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to download template');
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const onDownloadFailures = () => {
    if (!result?.failuresWorkbookBase64) return;
    const blob = base64ToBlob(
      result.failuresWorkbookBase64,
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    );
    triggerBlobDownload(blob, 'student-import-failures.xlsx');
  };

  return (
    <>
      <div className="card-head">
        <h1>Bulk import students</h1>
        <Link to="/students">
          <button type="button" className="secondary">
            Back to students
          </button>
        </Link>
      </div>
      <p className="subtitle">
        Upload an .xlsx file to admit many students at once. Class and Section are matched by name against the
        current academic year.
      </p>

      <section className="card">
        <div className="card-head">
          <h2>1. Get the template</h2>
        </div>
        <p className="muted">Download the template to see the expected columns and formats.</p>
        <button type="button" className="secondary" onClick={() => void onDownloadTemplate()} disabled={downloadingTemplate}>
          {downloadingTemplate ? 'Downloading…' : 'Download template'}
        </button>
      </section>

      <section className="card">
        <div className="card-head">
          <h2>2. Upload your file</h2>
        </div>
        <label className="field">
          <span>Excel file (.xlsx)</span>
          <input ref={fileInputRef} type="file" accept=".xlsx" onChange={onFileChange} />
        </label>

        {error && (
          <div className="status down">
            <strong>Import failed</strong>
            <p>{error}</p>
          </div>
        )}

        <div className="form-actions">
          <button type="button" onClick={() => void onUpload()} disabled={!file || uploading}>
            {uploading ? `Importing… ${elapsedSec}s elapsed` : 'Import students'}
          </button>
        </div>
        {uploading && elapsedSec > SLOW_IMPORT_HINT_SECONDS && (
          <p className="muted">
            Still going — large files take longer since each row is its own database write. Keep this tab open.
          </p>
        )}
      </section>

      {result && (
        <section className="card">
          <div className="card-head">
            <h2>Import summary</h2>
          </div>

          <div className="filter-bar">
            <span className="badge">{result.totalRows} rows read</span>
            <span className="badge status-badge-present">{result.successCount} imported</span>
            {result.failureCount > 0 && (
              <span className="badge status-badge-absent">{result.failureCount} failed</span>
            )}
          </div>

          {result.failureCount > 0 && (
            <>
              <p className="muted">
                Some rows could not be imported. Download the failed rows below, fix the issues, and re-upload just
                those rows.
              </p>
              <button type="button" className="danger" onClick={onDownloadFailures}>
                Download failed rows ({result.failureCount})
              </button>

              <div className="card" style={{ marginTop: '1rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Admission No.</th>
                      <th>Name</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.failures.map((f) => (
                      <tr key={f.row}>
                        <td data-label="Row">{f.row}</td>
                        <td data-label="Admission No.">{f.admissionNo || '—'}</td>
                        <td data-label="Name">{f.name || '—'}</td>
                        <td data-label="Error">{f.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="form-actions">
            <button type="button" onClick={() => navigate('/students')}>
              Go to students list
            </button>
          </div>
        </section>
      )}
    </>
  );
}
