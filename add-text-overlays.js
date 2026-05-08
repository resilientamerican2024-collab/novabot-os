// add-text-overlays.js
// Step 2 of the Tannie Talks pipeline:
//   - Applies Column F on-screen text to panels 1–4 (2 lines per panel, bottom of image)
//   - Generates Panel 5 as a branded text card (cream/yellow/red design)
//   - Re-uploads all finished panels to imgbb and updates the results JSON
//
// Requires: ImageMagick (convert), already on ubuntu-latest

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { uploadImage } = require('./upload-to-imgbb');

const CREAM  = '#FFFAEC';
const YELLOW = '#FFEB3B';
const RED    = '#8B0000';
const BLACK  = '#1a1a1a';

const FONT_DIR    = '/tmp/tannie_fonts';
const BANGERS     = path.join(FONT_DIR, 'Bangers-Regular.ttf');
const LATO_BOLD   = path.join(FONT_DIR, 'Lato-Bold.ttf');
const LATO_ITALIC = path.join(FONT_DIR, 'Lato-Italic.ttf');

function ensureFonts() {
  if (!fs.existsSync(FONT_DIR)) fs.mkdirSync(FONT_DIR, { recursive: true });
  const downloads = [
    { path: BANGERS,     url: 'https://fonts.gstatic.com/s/bangers/v24/FeVQS0BTqb0h60ACL5la2bxii28wYQ.ttf' },
    { path: LATO_BOLD,   url: 'https://fonts.gstatic.com/s/lato/v24/S6u9w4BMUTPHh6UVSwiPGQ3q5d0.ttf' },
    { path: LATO_ITALIC, url: 'https://fonts.gstatic.com/s/lato/v24/S6u8w4BMUTPHjxsAXC-v98iAFw.ttf' },
  ];
  for (const { path: fp, url } of downloads) {
    if (!fs.existsSync(fp)) {
      console.log(`  ⬇️  Downloading font: ${path.basename(fp)}`);
      execSync(`curl -sL "${url}" -o "${fp}"`);
    }
  }
}

// Escape text for ImageMagick -annotate (double-quoted shell argument)
// Critical: newlines must become literal \n so ImageMagick renders multi-line text
function imEscape(str) {
  return str
    .replace(/\\/g, '\\\\')   // backslashes first
    .replace(/\n/g, '\\n')    // newlines → \n for IM multi-line rendering
    .replace(/"/g, '\\"')     // double quotes
    .replace(/%/g, '%%')      // percent signs (IM format escape)
    .replace(/@/g, '\\@');    // @ signs
}

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

// Write text to temp file to avoid ALL shell quoting issues
function writeTextFile(text) {
  const tmp = `/tmp/im_text_${Date.now()}.txt`;
  fs.writeFileSync(tmp, text, 'utf8');
  return tmp;
}

function distributeLines(lines) {
  const panels = [[], [], [], []];
  const n = lines.length;
  if (n <= 4) {
    lines.forEach((l, i) => { if (i < 4) panels[i].push(l); });
  } else {
    const perPanel = Math.ceil(n / 4);
    for (let i = 0; i < 4; i++) {
      panels[i] = lines.slice(i * perPanel, (i + 1) * perPanel);
    }
  }
  return panels.map(p => p.join('\n'));
}

// ─── Panel 1–4: text overlay using temp file ─────────────────────────────────

function addTextOverlay(inputPath, outputPath, text) {
  if (!text || !text.trim()) {
    fs.copyFileSync(inputPath, outputPath);
    return;
  }

  // Write text to temp file — sidesteps ALL shell quoting issues with newlines/special chars
  const tmpText = writeTextFile(text);

  try {
    execSync([
      `convert "${inputPath}"`,
      `-fill "rgba(0,0,0,0.55)"`,
      `-draw "rectangle 0,800 1024,1024"`,
      `-font "${LATO_BOLD}"`,
      `-pointsize 46`,
      `-fill white`,
      `-gravity South`,
      `-annotate +0+30 "@${tmpText}"`,
      `"${outputPath}"`,
    ].join(' '));
  } finally {
    if (fs.existsSync(tmpText)) fs.unlinkSync(tmpText);
  }
}

// ─── Panel 5: text card using temp files ─────────────────────────────────────

function generateTextCard(outputPath, hook, bodyLines, ctaLine) {
  const hookText = wrapText(hook, 38);
  const bodyText = wrapText(bodyLines.join('\n'), 24);
  const ctaText  = wrapText(ctaLine, 32);

  const hookFile = writeTextFile(hookText);
  const bodyFile = writeTextFile(bodyText);
  const ctaFile  = writeTextFile(ctaText);
  const baseFile = `/tmp/tannie_card_base_${Date.now()}.png`;
  const bodyOut  = `/tmp/tannie_card_body_${Date.now()}.png`;

  try {
    const hookLineCount = hookText.split('\n').length;
    const headerH  = 90 + hookLineCount * 60;
    const headerY2 = 60 + headerH;

    // Step 1: cream base + yellow header box
    execSync([
      `convert -size 1024x1024 "xc:${CREAM}"`,
      `-fill "${YELLOW}"`,
      `-draw "roundrectangle 40,40 984,${headerY2} 12,12"`,
      `-fill none`,
      `-stroke "${BLACK}"`,
      `-strokewidth 4`,
      `-draw "roundrectangle 40,40 984,${headerY2} 12,12"`,
      `-stroke none`,
      `-fill "${BLACK}"`,
      `-font "${LATO_BOLD}"`,
      `-pointsize 42`,
      `-gravity North`,
      `-annotate +0+60 "@${hookFile}"`,
      `"${baseFile}"`,
    ].join(' '));

    // Step 2: bold body text centered
    execSync([
      `convert "${baseFile}"`,
      `-font "${BANGERS}"`,
      `-pointsize 88`,
      `-fill "${BLACK}"`,
      `-gravity Center`,
      `-annotate +0-60 "@${bodyFile}"`,
      `"${bodyOut}"`,
    ].join(' '));

    // Step 3: red CTA at bottom
    execSync([
      `convert "${bodyOut}"`,
      `-font "${BANGERS}"`,
      `-pointsize 58`,
      `-fill "${RED}"`,
      `-gravity South`,
      `-annotate +0+50 "@${ctaFile}"`,
      `"${outputPath}"`,
    ].join(' '));

  } finally {
    [hookFile, bodyFile, ctaFile, baseFile, bodyOut].forEach(f => {
      if (fs.existsSync(f)) fs.unlinkSync(f);
    });
  }
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function addOverlays(slot, resultsJsonPath, calendarPath) {
  ensureFonts();

  const results  = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf8'));
  const calendar = JSON.parse(fs.readFileSync(calendarPath || './content-calendar.json', 'utf8'));
  const slotData = calendar.posts.find(p => p.slot === slot);

  if (!slotData) throw new Error(`Slot "${slot}" not found in calendar`);
  if (!slotData.on_screen_lines || !slotData.hook) {
    console.warn(`  ⚠️  No on_screen_lines/hook for ${slot} — skipping overlays`);
    return results;
  }

  const lines    = slotData.on_screen_lines;
  const ctaLine  = lines[lines.length - 1];
  const bodyOnly = lines.slice(0, lines.length - 1);
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
        console.warn(`   ⚠️  imgbb upload failed (Panel ${panelNum}): ${err.message}`);
      }

      updatedPanels.push({ ...panel, local_path: overlaidPath, imgbb_url: imgbbUrl, thumb_url: thumbUrl, overlaid: true });

    } else if (panelNum === 5) {
      const cardPath = panel.local_path.replace(/\.(jpg|jpeg|png)$/i, '_card.png');
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
        console.warn(`   ⚠️  imgbb upload failed (Panel 5): ${err.message}`);
      }

      updatedPanels.push({
        ...panel,
        local_path: cardPath,
        imgbb_url: imgbbUrl,
        thumb_url: thumbUrl,
        scene: 'Text card — ' + slotData.hook,
        text_card: true,
      });
    }
  }

  results.panels = updatedPanels;
  fs.writeFileSync(resultsJsonPath, JSON.stringify(results, null, 2));
  console.log(`  ✅ Overlays done — all panels re-uploaded to imgbb`);
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
