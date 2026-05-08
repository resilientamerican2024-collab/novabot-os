// generate-tannie-images.js
// Generates Tannie Talks panel images using DALL-E 3
// Prompt template is LOCKED — do not modify without Ingrid's approval.
//
// Usage:
//   node generate-tannie-images.js WED-AM

const fs = require('fs');
const path = require('path');
const https = require('https');
const { uploadImage } = require('./upload-to-imgbb');

const OPENAI_API_KEY = process.env.OPENAI_API_KEY;

// Detect whether Tannie appears in the panel (hand, sleeve, back only)
function tannієLine(panel) {
  const text = (panel.scene_description + ' ' + (panel.elements || []).join(' ')).toLowerCase();
  const hasTannie = text.includes('tannie') || text.includes('red nail') || text.includes('ivory sleeve') || text.includes('ivory robe');
  if (!hasTannie) return null;

  // Determine which element of Tannie is visible
  if (text.includes('palm') || text.includes('hand') || text.includes('nail')) {
    return 'Tannie: hand with deep red nails and silver ring entering frame. No face. No full body.';
  }
  if (text.includes('sleeve') || text.includes('robe') || text.includes('behind') || text.includes('back')) {
    return 'Tannie: seen strictly from behind — ivory satin robe, long dark wavy hair flowing down. Full curvaceous figure, tasteful. Camera angle makes face physically impossible to see. NEVER profile. NEVER 3/4 view.';
  }
  return 'Tannie: ivory sleeve or hand with red nails only. No face. No profile.';
}

function buildPrompt(panel) {
  const scene = panel.scene_description
    .replace(/kassandra['s]*/gi, '')
    .trim();

  const tannie = tannієLine(panel);

  const lines = [
    scene,
    '',
    'Style: Warm oil painting illustration, soft brushstrokes, textured canvas. Muted warm tones, low saturation, cozy intimate lighting — NOT bright, NOT overexposed, NOT white light, NOT harsh sunlight. Rich amber and ivory shadows. NOT comic. NOT graphic novel. NOT pop art. NOT halftone. NOT cartoon.',
    '',
    'Princess Kay: Small white fluffy Maltese dog. Round innocent dark eyes like a toddler. Short cloud-like white fur, soft and fluffy. Small black button nose. Gentle happy expression, slight sweet smile. TRUE RED harness, mesh texture, SILVER D-ring hardware, silver buckle, adjustable straps. NO text on harness. NO text on collar. NO embroidered names. NO labels of any kind. IDENTICAL dog face and body in every panel.',
  ];

  if (tannie) {
    lines.push('');
    lines.push(tannie);
  }

  lines.push(
    '',
    'Colors: Deep red, warm ivory, subtle silver. NO pink. NO coral. NO bright red.',
    '',
    'NO text. NO words. NO letters. NO numbers. NO swatches. NO panels. NO split images. NO strangers. NO background people. NO fake screens. NO UI elements. NO jewelry except silver cross and silver ring.',
    '',
    'Output: Single image, 1024x1024, clean, no borders.'
  );

  const prompt = lines.join('\n');
  console.log(`\n  📋 EXACT PROMPT SENT TO DALL-E (Panel ${panel.panel_number}):`);
  console.log('  ' + '─'.repeat(60));
  console.log(prompt.split('\n').map(l => '  ' + l).join('\n'));
  console.log('  ' + '─'.repeat(60));
  console.log(`  📏 Length: ${prompt.length} chars`);

  if (prompt.length > 3950) {
    console.warn(`  ⚠️  Prompt too long — trimming scene.`);
    const trimmed = scene.slice(0, 180) + '.';
    return buildPrompt({ ...panel, scene_description: trimmed });
  }

  return prompt;
}

function callDallE(prompt) {
  if (!OPENAI_API_KEY) throw new Error('OPENAI_API_KEY not set');

  const body = JSON.stringify({
    model: 'dall-e-3',
    prompt,
    n: 1,
    size: '1024x1024',
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
            reject(new Error(parsed.error?.message || `Unexpected: ${data.slice(0, 200)}`));
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
  if (!slotData) throw new Error(`Slot "${slot}" not found in content-calendar.json`);

  console.log(`\n🌹 Tannie Talks — ${slot} | ${slotData.theme}`);
  console.log('   In memory of Kassandra. Honoring the canon.\n');

  const results = [];

  for (const panel of slotData.panels) {
    console.log(`\n🎨 Panel ${panel.panel_number}/5`);

    const prompt = buildPrompt(panel);
    let dalleUrl;

    try {
      dalleUrl = await callDallE(prompt);
      console.log(`   ✅ DALL-E generated`);
    } catch (err) {
      // Content filter retry — strip scene, keep character locks only
      if (err.message && err.message.toLowerCase().includes('content')) {
        console.warn(`   ⚠️  Content filter hit — retrying with simplified scene`);
        const simplePrompt = buildPrompt({
          ...panel,
          scene_description: panel.scene_description.split('.')[0] + '.',
        });
        try {
          dalleUrl = await callDallE(simplePrompt);
          console.log(`   ✅ Retry succeeded`);
        } catch (err2) {
          console.error(`   ❌ Retry failed: ${err2.message}`);
          results.push({ panel_number: panel.panel_number, error: err2.message });
          continue;
        }
      } else if (err.message && (err.message.includes('500') || err.message.includes('server'))) {
        console.warn(`   ⚠️  Server error — waiting 2 min then retrying`);
        await pause(120000);
        try {
          dalleUrl = await callDallE(prompt);
          console.log(`   ✅ Retry succeeded`);
        } catch (err2) {
          console.error(`   ❌ Retry failed: ${err2.message}`);
          results.push({ panel_number: panel.panel_number, error: err2.message });
          continue;
        }
      } else {
        console.error(`   ❌ DALL-E error: ${err.message}`);
        results.push({ panel_number: panel.panel_number, error: err.message });
        continue;
      }
    }

    const filename = `tannie_${slot.toLowerCase().replace(/-/g, '_')}_panel${panel.panel_number}.jpg`;
    let localPath;
    try {
      localPath = await downloadToTemp(dalleUrl, filename);
      console.log(`   ✅ Downloaded: ${localPath}`);
    } catch (err) {
      console.error(`   ❌ Download failed: ${err.message}`);
      results.push({ panel_number: panel.panel_number, dalle_url: dalleUrl, error: `download: ${err.message}` });
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
      console.error(`   ⚠️  imgbb failed (using DALL-E URL): ${err.message}`);
    }

    results.push({
      panel_number: panel.panel_number,
      scene: panel.scene_description,
      emotion: panel.emotion,
      local_path: localPath,
      imgbb_url: imgbbUrl,
      thumb_url: thumbUrl,
    });

    if (panel.panel_number < slotData.panels.length) {
      console.log('   ⏱  Waiting 3s...');
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

  const outFile = `tannie_${slot.toLowerCase().replace(/-/g, '_')}_results.json`;
  fs.writeFileSync(outFile, JSON.stringify(output, null, 2));

  const ok = results.filter(r => !r.error).length;
  const fail = results.filter(r => r.error).length;
  console.log(`\n✅ Complete: ${ok} panels OK, ${fail} failed`);
  console.log(`📄 Results: ${outFile}\n`);

  return output;
}

if (require.main === module) {
  const slot = process.argv[2];
  if (!slot) {
    console.error('Usage: node generate-tannie-images.js <SLOT>');
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
