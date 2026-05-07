// email-weekly-package.js
// Sends Ingrid a content review package via Resend before anything posts.
// Nothing goes live until she approves manually.
//
// Usage:
//   node email-weekly-package.js WED-AM tannie_wed_am_results.json

const fs = require('fs');
const https = require('https');

const RESEND_API_KEY = process.env.RESEND_API_KEY;
const TO_EMAIL = process.env.TO_EMAIL || 'admin@novaverseplatform.com';
const FROM_EMAIL = process.env.FROM_EMAIL || 'onboarding@resend.dev';

function buildHTML(slot, slotData, panels, reelUrl) {
  const panelCards = panels
    .filter(p => !p.error && p.imgbb_url)
    .map(p => `
      <div style="margin-bottom:24px; background:#fff; border-radius:10px; padding:16px; border:1px solid #f0e6d3;">
        <p style="margin:0 0 8px; font-weight:bold; color:#8B0000; font-size:14px;">
          Panel ${p.panel_number}
        </p>
        <img src="${p.imgbb_url}"
             alt="Panel ${p.panel_number}"
             style="width:100%; max-width:360px; border-radius:8px; display:block;" />
        <p style="margin:8px 0 0; font-size:12px; color:#888; font-style:italic;">
          ${p.scene.slice(0, 120)}...
        </p>
      </div>
    `).join('');

  const errorWarnings = panels
    .filter(p => p.error)
    .map(p => `<li>Panel ${p.panel_number}: ${p.error}</li>`)
    .join('');

  const reelSection = reelUrl ? `
    <div style="background:#fff; border-radius:10px; padding:20px; margin-bottom:20px; border:1px solid #eee;">
      <h2 style="margin:0 0 12px; color:#8B0000; font-size:16px;">🎬 Reel (40-second MP4)</h2>
      <p style="margin:0 0 12px; font-size:13px; color:#555;">
        Ken Burns zoom/pan on all 5 panels. Ready for Instagram Reels and Facebook.
      </p>
      <a href="${reelUrl}"
         style="display:inline-block; background:#8B0000; color:#fff; text-decoration:none;
                padding:12px 24px; border-radius:8px; font-size:14px; font-weight:bold;">
        ▶ View / Download Reel
      </a>
      <p style="margin:12px 0 0; font-size:11px; color:#aaa; word-break:break-all;">${reelUrl}</p>
    </div>
  ` : `
    <div style="background:#fff3f3; border-radius:10px; padding:16px; margin-bottom:20px; border:1px solid #f5c6c6;">
      <p style="margin:0; font-size:13px; color:#c00;">⚠️ Reel could not be generated or uploaded this run.</p>
    </div>
  `;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Tannie Talks — ${slot} Review</title>
</head>
<body style="margin:0; padding:0; background:#FFFAEC; font-family:Georgia,serif; color:#333;">
  <div style="max-width:600px; margin:0 auto; padding:32px 20px;">

    <!-- Header -->
    <div style="border-left:5px solid #8B0000; padding-left:16px; margin-bottom:32px;">
      <h1 style="margin:0 0 4px; color:#8B0000; font-size:22px;">Tannie Talks</h1>
      <p style="margin:0; color:#999; font-size:13px;">Week 3 · ${slot} · Content Review Package</p>
    </div>

    <!-- Approval notice -->
    <div style="background:#fff3f3; border:1px solid #f5c6c6; border-radius:10px; padding:16px; margin-bottom:28px;">
      <p style="margin:0; font-size:14px; color:#8B0000; font-weight:bold;">
        ⚠️ Nothing has been posted.
      </p>
      <p style="margin:8px 0 0; font-size:13px; color:#555;">
        Review the carousel panels and reel below — one approval covers both.
        Post manually when ready, or reply to this email to request changes.
      </p>
      <p style="margin:8px 0 0; font-size:13px; color:#555;">
        Scheduled time: <strong>${slotData.time_est} EST on ${slotData.date}</strong>
      </p>
    </div>

    <!-- Caption -->
    <div style="background:#fff; border-radius:10px; padding:20px; margin-bottom:20px; border:1px solid #eee;">
      <h2 style="margin:0 0 14px; color:#8B0000; font-size:16px;">📝 Caption</h2>
      <div style="background:#f9f7f4; border-radius:8px; padding:16px;
                  white-space:pre-line; font-size:15px; line-height:1.7; color:#333;">
${slotData.caption}
      </div>
    </div>

    <!-- Hashtags -->
    <div style="background:#fff; border-radius:10px; padding:20px; margin-bottom:20px; border:1px solid #eee;">
      <h2 style="margin:0 0 12px; color:#8B0000; font-size:16px;">#️⃣ Hashtags</h2>
      <p style="margin:0; font-size:13px; color:#555; line-height:2;">
        ${slotData.hashtags}
      </p>
    </div>

    <!-- Reel -->
    ${reelSection}

    <!-- Carousel Panels -->
    <div style="background:#fff; border-radius:10px; padding:20px; margin-bottom:20px; border:1px solid #eee;">
      <h2 style="margin:0 0 16px; color:#8B0000; font-size:16px;">🖼️ Carousel Panels (${panels.filter(p => !p.error).length}/5)</h2>
      ${panelCards || '<p style="color:#aaa; font-style:italic;">No panels generated yet.</p>'}
      ${errorWarnings ? `<div style="margin-top:16px; background:#fff3f3; border-radius:8px; padding:12px;">
        <p style="margin:0 0 8px; color:#c00; font-size:13px; font-weight:bold;">Panels with errors:</p>
        <ul style="margin:0; color:#c00; font-size:13px;">${errorWarnings}</ul>
      </div>` : ''}
    </div>

    <!-- Memorial footer -->
    <div style="margin-top:40px; padding-top:20px; border-top:1px solid #e0d5c5; text-align:center;">
      <p style="margin:0; font-size:12px; color:#bbb; font-style:italic; line-height:1.8;">
        Every image. Every color. Every caption.<br>
        All of it honors Kassandra.<br>
        In memory. In love. In faith.
      </p>
    </div>

  </div>
</body>
</html>`;
}

async function sendWeeklyPackage(slot, resultsFile) {
  if (!RESEND_API_KEY) throw new Error('RESEND_API_KEY not set');

  const calendar = JSON.parse(fs.readFileSync('./content-calendar.json', 'utf8'));
  const slotData = calendar.posts.find(p => p.slot === slot);
  if (!slotData) throw new Error(`Slot "${slot}" not found in content-calendar.json`);

  let panels = [];
  let reelUrl = null;
  if (resultsFile && fs.existsSync(resultsFile)) {
    const r = JSON.parse(fs.readFileSync(resultsFile, 'utf8'));
    panels = r.panels || [];
    reelUrl = r.reel_url || null;
  }

  const html = buildHTML(slot, slotData, panels, reelUrl);
  const subject = `🌹 Review: Tannie Talks ${slot} — Week 3 Content Ready`;

  const body = JSON.stringify({
    from: FROM_EMAIL,
    to: [TO_EMAIL],
    subject,
    html,
  });

  console.log(`📧 Sending ${slot} review package to ${TO_EMAIL}...`);

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
            console.log(`✅ Email sent — ID: ${parsed.id}`);
            resolve(parsed);
          } else {
            reject(new Error(parsed.message || JSON.stringify(parsed)));
          }
        } catch (e) {
          reject(new Error(`Response parse error: ${e.message} — raw: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

if (require.main === module) {
  const slot = process.argv[2];
  const resultsFile = process.argv[3];

  if (!slot) {
    console.error('Usage: node email-weekly-package.js <SLOT> [results-file.json]');
    process.exit(1);
  }

  sendWeeklyPackage(slot, resultsFile)
    .catch(err => {
      console.error('❌', err.message);
      process.exit(1);
    });
}

module.exports = { sendWeeklyPackage };
