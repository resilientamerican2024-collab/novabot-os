// generate-tannie-images.js
// Generates Tannie Talks panel images using DALL-E 3
// Every image honors tannie-canon.md and the memory of Kassandra.
//
// Usage:
//   node generate-tannie-images.js WED-AM
//   node generate-tannie-images.js WED-PM

const fs = require('fs');
const path = require('path');
const https = require('https');
const { uploadImage } = require('./upload-to-imgbb');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;
const CANON_TEMPLATE = fs.readFileSync(
  path.join(__dirname, 'tannie-prompt-template.md'), 'utf8'
);

function buildPrompt(panel, slotTheme) {
  return [
    CANON_TEMPLATE,
    '',
    '---',
    '',
    `## THIS PANEL — Panel ${panel.panel_number} of 5`,
    `Week theme: ${slotTheme}`,
    `Scene: ${panel.scene_description}`,
    `Emotional tone: ${panel.emotion}`,
    `Required elements: ${panel.elements.join(', ')}`,
    '',
    'Generate a single panel image that honors every canon rule above without exception.',
    'Tannie shown from behind or in silhouette only — pre-reveal phase.',
    'Princess Kay must be present with innocent wide-eyed expression and true red harness.',
  ].join('\n');
}

function callDallE(prompt) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY environment variable not set');

  const body = JSON.stringify({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1792',
    quality: 'hd',
    style: 'vivid',
  });

  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.openai.com',
      path: '/v1/images/generations',
      method: 'POST',
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
      },
    }, res => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (parsed.data && parsed.data[0] && parsed.data[0].url) {
            resolve(parsed.data[0].url);
          } else {
            reject(new Error(parsed.error?.message || `Unexpected response: ${data.slice(0, 200)}`));
          }
        } catch (e) {
          reject(new Error(`JSON parse error: ${e.message}`));
        }
      });
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

function downloadToTemp(url, filename) {
  const localPath = path.join('/tmp', filename);
  return new Promise((resolve, reject) => {
    const file = fs.createWriteStream(localPath);
    https.get(url, res => {
      res.pipe(file);
      file.on('finish', () => { file.close(); resolve(localPath); });
    }).on('error', err => {
      fs.unlink(localPath, () => {});
      reject(err);
    });
  });
}

function pause(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function generatePanelSet(slot) {
  const calendar = JSON.parse(fs.readFileSync('./content-calendar.json', 'utf8'));
  const slotData = calendar.posts.find(p => p.slot === slot);
  if (!slotData) {
    throw new Error(`Slot "${slot}" not found in content-calendar.json`);
  }

  console.log(`\n🌹 Tannie Talks — ${slot} | ${slotData.theme}`);
  console.log('   In memory of Kassandra. Honoring the canon.\n');

  const results = [];

  for (const panel of slotData.panels) {
    console.log(`🎨 Panel ${panel.panel_number}/5: ${panel.scene_description.slice(0, 70)}...`);

    let dalleUrl;
    try {
      const prompt = buildPrompt(panel, slotData.theme);
      dalleUrl = await callDallE(prompt);
      console.log(`   ✅ DALL-E generated`);
    } catch (err) {
      console.error(`   ❌ DALL-E error: ${err.message}`);
      results.push({ panel_number: panel.panel_number, scene: panel.scene_description, error: err.message });
      continue;
    }

    const filename = `tannie_${slot.toLowerCase().replace('-', '_')}_panel${panel.panel_number}.jpg`;
    let localPath;
    try {
      localPath = await downloadToTemp(dalleUrl, filename);
      console.log(`   ✅ Downloaded: ${localPath}`);
    } catch (err) {
      console.error(`   ❌ Download failed: ${err.message}`);
      results.push({ panel_number: panel.panel_number, scene: panel.scene_description, dalle_url: dalleUrl, error: `download: ${err.message}` });
      continue;
    }

    let imgbbUrl = dalleUrl;
    let thumbUrl = dalleUrl;
    try {
      const uploaded = await uploadImage(localPath);
      imgbbUrl = uploaded.url;
      thumbUrl = uploaded.thumb || uploaded.url;
      console.log(`   ✅ imgbb: ${imgbbUrl}`);
    } catch (err) {
      console.error(`   ⚠️  imgbb upload failed (using DALL-E URL as fallback): ${err.message}`);
    }

    results.push({
      panel_number: panel.panel_number,
      scene: panel.scene_description,
      emotion: panel.emotion,
      local_path: localPath,
      imgbb_url: imgbbUrl,
      thumb_url: thumbUrl,
    });

    // Respect OpenAI rate limits between panels
    if (panel.panel_number < slotData.panels.length) {
      console.log('   ⏱  Waiting 3s before next panel...');
      await pause(3000);
    }
  }

  const output = {
    slot,
    theme: slotData.theme,
    caption: slotData.caption,
    hashtags: slotData.hashtags,
    generated_at: new Date().toISOString(),
    panels: results,
  };

  const outFile = `tannie_${slot.toLowerCase().replace('-', '_')}_results.json`;
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));

  const ok = results.filter(r => !r.error).length;
  const fail = results.filter(r => r.error).length;
  console.log(`\n✅ Complete: ${ok} panels generated, ${fail} failed`);
  console.log(`📄 Results saved: ${outFile}\n`);

  return output;
}

if (require.main === module) {
  const slot = process.argv[2];
  if (!slot) {
    console.error('Usage: node generate-tannie-images.js <SLOT>');
    console.error('Example: node generate-tannie-images.js WED-AM');
    process.exit(1);
  }

  generatePanelSet(slot)
    .then(output => {
      console.log('Caption:\n', output.caption);
      console.log('\nHashtags:', output.hashtags);
    })
    .catch(err => {
      console.error('❌ Fatal:', err.message);
      process.exit(1);
    });
}

module.exports = { generatePanelSet };
