// Image preprocessing service for video generation pipeline
// Handles forcing any aspect ratio image to 9:16 for AI processing

export interface ImageDimensions {
  width: number;
  height: number;
  aspectRatio: number;
}

export interface PreprocessingResult {
  processedImage: string; // Base64 data URL
  originalDimensions: ImageDimensions;
  paddingInfo: {
    top: number;
    left: number;
    scale: number;
    targetWidth: number;
    targetHeight: number;
  };
}

/**
 * Force an image to a specific aspect ratio by creating a canvas
 * with the target dimensions and centering the original image
 */
export const forceAspectRatio = async (
  imageData: string, 
  targetAspectRatio: number = 9/16
): Promise<PreprocessingResult> => {
  console.log('[ImagePreprocessing] Starting aspect ratio conversion');
  console.log('[ImagePreprocessing] Target aspect ratio:', targetAspectRatio);

  try {
    // Create image element to get dimensions
    const img = new Image();
    const imageLoadPromise = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
    });

    // Handle different image data formats
    if (imageData.startsWith('data:')) {
      img.src = imageData;
    } else if (imageData.startsWith('http')) {
      img.src = imageData;
    } else {
      // Assume it's raw base64, convert to data URL
      img.src = `data:image/png;base64,${imageData}`;
    }

    await imageLoadPromise;

    // Get original dimensions
    const originalWidth = img.naturalWidth || img.width;
    const originalHeight = img.naturalHeight || img.height;
    const originalAspectRatio = originalWidth / originalHeight;

    console.log('[ImagePreprocessing] Original dimensions:', {
      width: originalWidth,
      height: originalHeight,
      aspectRatio: originalAspectRatio
    });

    // Calculate target dimensions (maintain reasonable size)
    const maxDimension = 1024; // Maximum dimension for AI processing
    let targetWidth: number;
    let targetHeight: number;

    if (targetAspectRatio > 1) {
      // Landscape target (width > height)
      targetWidth = maxDimension;
      targetHeight = Math.round(maxDimension / targetAspectRatio);
    } else {
      // Portrait target (height > width) - our case for 9:16
      targetHeight = maxDimension;
      targetWidth = Math.round(maxDimension * targetAspectRatio);
    }

    console.log('[ImagePreprocessing] Target dimensions:', {
      width: targetWidth,
      height: targetHeight,
      aspectRatio: targetWidth / targetHeight
    });

    // Create canvas for processing
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    canvas.width = targetWidth;
    canvas.height = targetHeight;

    // Fill with white background
    ctx.fillStyle = '#FFFFFF';
    ctx.fillRect(0, 0, targetWidth, targetHeight);

    // Calculate scaling and positioning
    const scale = Math.min(
      targetWidth / originalWidth,
      targetHeight / originalHeight
    );

    const scaledWidth = originalWidth * scale;
    const scaledHeight = originalHeight * scale;

    // Center the image
    const left = (targetWidth - scaledWidth) / 2;
    const top = (targetHeight - scaledHeight) / 2;

    console.log('[ImagePreprocessing] Scaling and positioning:', {
      scale,
      scaledWidth,
      scaledHeight,
      left,
      top
    });

    // Draw the image centered
    ctx.drawImage(
      img,
      left, top, scaledWidth, scaledHeight
    );

    // Convert to base64
    const processedImage = canvas.toDataURL('image/png', 0.9);

    const result: PreprocessingResult = {
      processedImage,
      originalDimensions: {
        width: originalWidth,
        height: originalHeight,
        aspectRatio: originalAspectRatio
      },
      paddingInfo: {
        top,
        left,
        scale,
        targetWidth,
        targetHeight
      }
    };

    console.log('[ImagePreprocessing] Conversion complete:', result);
    return result;

  } catch (error) {
    console.error('[ImagePreprocessing] Error during conversion:', error);
    throw new Error(`Image preprocessing failed: ${error instanceof Error ? error.message : String(error)}`);
  }
};

/**
 * Utility function to calculate aspect ratio from dimensions
 */
export const calculateAspectRatio = (width: number, height: number): number => {
  return width / height;
};

/**
 * Utility function to check if aspect ratios are similar
 */
export const areAspectRatiosSimilar = (
  ratio1: number, 
  ratio2: number, 
  tolerance: number = 0.1
): boolean => {
  return Math.abs(ratio1 - ratio2) <= tolerance;
};

/**
 * Get aspect ratio label for display purposes
 */
export const getAspectRatioLabel = (aspectRatio: number): string => {
  if (Math.abs(aspectRatio - 16/9) < 0.1) return '16:9 (Landscape)';
  if (Math.abs(aspectRatio - 9/16) < 0.1) return '9:16 (Portrait)';
  if (Math.abs(aspectRatio - 1) < 0.1) return '1:1 (Square)';
  if (Math.abs(aspectRatio - 4/3) < 0.1) return '4:3 (Standard)';
  if (Math.abs(aspectRatio - 3/4) < 0.1) return '3:4 (Portrait)';
  
  return `${aspectRatio.toFixed(2)}:1`;
};
