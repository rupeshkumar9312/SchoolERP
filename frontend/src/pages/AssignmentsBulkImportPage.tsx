import { useRef, useState, type ChangeEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ApiError } from '../api/client';
import {
  bulkImportHomeworkAssignments,
  downloadHomeworkImportTemplate,
  type HomeworkBulkImportResult,
} from '../api/homework';
import { base64ToBlob, triggerBlobDownload } from '../api/students';
import { useToast } from '../components/useToast';

export function AssignmentsBulkImportPage() {
  const navigate = useNavigate();
  const toast = useToast();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<HomeworkBulkImportResult | null>(null);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    setFile(e.target.files?.[0] ?? null);
    setResult(null);
    setError(null);
  };

  const onUpload = async () => {
    if (!file) return;
    setUploading(true);
    setError(null);
    try {
      const res = await bulkImportHomeworkAssignments(file);
      setResult(res);
      if (res.failureCount === 0) {
        toast(`${res.successCount} assignment${res.successCount === 1 ? '' : 's'} created successfully.`);
      }
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Failed to import assignments');
    } finally {
      setUploading(false);
    }
  };

  const onDownloadTemplate = async () => {
    setDownloadingTemplate(true);
    try {
      const blob = await downloadHomeworkImportTemplate();
      triggerBlobDownload(blob, 'assignment-import-template.xlsx');
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
    triggerBlobDownload(blob, 'assignment-import-failures.xlsx');
  };

  return (
    <>
      <div className="card-head">
        <h1>Bulk import assignments</h1>
        <Link to="/assignments">
          <button type="button" className="secondary">
            Back to assignments
          </button>
        </Link>
      </div>
      <p className="subtitle">
        Upload an .xlsx file to set many assignments at once. Class, Section and Subject are matched by
        name against the current academic year — you must already be assigned to teach each one.
      </p>

      <section className="card">
        <div className="card-head">
          <h2>1. Get the template</h2>
        </div>
        <p className="muted">Download the template to see the expected columns and formats.</p>
        <button
          type="button"
          className="secondary"
          onClick={() => void onDownloadTemplate()}
          disabled={downloadingTemplate}
        >
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
            {uploading ? 'Importing…' : 'Import assignments'}
          </button>
        </div>
      </section>

      {result && (
        <section className="card">
          <div className="card-head">
            <h2>Import summary</h2>
          </div>

          <div className="filter-bar">
            <span className="badge">{result.totalRows} rows read</span>
            <span className="badge status-badge-present">{result.successCount} created</span>
            {result.failureCount > 0 && (
              <span className="badge status-badge-absent">{result.failureCount} failed</span>
            )}
          </div>

          {result.failureCount > 0 && (
            <>
              <p className="muted">
                Some rows could not be imported. Download the failed rows below, fix the issues, and
                re-upload just those rows.
              </p>
              <button type="button" className="danger" onClick={onDownloadFailures}>
                Download failed rows ({result.failureCount})
              </button>

              <div className="card" style={{ marginTop: '1rem' }}>
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Row</th>
                      <th>Title</th>
                      <th>Error</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.failures.map((f) => (
                      <tr key={f.row}>
                        <td data-label="Row">{f.row}</td>
                        <td data-label="Title">{f.title || '—'}</td>
                        <td data-label="Error">{f.error}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </>
          )}

          <div className="form-actions">
            <button type="button" onClick={() => navigate('/assignments')}>
              Go to assignments list
            </button>
          </div>
        </section>
      )}
    </>
  );
}
