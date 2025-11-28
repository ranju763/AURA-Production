import { supabase } from './supabase';

/**
 * Uploads an avatar image to Supabase Storage
 * @param {File} file - The image file to upload
 * @param {string} userId - The user ID or temporary identifier
 * @returns {Promise<string>} The public URL of the uploaded image
 * 
 * @note To use this function, you need to:
 * 1. Create an 'avatars' bucket in Supabase Storage Dashboard
 * 2. Set bucket policies:
 *    - Public read: Allow public access to read files
 *    - Authenticated write: Allow authenticated users to upload
 *    - Or: Allow anonymous uploads if needed for signup flow
 */
export async function uploadAvatar(file, userId) {
  try {
    // Validate file type
    if (!file.type.startsWith('image/')) {
      throw new Error('File must be an image');
    }

    // Validate file size (max 5MB)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      throw new Error('Image size must be less than 5MB');
    }

    // Generate a unique filename
    const fileExt = file.name.split('.').pop() || 'jpg';
    const sanitizedExt = fileExt.toLowerCase();
    const allowedExts = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
    
    if (!allowedExts.includes(sanitizedExt)) {
      throw new Error('Unsupported image format. Please use JPG, PNG, GIF, or WebP');
    }

    const fileName = `${userId}-${Date.now()}.${sanitizedExt}`;
    const filePath = `avatars/${fileName}`;

    // Upload to Supabase Storage
    const { data, error } = await supabase.storage
      .from('avatars')
      .upload(filePath, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type,
      });

    if (error) {
      // Handle specific error cases
      console.log(error)
      if (error.message?.includes('Bucket not found')) {
        throw new Error('Storage bucket not configured. Please contact support.');
      }
      if (error.message?.includes('new row violates row-level security')) {
        throw new Error('Permission denied. Please check storage policies.');
      }
      throw new Error(`Upload failed: ${error.message}`);
    }

    if (!data) {
      throw new Error('Upload failed: No data returned');
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('avatars')
      .getPublicUrl(data.path);

    if (!urlData?.publicUrl) {
      throw new Error('Failed to get public URL for uploaded image');
    }

    return urlData.publicUrl;
  } catch (error) {
    console.error('Error uploading avatar:', error);
    throw error;
  }
}

