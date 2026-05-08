// add-text-overlays.js
// Step 2 of the Tannie Talks pipeline:
//   - Applies Column F on-screen text to panels 1–4 (2 lines per panel, bottom of image)
//   - Generates Panel 5 as a branded text card (cream/yellow/red design)
//   - Re-uploads all finished panels to imgbb and updates the results JSON
//
// Requires: ImageMagick — auto-installed and policy.xml removed if needed

'use strict';

const { execSync, spawnSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { uploadImage } = require('./upload-to-imgbb');

const CREAM  = '#FFFAEC';
const YELLOW = '#FFEB3B';
const RED    = '#8B0000';
const BLACK  = '#1a1a1a';

const FONT_DIR  = '/tmp/tannie_fonts';
const BANGERS   = path.join(FONT_DIR, 'Bangers-Regular.ttf');
const LATO_BOLD = path.join(FONT_DIR, 'Lato-Bold.ttf');

// ─── Ensure ImageMagick ───────────────────────────────────────────────────────

function ensureImageMagick() {
  try {
    execSync('which convert', { stdio: 'pipe' });
  } catch (e) {
    console.log('  📦 Installing ImageMagick...');
    execSync('sudo apt-get update -qq && sudo apt-get install -y imagemagick', { stdio: 'inherit' });
  }
  // Ubuntu ships IM with a restrictive policy.xml that blocks @file reads and /tmp paths.
  // Remove it entirely — this is a CI runner, not a production server.
  execSync(
    'sudo rm -f /etc/ImageMagick-6/policy.xml /etc/ImageMagick-7/policy.xml 2>/dev/null; true',
    { stdio: 'pipe', shell: true }
  );
  console.log('  ✅ ImageMagick ready');
}

// ─── Font setup ──────────────────────────────────────────────────────────────

function ensureFonts() {
  if (!fs.existsSync(FONT_DIR)) fs.mkdirSync(FONT_DIR, { recursive: true });
  const downloads = [
    { path: BANGERS,   url: 'https://fonts.gstatic.com/s/bangers/v24/FeVQS0BTqb0h60ACL5la2bxii28wYQ.ttf' },
    { path: LATO_BOLD, url: 'https://fonts.gstatic.com/s/lato/v24/S6u9w4BMUTPHh6UVSwiPGQ3q5d0.ttf' },
  ];
  for (const { path: fp, url } of downloads) {
    if (!fs.existsSync(fp)) {
      console.log(`  ⬇️  Downloading: ${path.basename(fp)}`);
      execSync(`curl -sL "${url}" -o "${fp}"`);
    }
  }
}

// ─── Text helpers ─────────────────────────────────────────────────────────────

function wrapText(text, maxChars) {
  const words = text.split(/\s+/);
  const lines = [];
  let line = '';
  for (const word of words) {
    if ((line + ' ' + word).trim().length > maxChars) {
      if (line) lines.push(line.trim());
      line = word;
    } else {
      line = (line + ' ' + word).trim();
    }
  }
  if (line) lines.push(line.trim());
  return lines.join('\n');
}

function writeTmp(text) {
  const fp = `/tmp/im_text_${Date.now()}_${Math.random().toString(36).slice(2)}.txt`;
  fs.writeFileSync(fp, text, 'utf8');
  return fp;
}

function distributeLines(lines) {
  const panels = [[], [], [], []];
  const perPanel = Math.ceil(lines.length / 4);
  for (let i = 0; i < 4; i++) {
    panels[i] = lines.slice(i * perPanel, (i + 1) * perPanel);
  }
  return panels.map(p => p.join('\n'));
}

// Run a convert command using spawnSync to avoid shell interpretation issues
function imConvert(args) {
  const result = spawnSync('convert', args, { stdio: ['pipe', 'pipe', 'pipe'] });
  if (result.status !== 0) {
    const stderr = result.stderr ? result.stderr.toString() : '';
    const stdout = result.stdout ? result.stdout.toString() : '';
    throw new Error(`convert failed (${result.status}): ${stderr || stdout}`);
  }
}

// ─── Panel 1–4: text overlay ──────────────────────────────────────────────────

function addTextOverlay(inputPath, outputPath, text) {
  if (!text || !text.trim()) {
    fs.copyFileSync(inputPath, outputPath);
    return;
  }

  const tmp = writeTmp(text);
  try {
    imConvert([
      inputPath,
      '-fill', 'rgba(0,0,0,0.55)',
      '-draw', 'rectangle 0,800 1024,1024',
      '-font', LATO_BOLD,
      '-pointsize', '46',
      '-fill', 'white',
      '-gravity', 'South',
      '-annotate', '+0+30', `@${tmp}`,
      outputPath,
    ]);
  } finally {
    if (fs.existsSync(tmp)) fs.unlinkSync(tmp);
  }
}

// ─── Panel 5: text card ───────────────────────────────────────────────────────

function generateTextCard(outputPath, hook, bodyLines, ctaLine) {
  const hookText = wrapText(hook, 38);
  const bodyText = wrapText(bodyLines.join('\n'), 24);
  const ctaText  = wrapText(ctaLine, 32);

  const hookFile = writeTmp(hookText);
  const bodyFile = writeTmp(bodyText);
  const ctaFile  = writeTmp(ctaText);
  const baseFile = `/tmp/tc_base_${Date.now()}.png`;
  const bodyOut  = `/tmp/tc_body_${Date.now()}.png`;

  try {
    const hookLineCount = hookText.split('\n').length;
    const headerY2 = String(60 + 90 + hookLineCount * 60);

    imConvert([
      '-size', '1024x1024', `xc:${CREAM}`,
      '-fill', YELLOW,
      '-draw', `roundrectangle 40,40 984,${headerY2} 12,12`,
      '-fill', 'none', '-stroke', BLACK, '-strokewidth', '4',
      '-draw', `roundrectangle 40,40 984,${headerY2} 12,12`,
      '-stroke', 'none', '-fill', BLACK,
      '-font', LATO_BOLD, '-pointsize', '42',
      '-gravity', 'North', '-annotate', '+0+60', `@${hookFile}`,
      baseFile,
    ]);

    imConvert([
      baseFile,
      '-font', BANGERS, '-pointsize', '88',
      '-fill', BLACK,
      '-gravity', 'Center', '-annotate', '+0-60', `@${bodyFile}`,
      bodyOut,
    ]);

    imConvert([
      bodyOut,
      '-font', BANGERS, '-pointsize', '58',
      '-fill', RED,
      '-gravity', 'South', '-annotate', '+0+50', `@${ctaFile}`,
      outputPath,
    ]);

  } finally {
    [hookFile, bodyFile, ctaFile, baseFile, bodyOut].forEach(f => {
      if (fs.existsSync(f)) try { fs.unlinkSync(f); } catch (_) {}
    });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function addOverlays(slot, resultsJsonPath, calendarPath) {
  ensureImageMagick();
  ensureFonts();

  const results  = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf8'));
  const calendar = JSON.parse(fs.readFileSync(calendarPath || './content-calendar.json', 'utf8'));
  const slotData = calendar.posts.find(p => p.slot === slot);

  if (!slotData) throw new Error(`Slot "${slot}" not found in calendar`);
  if (!slotData.on_screen_lines || !slotData.hook) {
    console.warn(`  ⚠️  No on_screen_lines/hook for ${slot}`);
    return results;
  }

  const lines      = slotData.on_screen_lines;
  const ctaLine    = lines[lines.length - 1];
  const bodyOnly   = lines.slice(0, lines.length - 1);
  const panelTexts = distributeLines(bodyOnly);

  console.log(`\n✍️  Text overlays — ${slot}`);

  const updatedPanels = [];

  for (const panel of results.panels) {
    if (panel.error) { updatedPanels.push(panel); continue; }

    const panelNum = panel.panel_number;

    if (panelNum >= 1 && panelNum <= 4) {
      const text = panelTexts[panelNum - 1] || '';
      const overlaidPath = panel.local_path.replace(/\.(jpg|jpeg|png)$/i, '_text.jpg');
      console.log(`  🖊  Panel ${panelNum}: "${text.replace(/\n/g, ' / ')}"`);
      addTextOverlay(panel.local_path, overlaidPath, text);

      let imgbbUrl = panel.imgbb_url;
      let thumbUrl = panel.thumb_url;
      try {
        const up = await uploadImage(overlaidPath);
        imgbbUrl = up.url;
        thumbUrl = up.thumb || up.url;
        console.log(`   ✅ imgbb Panel ${panelNum}: ${imgbbUrl}`);
      } catch (err) {
        console.warn(`   ⚠️  imgbb Panel ${panelNum} failed: ${err.message}`);
      }

      updatedPanels.push({
        ...panel,
        local_path: overlaidPath,
        imgbb_url: imgbbUrl,
        thumb_url: thumbUrl,
        overlaid: true,
      });

    } else if (panelNum === 5) {
      const cardPath  = panel.local_path.replace(/\.(jpg|jpeg|png)$/i, '_card.png');
      const bodyLines = bodyOnly.slice(-3);
      console.log(`  🃏  Panel 5: text card`);
      generateTextCard(cardPath, slotData.hook, bodyLines, ctaLine);

      let imgbbUrl = panel.imgbb_url;
      let thumbUrl = panel.thumb_url;
      try {
        const up = await uploadImage(cardPath);
        imgbbUrl = up.url;
        thumbUrl = up.thumb || up.url;
        console.log(`   ✅ imgbb Panel 5 card: ${imgbbUrl}`);
      } catch (err) {
        console.warn(`   ⚠️  imgbb Panel 5 failed: ${err.message}`);
      }

      updatedPanels.push({
        ...panel,
        local_path: cardPath,
        imgbb_url: imgbbUrl,
        thumb_url: thumbUrl,
        scene: 'Text card — ' + slotData.hook,
        text_card: true,
        overlaid: true,
      });
    }
  }

  results.panels = updatedPanels;
  fs.writeFileSync(resultsJsonPath, JSON.stringify(results, null, 2));
  console.log(`  ✅ All panels overlaid and re-uploaded to imgbb`);
  return results;
}

if (require.main === module) {
  const [,, slot, resultsFile, calFile] = process.argv;
  if (!slot || !resultsFile) {
    console.error('Usage: node add-text-overlays.js <SLOT> <results.json> [calendar.json]');
    process.exit(1);
  }
  addOverlays(slot, resultsFile, calFile)
    .then(() => console.log('Done.'))
    .catch(err => { console.error('❌', err.message); process.exit(1); });
}

module.exports = { addOverlays };
