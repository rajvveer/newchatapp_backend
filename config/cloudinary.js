import { v2 as cloudinary } from 'cloudinary';
import dotenv from 'dotenv';

dotenv.config();

// Configure Cloudinary
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Check if Cloudinary is configured
export const isCloudinaryConfigured = () => {
  return !!(
    process.env.CLOUDINARY_CLOUD_NAME &&
    process.env.CLOUDINARY_API_KEY &&
    process.env.CLOUDINARY_API_SECRET
  );
};

// Test Cloudinary connection
export const testCloudinaryConnection = async () => {
  if (!isCloudinaryConfigured()) {
    return {
      success: false,
      message: 'Cloudinary credentials not configured',
    };
  }

  try {
    await cloudinary.api.ping();
    return {
      success: true,
      message: 'Cloudinary connected successfully',
    };
  } catch (error) {
    return {
      success: false,
      message: `Cloudinary connection failed: ${error.message}`,
    };
  }
};

export default cloudinary;
