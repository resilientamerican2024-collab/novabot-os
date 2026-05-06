// upload-to-imgbb.js
// Uploads images to imgbb and returns public URLs

const fs = require('fs');
const FormData = require('form-data');
const fetch = require('node-fetch');

const IMGBB_API_KEY = process.env.IMGBB_API_KEY;

async function uploadImage(imagePath) {
  if (!IMGBB_API_KEY) {
    throw new Error('IMGBB_API_KEY not found. Make sure it is set in GitHub Secrets.');
  }

  const imageBase64 = fs.readFileSync(imagePath, { encoding: 'base64' });
  
  const form = new FormData();
  form.append('key', IMGBB_API_KEY);
  form.append('image', imageBase64);

  const response = await fetch('https://api.imgbb.com/1/upload', {
    method: 'POST',
    body: form
  });

  const data = await response.json();
  
  if (data.success) {
    return {
      url: data.data.url,
      deleteUrl: data.data.delete_url,
      thumb: data.data.thumb?.url || data.data.url
    };
  } else {
    throw new Error(`Upload failed: ${data.error?.message || 'Unknown error'}`);
  }
}

// If running from command line: node upload-to-imgbb.js path/to/image.jpg
if (require.main === module) {
  const imagePath = process.argv[2];
  if (!imagePath) {
    console.log('Usage: node upload-to-imgbb.js <path-to-image>');
    process.exit(1);
  }
  
  uploadImage(imagePath)
    .then(result => {
      console.log('✅ Upload successful!');
      console.log('URL:', result.url);
      console.log('Thumb:', result.thumb);
    })
    .catch(err => {
      console.error('❌ Error:', err.message);
      process.exit(1);
    });
}

module.exports = { uploadImage };
