// extract-thumbnail.js
// Extracts a thumbnail frame from an .mp4 at the 2-second mark,
// then uploads it to imgbb using the existing upload-to-imgbb.js

const { execSync } = require('child_process');
const path = require('path');
const fs = require('fs');
const { uploadImage } = require('./upload-to-imgbb');

async function extractAndUpload(videoPath) {
  if (!fs.existsSync(videoPath)) {
    throw new Error(`Video file not found: ${videoPath}`);
  }

  const ext = path.extname(videoPath);
  const base = path.basename(videoPath, ext);
  const dir = path.dirname(videoPath);
  const thumbnailPath = path.join(dir, `${base}_thumb.jpg`);

  console.log(`📽️  Extracting thumbnail from: ${videoPath}`);
  execSync(
    `ffmpeg -y -ss 2 -i "${videoPath}" -frames:v 1 -q:v 2 "${thumbnailPath}"`,
    { stdio: 'pipe' }
  );

  if (!fs.existsSync(thumbnailPath)) {
    throw new Error('ffmpeg did not produce a thumbnail — check the video file');
  }
  console.log(`✅ Thumbnail saved: ${thumbnailPath}`);

  console.log(`☁️  Uploading to imgbb...`);
  const result = await uploadImage(thumbnailPath);
  console.log(`✅ imgbb URL: ${result.url}`);

  return { thumbnailPath, url: result.url, thumb: result.thumb };
}

if (require.main === module) {
  const videoPath = process.argv[2];
  if (!videoPath) {
    console.error('Usage: node extract-thumbnail.js <path-to-video.mp4>');
    console.error('Example: node extract-thumbnail.js videos/tannie_w3_wed_am.mp4');
    process.exit(1);
  }

  extractAndUpload(videoPath)
    .then(result => {
      console.log('\n🎉 Done!');
      console.log(JSON.stringify(result, null, 2));
    })
    .catch(err => {
      console.error('❌ Error:', err.message);
      process.exit(1);
    });
}

module.exports = { extractAndUpload };
