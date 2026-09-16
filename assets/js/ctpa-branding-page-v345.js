import { portalReady } from './portal.js?v=20260916-admin-loadfix2';
await portalReady;
import { init, $, status } from './ctpa-admin-common.js';
import { op } from './ctpa-ops.js';

const d = await init('branding');
if (d) {
  const response = await op({ action: 'get', ctpa_id: d.ctpa.id });
  const branding = response.branding || {};
  const whiteLabel = Boolean(d.plan_features?.find(x => x.feature_catalog?.code === 'white_label')?.enabled || d.overrides?.find(x => x.feature_catalog?.code === 'white_label')?.enabled);
  $('#content').innerHTML = `
    <div class="saas-notice"><strong>Plan control:</strong> You can store a logo and branding draft for any C/TPA. It becomes customer-facing only when White Label is enabled by the plan or an Admin override. The font remains Inter.</div>
    <div class="admin-inline-editor">
      <h3>Portal Branding</h3>
      <div class="saas-form-grid">
        <label><span>C/TPA Logo</span><input id="logoFile" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml"><small>PNG, JPG, WEBP, or SVG. Maximum 5 MB.</small></label>
        <label><span>Portal name</span><input id="portalName" value="${branding.portal_name || ''}"></label>
        <label><span>Primary color</span><input id="primary" type="color" value="${branding.primary_color || '#24467f'}"></label>
        <label><span>Accent color</span><input id="accent" type="color" value="${branding.accent_color || '#ff6b00'}"></label>
      </div>
      <div id="logoPreview" style="margin-top:18px">${branding.logo_path ? `<img src="${branding.logo_path}" alt="C/TPA logo" style="max-width:240px;max-height:90px;object-fit:contain">` : '<span class="management-empty">No C/TPA logo uploaded.</span>'}</div>
      <div id="pageStatus" class="inline-status" style="margin-top:14px"></div>
      <div class="saas-actions"><button class="btn btn-orange" id="save">Save Branding</button></div>
    </div>`;

  let logoPath = branding.logo_path || null;
  $('#logoFile').addEventListener('change', async event => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { status('Logo must be 5 MB or smaller.', 'error'); return; }
    try {
      status('Uploading logo…');
      const base64 = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(String(reader.result));
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      const uploaded = await op({ action: 'upload_logo', ctpa_id: d.ctpa.id, mime_type: file.type, base64 });
      logoPath = uploaded.url;
      $('#logoPreview').innerHTML = `<img src="${uploaded.url}" alt="C/TPA logo" style="max-width:240px;max-height:90px;object-fit:contain">`;
      status('Logo uploaded. Save Branding to keep the full branding configuration.', 'success');
    } catch (error) { status(error.message, 'error'); }
  });

  $('#save').addEventListener('click', async () => {
    try {
      const saved = await op({ action: 'save_branding', ctpa_id: d.ctpa.id, logo_path: logoPath, portal_name: $('#portalName').value, primary_color: $('#primary').value, accent_color: $('#accent').value });
      status(saved.message || (whiteLabel ? 'C/TPA branding saved.' : 'Branding draft saved.'), 'success');
    } catch (error) { status(error.message, 'error'); }
  });
}

