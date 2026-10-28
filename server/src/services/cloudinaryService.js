import { cloudinary } from '../config/cloudinary.js';
import { env } from '../config/env.js';

/**
 * Generate signature and upload parameters for frontend direct upload.
 * Keeps Cloudinary API secret safely on the server.
 * @param {string} userId
 */
export function generateSignedUploadParams(userId) {
  const timestamp = Math.round(new Date().getTime() / 1000);
  const folder = `campusbid/users/${userId}`;

  // If using placeholder credentials, return mock direct endpoint info
  if (!env.CLOUDINARY_API_SECRET || env.CLOUDINARY_API_SECRET === 'your_api_secret') {
    return {
      isMock: true,
      uploadUrl: '/api/v1/uploads/mock-upload',
      timestamp,
      folder,
    };
  }

  const signature = cloudinary.utils.api_sign_request(
    {
      timestamp,
      folder,
    },
    env.CLOUDINARY_API_SECRET
  );

  return {
    isMock: false,
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/image/upload`,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    signature,
    folder,
  };
}

/**
 * Delete an image from Cloudinary by public ID.
 * @param {string} publicId
 */
export async function deleteCloudinaryImage(publicId) {
  if (!publicId || publicId.startsWith('mock_')) return true;
  try {
    const result = await cloudinary.uploader.destroy(publicId);
    return result.result === 'ok';
  } catch (error) {
    console.error(`Failed to delete Cloudinary image (${publicId}):`, error.message);
    return false;
  }
}
