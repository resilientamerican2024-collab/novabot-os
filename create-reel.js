// create-reel.js
// Creates a 40-second 9:16 reel from 5 DALL-E panel JPGs
// Ken Burns zoom/pan on each panel, crossfaded together
// Uploads MP4 to Supabase, returns public URL
//
// Usage:
//   node create-reel.js WED-AM tannie_wed_am_results.json

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const https = require('https');

const SUPABASE_URL = 'https://gqrcmyvdhezhimehnszj.supabase.co';
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const BUCKET = 'tannie';

const FPS = 24;
const CLIP_DURATION = 8.4;  // 5 × 8.4 − 4 × 0.5 = 40.0s total
const TRANSITION = 0.5;
const FRAMES = Math.round(CLIP_DURATION * FPS); // 202 frames

// Ken Burns variants — different direction per panel
const KB_VARIANTS = [
  `z='min(zoom+0.0012,1.3)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
  `z='min(zoom+0.0012,1.3)':x='min(iw*0.15*on/${FRAMES},iw-(iw/zoom))':y='ih/2-(ih/zoom/2)'`,
  `z='min(zoom+0.0012,1.3)':x='iw/2-(iw/zoom/2)':y='max(0,ih*0.10*on/${FRAMES})'`,
  `z='max(1.0,1.3-on*0.0014)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)'`,
  `z='min(zoom+0.0010,1.25)':x='max(0,iw/2-(iw/zoom/2)-iw*0.08*on/${FRAMES})':y='ih/2-(ih/zoom/2)'`,
];

function buildClip(inputJpg, outputMp4, variantIndex) {
  const kb = KB_VARIANTS[variantIndex % KB_VARIANTS.length];
  const filter = [
    `scale=1097:1920,crop=1080:1920`,
    `zoompan=${kb}:d=${FRAMES}:s=1080x1920:fps=${FPS}`,
    `format=yuv420p`,
  ].join(',');

  execSync(
    `ffmpeg -y -loop 1 -i "${inputJpg}" -vf "${filter}" -t ${CLIP_DURATION} -an -c:v libx264 -preset fast -crf 22 "${outputMp4}"`,
    { stdio: 'inherit' }
  );
}

function stitchClips(clipPaths, outputMp4) {
  const inputs = clipPaths.map(p => `-i "${p}"`).join(' ');
  const visibleDuration = CLIP_DURATION - TRANSITION;

  let filterParts = [];
  for (let i = 1; i < clipPaths.length; i++) {
    const offset = (visibleDuration * i).toFixed(2);
    const inLabel = i === 1 ? `[0][1]` : `[v0${i - 1}][${i}]`;
    const outLabel = i === clipPaths.length - 1 ? 'vout' : `v0${i}`;
    filterParts.push(
      `${inLabel}xfade=transition=fade:duration=${TRANSITION}:offset=${offset}[${outLabel}]`
    );
  }

  execSync(
    `ffmpeg -y ${inputs} -filter_complex "${filterParts.join(';')}" -map "[vout]" -c:v libx264 -preset fast -crf 22 -pix_fmt yuv420p "${outputMp4}"`,
    { stdio: 'inherit' }
  );
}

async function uploadToSupabase(filePath, filename) {
  if (!SUPABASE_KEY) throw new Error('SUPABASE_SERVICE_KEY not set');

  const fileData = fs.readFileSync(filePath);

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'gqrcmyvdhezhimehnszj.supabase.co',
      path: `/storage/v1/object/${BUCKET}/${filename}`,
      method: 'POST',
      headers: {
        Authorization: `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'video/mp4',
        'Content-Length': fileData.length,
        'x-upsert': 'true',
      },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(`${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${filename}`);
        } else {
          reject(new Error(`Supabase ${res.statusCode}: ${data.slice(0, 200)}`));
        }
      });
    });
    req.on('error', reject);
    req.write(fileData);
    req.end();
  });
}

async function createReel(slot, resultsJsonPath) {
  const results = JSON.parse(fs.readFileSync(resultsJsonPath, 'utf8'));
  const panels = results.panels.filter(p => !p.error && p.local_path);

  if (panels.length === 0) throw new Error('No successful panels to build reel from');

  console.log(`\n🎬 Creating reel for ${slot} — ${panels.length} panels`);

  // Build one Ken Burns clip per panel
  const clipPaths = [];
  for (const panel of panels) {
    const clipPath = panel.local_path.replace('.jpg', '_clip.mp4');
    console.log(`  🎞  Panel ${panel.panel_number}: Ken Burns → ${path.basename(clipPath)}`);
    buildClip(panel.local_path, clipPath, panel.panel_number - 1);
    clipPaths.push(clipPath);
  }

  // Stitch clips with crossfades
  const safeSlot = slot.toLowerCase().replace('-', '_');
  const reelFilename = `tannie_${safeSlot}_week3.mp4`;
  const reelPath = path.join('/tmp', reelFilename);
  console.log(`\n  🔗 Stitching ${clipPaths.length} clips → ${reelFilename}`);
  stitchClips(clipPaths, reelPath);

  const sizeMB = (fs.statSync(reelPath).size / 1024 / 1024).toFixed(1);
  console.log(`  ✅ Reel: ${reelPath} (${sizeMB} MB)`);

  // Upload to Supabase
  let reelUrl = null;
  try {
    console.log(`  ☁️  Uploading to Supabase (bucket: ${BUCKET})...`);
    reelUrl = await uploadToSupabase(reelPath, reelFilename);
    console.log(`  ✅ Supabase: ${reelUrl}`);
  } catch (err) {
    console.error(`  ⚠️  Supabase upload failed: ${err.message}`);
  }

  // Update results JSON
  results.reel_path = reelPath;
  results.reel_url = reelUrl;
  results.reel_filename = reelFilename;
  fs.writeFileSync(resultsJsonPath, JSON.stringify(results, null, 2));

  return { reelPath, reelUrl, reelFilename };
}

if (require.main === module) {
  const slot = process.argv[2];
  const resultsFile = process.argv[3];

  if (!slot || !resultsFile) {
    console.error('Usage: node create-reel.js <SLOT> <results-file.json>');
    process.exit(1);
  }

  createReel(slot, resultsFile)
    .then(({ reelPath, reelUrl }) => {
      console.log('\n🎬 Reel complete!');
      console.log('Local:', reelPath);
      if (reelUrl) console.log('URL:', reelUrl);
    })
    .catch(err => {
      console.error('❌ Fatal:', err.message);
      process.exit(1);
    });
}

module.exports = { createReel };
