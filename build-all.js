// build-all.js
// Generates all Week 3 + Week 4 slots: 5-panel carousel + 40s reel per slot.
// Saves tannie_batch_results.json for email-batch-package.js.
//
// Usage: node build-all.js

const fs = require('fs');
const path = require('path');
const { generatePanelSet } = require('./generate-tannie-images');
const { createReel } = require('./create-reel');

function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function buildAll() {
  const calendar = JSON.parse(fs.readFileSync('./content-calendar.json', 'utf8'));
  const slots = calendar.posts.map(p => p.slot);

  console.log(`\n🌹 Tannie Talks — Batch Build`);
  console.log(`   ${slots.length} slots: ${slots.join(', ')}`);
  console.log('   In memory of Kassandra. Honoring the canon.\n');

  const batchResults = [];

  for (let i = 0; i < slots.length; i++) {
    const slot = slots[i];
    console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
    console.log(`📅 [${i + 1}/${slots.length}] ${slot}`);
    console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);

    let panelResult = null;
    let reelResult = null;

    // Step 1: Generate panels
    try {
      panelResult = await generatePanelSet(slot);
      const safe = slot.replace(/-/g, '_').toLowerCase();
      const resultsFile = `tannie_${safe}_results.json`;
      fs.writeFileSync(resultsFile, JSON.stringify(panelResult, null, 2));
      console.log(`   ✅ Panels saved: ${resultsFile}`);

      // Step 2: Generate reel
      try {
        const reelData = await createReel(slot, resultsFile);
        reelResult = reelData;
        console.log(`   ✅ Reel: ${reelData.reel_url || reelData.local_path}`);

        // Copy MP4 to workspace for artifact upload
        if (reelData.local_path && fs.existsSync(reelData.local_path)) {
          const dest = path.basename(reelData.local_path);
          fs.copyFileSync(reelData.local_path, dest);
          console.log(`   ✅ MP4 copied to workspace: ${dest}`);
        }
      } catch (err) {
        console.error(`   ⚠️  Reel failed: ${err.message}`);
        reelResult = { error: err.message };
      }
    } catch (err) {
      console.error(`   ❌ Panel generation failed: ${err.message}`);
      panelResult = { error: err.message, slot };
    }

    batchResults.push({
      slot,
      panels: panelResult,
      reel: reelResult,
    });

    // Pause between slots to respect rate limits
    if (i < slots.length - 1) {
      console.log(`\n   ⏱  Waiting 10s before next slot...`);
      await pause(10000);
    }
  }

  const batchFile = 'tannie_batch_results.json';
  fs.writeFileSync(batchFile, JSON.stringify({ slots: batchResults, generated_at: new Date().toISOString() }, null, 2));

  const ok = batchResults.filter(r => r.panels && !r.panels.error).length;
  const fail = batchResults.filter(r => !r.panels || r.panels.error).length;
  const reelOk = batchResults.filter(r => r.reel && !r.reel.error).length;

  console.log(`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`);
  console.log(`✅ Batch complete: ${ok}/${slots.length} panel sets, ${reelOk}/${slots.length} reels`);
  if (fail > 0) console.log(`❌ ${fail} slot(s) failed`);
  console.log(`📄 Results: ${batchFile}`);
  console.log(`━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n`);

  return batchResults;
}

if (require.main === module) {
  buildAll().catch(err => {
    console.error('❌ Fatal:', err.message);
    process.exit(1);
  });
}

module.exports = { buildAll };
