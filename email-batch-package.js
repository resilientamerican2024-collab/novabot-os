// email-batch-package.js
// Sends Ingrid one review email with ALL Week 3 + Week 4 content.
// Every slot: full caption, all 10 hashtags, all 5 panel images + descriptions, reel link.
// Nothing goes live until she approves manually.
//
// Usage:
//   node email-batch-package.js tannie_batch_results.json

const fs = require('fs');
const https = require('https');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = process.env.TO_EMAIL || 'admin@novaverseplatform.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

function buildPanelRow(panel) {
  const imgTag = (panel.imgbb_url && !panel.error)
    ? `<img src="${panel.imgbb_url}" alt="Panel ${panel.panel_number}"
           style="width:100%;max-width:320px;border-radius:6px;display:block;margin:0 auto;" />`
    : `<div style="width:100%;max-width:320px;height:180px;background:#f0e6d3;border-radius:6px;
                  display:flex;align-items:center;justify-content:center;margin:0 auto;
                  font-size:12px;color:#999;text-align:center;">
         ${panel.error ? '❌ Generation failed' : 'No image'}
       </div>`;

  return `
    <div style="margin-bottom:24px;padding-bottom:24px;border-bottom:1px solid #f0e6d3;">
      <p style="margin:0 0 6px;font-weight:bold;color:#8B0000;font-size:13px;font-family:Georgia,serif;">
        Panel ${panel.panel_number} — <em style="font-weight:normal;">${panel.emotion || ''}</em>
      </p>
      ${imgTag}
      <p style="margin:10px 0 0;font-size:12px;color:#666;line-height:1.6;font-family:Georgia,serif;">
        ${panel.scene || ''}
      </p>
      ${panel.error ? `<p style="margin:6px 0 0;font-size:11px;color:#c00;">Error: ${panel.error}</p>` : ''}
    </div>`;
}

function buildSlotCard(slotResult, calendar) {
  const slotData = calendar.posts.find(p => p.slot === slotResult.slot);
  if (!slotData) return '';

  const panels = (slotResult.panels && slotResult.panels.panels) || [];
  const reelUrl = slotResult.reel && !slotResult.reel.error
    ? (slotResult.reel.reel_url || slotResult.reel.local_path)
    : null;

  const panelHtml = panels.length > 0
    ? panels.map(buildPanelRow).join('')
    : '<p style="color:#aaa;font-style:italic;font-size:12px;">No panels generated.</p>';

  const reelSection = reelUrl
    ? `<div style="text-align:center;margin:20px 0;">
         <a href="${reelUrl}"
            style="display:inline-block;background:#8B0000;color:#fff;text-decoration:none;
                   padding:12px 28px;border-radius:8px;font-size:14px;font-family:Georgia,serif;
                   font-weight:bold;">
           ▶ Watch Reel (40s)
         </a>
       </div>`
    : (slotResult.reel && slotResult.reel.error
        ? `<p style="color:#c00;font-size:12px;margin:10px 0;">⚠️ Reel failed: ${slotResult.reel.error}</p>`
        : '');

  const okCount = panels.filter(p => !p.error).length;
  const statusColor = okCount === 5 ? '#2a7a2a' : okCount > 0 ? '#b36b00' : '#c00';
  const statusText = okCount === 5 ? '5/5 panels ✓' : `${okCount}/5 panels`;

  return `
  <div style="background:#fff;border-radius:12px;border:2px solid #f0e6d3;
              margin-bottom:40px;overflow:hidden;">

    <!-- Slot Header -->
    <div style="background:#8B0000;padding:16px 20px;display:flex;align-items:center;justify-content:space-between;">
      <div>
        <span style="color:#fff;font-size:17px;font-weight:bold;font-family:Georgia,serif;">
          ${slotResult.slot}
        </span>
        <span style="color:#f5c0c0;font-size:13px;margin-left:12px;font-family:Georgia,serif;">
          ${slotData.date} · ${slotData.time_est} EST
        </span>
      </div>
      <span style="color:#fff;font-size:12px;font-family:monospace;opacity:0.85;">
        ${statusText}
      </span>
    </div>

    <div style="padding:20px;">

      <!-- Theme -->
      <p style="margin:0 0 16px;font-size:15px;color:#555;font-style:italic;font-family:Georgia,serif;">
        ${slotData.theme}
      </p>

      <!-- Caption — full, not collapsed -->
      <div style="background:#FFFAEC;border-radius:8px;padding:16px;margin-bottom:16px;border:1px solid #e8dcc8;">
        <p style="margin:0 0 8px;font-size:12px;font-weight:bold;color:#8B0000;
                  text-transform:uppercase;letter-spacing:0.05em;font-family:Georgia,serif;">
          Caption
        </p>
        <div style="font-size:14px;line-height:1.8;color:#333;white-space:pre-line;font-family:Georgia,serif;">
${slotData.caption}
        </div>
      </div>

      <!-- Hashtags — all 10 -->
      <div style="background:#f9f7f4;border-radius:8px;padding:12px 16px;margin-bottom:20px;border:1px solid #eee;">
        <p style="margin:0 0 6px;font-size:12px;font-weight:bold;color:#8B0000;
                  text-transform:uppercase;letter-spacing:0.05em;font-family:Georgia,serif;">
          Hashtags
        </p>
        <p style="margin:0;font-size:13px;color:#666;line-height:2;font-family:monospace;">
          ${slotData.hashtags}
        </p>
      </div>

      <!-- Reel button -->
      ${reelSection}

      <!-- All 5 Panels -->
      <div style="border-top:2px solid #f0e6d3;padding-top:16px;margin-top:4px;">
        <p style="margin:0 0 16px;font-size:12px;font-weight:bold;color:#8B0000;
                  text-transform:uppercase;letter-spacing:0.05em;font-family:Georgia,serif;">
          Generated Panels (${okCount}/5)
        </p>
        ${panelHtml}
      </div>

    </div>
  </div>`;
}

function buildBatchHTML(batchData, calendar) {
  const slots = batchData.slots || [];
  const totalOk = slots.filter(s => s.panels && !s.panels.error).length;
  const reelOk = slots.filter(s => s.reel && !s.reel.error).length;

  const slotCards = slots.map(s => buildSlotCard(s, calendar)).join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tannie Talks — Batch Review Package</title>
</head>
<body style="margin:0;padding:0;background:#FFFAEC;font-family:Georgia,serif;color:#333;">
<div style="max-width:680px;margin:0 auto;padding:32px 16px;">

  <!-- Header -->
  <div style="border-left:5px solid #8B0000;padding-left:16px;margin-bottom:32px;">
    <h1 style="margin:0 0 4px;color:#8B0000;font-size:24px;">Tannie Talks</h1>
    <p style="margin:0;color:#999;font-size:13px;">
      Week 3 Catch-Up + Week 4 · Batch Content Review
    </p>
  </div>

  <!-- Approval Notice -->
  <div style="background:#fff3f3;border:1px solid #f5c6c6;border-radius:10px;padding:16px;margin-bottom:28px;">
    <p style="margin:0;font-size:15px;color:#8B0000;font-weight:bold;">
      ⚠️ Nothing has been posted.
    </p>
    <p style="margin:8px 0 0;font-size:13px;color:#555;">
      Review every slot below. Post manually when ready — or reply to request changes.
    </p>
    <p style="margin:8px 0 0;font-size:13px;color:#555;">
      Generated: <strong>${new Date(batchData.generated_at || Date.now()).toLocaleString('en-US', { timeZone: 'America/New_York' })} EST</strong>
    </p>
  </div>

  <!-- Summary Stats -->
  <div style="display:flex;gap:12px;margin-bottom:32px;flex-wrap:wrap;">
    <div style="flex:1;min-width:140px;background:#fff;border-radius:10px;padding:16px;
                border:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:28px;font-weight:bold;color:#8B0000;">${slots.length}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.05em;">Total Slots</p>
    </div>
    <div style="flex:1;min-width:140px;background:#fff;border-radius:10px;padding:16px;
                border:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:28px;font-weight:bold;color:#2a7a2a;">${totalOk}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.05em;">Panels Ready</p>
    </div>
    <div style="flex:1;min-width:140px;background:#fff;border-radius:10px;padding:16px;
                border:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:28px;font-weight:bold;color:#2a7a2a;">${reelOk}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.05em;">Reels Ready</p>
    </div>
    <div style="flex:1;min-width:140px;background:#fff;border-radius:10px;padding:16px;
                border:1px solid #eee;text-align:center;">
      <p style="margin:0;font-size:28px;font-weight:bold;color:#555;">${slots.length * 5}</p>
      <p style="margin:4px 0 0;font-size:12px;color:#999;text-transform:uppercase;letter-spacing:0.05em;">Total Panels</p>
    </div>
  </div>

  <!-- All Slot Cards -->
  ${slotCards}

  <!-- Footer -->
  <div style="margin-top:48px;padding-top:24px;border-top:1px solid #e0d5c5;text-align:center;">
    <p style="margin:0;font-size:12px;color:#bbb;font-style:italic;line-height:2;">
      Every image. Every color. Every caption.<br>
      All of it honors Kassandra.<br>
      In memory. In love. In faith. 🌹
    </p>
  </div>

</div>
</body>
</html>`;
}

async function sendBatchPackage(batchFile) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');

  const batchData = JSON.parse(fs.readFileSync(batchFile, 'utf8'));
  const calendar = JSON.parse(fs.readFileSync('./content-calendar.json', 'utf8'));

  const html = buildBatchHTML(batchData, calendar);
  const slotCount = (batchData.slots || []).length;
  const subject = `🌹 Tannie Talks — Batch Review: ${slotCount} Slots Ready (W3 + W4)`;

  const body = JSON.stringify({
    from: FROM_EMAIL,
    to: [TO_EMAIL],
    subject,
    html,
  });

  console.log(`📧 Sending batch review (${slotCount} slots) to ${TO_EMAIL}...`);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.resend.com',
      path: '/emails',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.id) {
            console.log(`✅ Batch email sent — ID: ${parsed.id}`);
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || JSON.stringify(parsed)));
          }
        } catch (e) {
          reject(new Error(`Parse error: ${e.message} — raw: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

if (require.main === module) {
  const batchFile = process.argv[2] || 'tannie_batch_results.json';
  if (!fs.existsSync(batchFile)) {
    console.error(`❌ File not found: ${batchFile}`);
    process.exit(1);
  }
  sendBatchPackage(batchFile).catch(err => {
    console.error('❌', err.message);
    process.exit(1);
  });
}

module.exports = { sendBatchPackage };
