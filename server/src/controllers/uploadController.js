import { generateSignedUploadParams } from '../services/cloudinaryService.js';

export function getSignedUploadUrl(req, res, next) {
  try {
    const userId = req.user._id.toString();
    const params = generateSignedUploadParams(userId);

    res.json({
      success: true,
      data: params,
    });
  } catch (err) {
    next(err);
  }
}

export function mockDirectUpload(req, res) {
  // Mock endpoint for test/dev when real Cloudinary API keys are not provided
  const dummyId = `mock_${Date.now()}_${Math.random().toString(36).substring(7)}`;
  res.json({
    public_id: dummyId,
    secure_url: `https://images.unsplash.com/photo-1544716278-ca5e3f4abd8c?auto=format&fit=crop&w=800&q=80`,
    format: 'jpg',
    resource_type: 'image',
  });
}
