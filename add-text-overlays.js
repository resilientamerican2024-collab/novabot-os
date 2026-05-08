// add-text-overlays.js
// Step 2 of the Tannie Talks pipeline:
//   - Applies Column F on-screen text to panels 1–4 (2 lines per panel, bottom of image)
//   - Generates Panel 5 as a branded text card (cream/yellow/red design)
//
// Requires: ImageMagick (convert), already on ubuntu-latest
//
// Usage: node add-text-overlays.js <SLOT> <results-json>

'use strict';

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

// Brand colors
const CREAM   = '#FFFAEC';
const YELLOW  = '#FFEB3B';
const RED     = '#8B0000';
const BLACK   = '#1a1a1a';

// ─── Font setup ──────────────────────────────────────────────────────────────
// Download Bangers (display) and Lato-Bold (body) from Google Fonts if missing

const FONT_DIR   = '/tmp/tannie_fonts';
const BANGERS    = path.join(FONT_DIR, 'Bangers-Regular.ttf');
const LATO_BOLD  = path.join(FONT_DIR, 'Lato-Bold.ttf');
const LATO_ITALIC= path.join(FONT_DIR, 'Lato-Italic.ttf');

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

// ─── Text helpers ─────────────────────────────────────────────────────────────

function imEscape(str) {
  // Escape for ImageMagick label: text
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/"/g, '\\"').replace(/%/g, '\\%').replace(/@/g, '\\@');
}

// Wrap text to maxChars per line
function wrapText(text, maxChars) {
  const words = text.split(' ');
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

// Distribute on-screen text lines across 4 panels (2 lines each)
function distributeLines(lines) {
  const n = lines.length;
  const panels = [[], [], [], []];

  if (n <= 4) {
    lines.forEach((l, i) => panels[i].push(l));
  } else if (n <= 8) {
    const half = Math.ceil(n / 4);
    for (let i = 0; i < 4; i++) {
      panels[i] = lines.slice(i * half, (i + 1) * half);
    }
  } else {
    // More than 8: drop the CTA line from panels (it goes on Panel 5)
    const body = lines.slice(0, lines.length - 1);
    const half = Math.ceil(body.length / 4);
    for (let i = 0; i < 4; i++) {
      panels[i] = body.slice(i * half, (i + 1) * half);
    }
  }

  return panels.map(p => p.join('\n'));
}

// ─── Panel 1–4: text overlay ──────────────────────────────────────────────────

function addTextOverlay(inputPath, outputPath, text) {
  if (!text.trim()) {
    fs.copyFileSync(inputPath, outputPath);
    return;
  }

  const wrapped = wrapText(text, 32);
  const escaped = imEscape(wrapped);

  // Semi-transparent black bar at bottom, white Lato-Bold text on top
  execSync([
    `convert "${inputPath}"`,
    // Draw translucent black bar at bottom (covers ~22% of image height)
    `-fill "rgba(0,0,0,0.55)"`,
    `-draw "rectangle 0,800 1024,1024"`,
    // White text, centered in the bar
    `-font "${LATO_BOLD}"`,
    `-pointsize 46`,
    `-fill white`,
    `-gravity South`,
    `-annotate +0+30 "${escaped}"`,
    `"${outputPath}"`,
  ].join(' '));
}

// ─── Panel 5: text card ───────────────────────────────────────────────────────

function generateTextCard(outputPath, hook, bodyLines, ctaLine) {
  // hook      → yellow header box
  // bodyLines → bold center text (1–3 punchiest lines before CTA)
  // ctaLine   → red CTA at bottom

  const hookWrapped  = wrapText(hook, 38);
  const bodyWrapped  = wrapText(bodyLines.join('\n'), 24);
  const ctaWrapped   = wrapText(ctaLine, 32);

  const hookEsc = imEscape(hookWrapped);
  const bodyEsc = imEscape(bodyWrapped);
  const ctaEsc  = imEscape(ctaWrapped);

  // Count lines to size the header box
  const hookLines = hookWrapped.split('\n').length;
  const headerH = 90 + hookLines * 60;  // ~90px padding + 60px per line
  const headerY2 = 60 + headerH;

  // Step 1: cream base + header box
  execSync([
    `convert -size 1024x1024 "xc:${CREAM}"`,
    // Yellow header rectangle
    `-fill "${YELLOW}"`,
    `-draw "roundrectangle 40,40 984,${headerY2} 12,12"`,
    // Black border on header
    `-fill none`,
    `-stroke "${BLACK}"`,
    `-strokewidth 4`,
    `-draw "roundrectangle 40,40 984,${headerY2} 12,12"`,
    // Hook text in header
    `-stroke none`,
    `-fill "${BLACK}"`,
    `-font "${LATO_BOLD}"`,
    `-pointsize 42`,
    `-gravity North`,
    `-annotate +0+60 "${hookEsc}"`,
    `"/tmp/tannie_card_base.png"`,
  ].join(' '));

  // Step 2: bold body text centered in remaining space
  execSync([
    `convert "/tmp/tannie_card_base.png"`,
    `-font "${BANGERS}"`,
    `-pointsize 92`,
    `-fill "${BLACK}"`,
    `-gravity Center`,
    `-annotate +0-60 "${bodyEsc}"`,
    `"/tmp/tannie_card_body.png"`,
  ].join(' '));

  // Step 3: red CTA at bottom
  execSync([
    `convert "/tmp/tannie_card_body.png"`,
    `-font "${BANGERS}"`,
    `-pointsize 58`,
    `-fill "${RED}"`,
    `-gravity South`,
    `-annotate +0+50 "${ctaEsc}"`,
    `"${outputPath}"`,
  ].join(' '));

  // Cleanup temp files
  ['/tmp/tannie_card_base.png', '/tmp/tannie_card_body.png'].forEach(f => {
    if (fs.existsSync(f)) fs.unlinkSync(f);
  });
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function addOverlays(slot, resultsJsonPath, calendarPath) {
  ensureFonts();

  const results  = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf8'));
  const calendar = JSON.parse(fs.readFileSync(calendarPath || './content-calendar.json', 'utf8'));
  const slotData = calendar.posts.find(p => p.slot === slot);

  if (!slotData) throw new Error(`Slot "${slot}" not found in calendar`);
  if (!slotData.on_screen_lines || !slotData.hook) {
    console.warn(`  ⚠️  No on_screen_lines/hook for ${slot} — skipping text overlays`);
    return results;
  }

  const lines    = slotData.on_screen_lines;
  const ctaLine  = lines[lines.length - 1];            // last line is always the CTA
  const bodyOnly = lines.slice(0, lines.length - 1);   // body without CTA
  const panelTexts = distributeLines(bodyOnly);

  console.log(`\n✍️  Adding text overlays — ${slot}`);

  const updatedPanels = [];

  for (const panel of results.panels) {
    if (panel.error) { updatedPanels.push(panel); continue; }

    const panelNum = panel.panel_number;

    if (panelNum >= 1 && panelNum <= 4) {
      const text = panelTexts[panelNum - 1] || '';
      const overlaidPath = panel.local_path.replace('.jpg', '_text.jpg');
      console.log(`  🖊  Panel ${panelNum}: "${text.replace(/\n/g, ' / ')}"`);
      addTextOverlay(panel.local_path, overlaidPath, text);
      updatedPanels.push({ ...panel, local_path: overlaidPath, overlaid: true });

    } else if (panelNum === 5) {
      // Replace Panel 5 with generated text card
      const cardPath = panel.local_path.replace('.jpg', '_card.jpg');
      const bodyLines = bodyOnly.slice(-3);  // last 3 body lines = punchiest
      console.log(`  🃏  Panel 5: generating text card`);
      generateTextCard(cardPath, slotData.hook, bodyLines, ctaLine);
      updatedPanels.push({
        ...panel,
        local_path: cardPath,
        scene: 'Text card — ' + slotData.hook,
        text_card: true,
      });
    }
  }

  results.panels = updatedPanels;
  fs.writeFileSync(resultsJsonPath, JSON.stringify(results, null, 2));

  console.log(`  ✅ Text overlays complete`);
  return results;
}

if (require.main === module) {
  const slot        = process.argv[2];
  const resultsFile = process.argv[3];
  const calFile     = process.argv[4];

  if (!slot || !resultsFile) {
    console.error('Usage: node add-text-overlays.js <SLOT> <results.json> [calendar.json]');
    process.exit(1);
  }

  addOverlays(slot, resultsFile, calFile)
    .then(() => console.log('Done.'))
    .catch(err => { console.error('❌', err.message); process.exit(1); });
}

module.exports = { addOverlays };
