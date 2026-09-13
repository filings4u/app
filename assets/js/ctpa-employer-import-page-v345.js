import { init, $, status, empty } from './ctpa-admin-common.js';
import { op } from './ctpa-ops.js';
import { esc } from './ctpa-management.js';

const d = await init('employer-import');

function csvCell(value = '') {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replaceAll('"', '""')}"` : text;
}

function downloadText(filename, text, type = 'text/csv;charset=utf-8') {
  const blob = new Blob([text], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

if (d) {
  const x = await op({ action: 'get', ctpa_id: d.ctpa.id });
  const imports = x.imports || [];
  const employers = d.employers || [];

  $('#content').innerHTML = `
    <div class="admin-inline-editor ctpa-import-panel">
      <div class="ctpa-editor-head">
        <div>
          <h3>Employer Spreadsheet Import</h3>
          <p>Upload a CSV to create or update Employer client accounts under this C/TPA. Each Employer remains an individual relational account linked to this C/TPA.</p>
        </div>
      </div>

      <div class="import-toolbar">
        <a class="btn btn-outline btn-compact" href="../templates/ctpa-employer-import-template.csv" download>Download CSV Template</a>
        <button class="btn btn-outline btn-compact" id="exportEmployers" type="button">Export Employer List</button>
      </div>

      <div class="file-upload-box ctpa-upload-box">
        <label for="file"><span>Employer CSV file</span></label>
        <input id="file" type="file" accept=".csv,text/csv">
        <small>Required column: <strong>legal_name</strong>. Supported columns: dba_name, dot_number, mc_number, state, primary_contact_name, primary_contact_email.</small>
      </div>

      <div class="saas-actions">
        <button class="btn btn-orange btn-compact" id="run" type="button">Upload & Import Employers</button>
      </div>
    </div>

    <h3 class="section-subhead">Import History</h3>
    <div class="management-table-wrap">
      <table class="management-table">
        <thead><tr><th>Date</th><th>File</th><th>Rows</th><th>Imported</th><th>Updated</th><th>Rejected</th></tr></thead>
        <tbody>${imports.length ? imports.map(i => `
          <tr>
            <td>${esc(new Date(i.uploaded_at).toLocaleString())}</td>
            <td>${esc(i.original_file_name)}</td>
            <td>${i.row_count ?? 0}</td>
            <td>${i.imported_count ?? 0}</td>
            <td>${i.updated_count ?? 0}</td>
            <td>${i.rejected_count ?? 0}</td>
          </tr>`).join('') : empty(6, 'No employer imports yet.')}</tbody>
      </table>
    </div>`;

  $('#exportEmployers').addEventListener('click', () => {
    const header = ['legal_name','dba_name','dot_number','mc_number','state','primary_contact_name','primary_contact_email','status'];
    const rows = employers.map(e => header.map(k => csvCell(e[k] ?? '')).join(','));
    downloadText(`ctpa-employers-${new Date().toISOString().slice(0,10)}.csv`, [header.join(','), ...rows].join('\n'));
  });

  $('#run').addEventListener('click', async () => {
    const f = $('#file').files?.[0];
    if (!f) {
      status('Choose a CSV file first.', 'error');
      return;
    }
    try {
      const csv = await f.text();
      const r = await op({ action: 'import_employers', ctpa_id: d.ctpa.id, file_name: f.name, csv });
      status(`Import complete: ${r.imported} imported, ${r.updated} updated, ${r.rejected} rejected.`, 'success');
      setTimeout(() => location.reload(), 800);
    } catch (e) {
      status(e.message, 'error');
    }
  });
}

