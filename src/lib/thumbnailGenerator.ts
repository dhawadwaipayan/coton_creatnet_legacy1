// Thumbnail Generator for CotonAI Konva Boards
// Generates low-resolution previews for fast board loading

export interface ThumbnailData {
  id: string;
  dataUrl: string;
  width: number;
  height: number;
  timestamp: number;
}

export class ThumbnailGenerator {
  private static readonly THUMBNAIL_WIDTH = 300;
  private static readonly THUMBNAIL_HEIGHT = 300;
  private static readonly QUALITY = 0.6; // JPEG quality for thumbnails

  /**
   * Generate a thumbnail from canvas content
   */
  static async generateThumbnail(
    canvas: HTMLCanvasElement,
    boardId: string
  ): Promise<ThumbnailData> {
    try {
      // Create a thumbnail canvas
      const thumbnailCanvas = document.createElement('canvas');
      const ctx = thumbnailCanvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get thumbnail canvas context');
      }

      // Set thumbnail dimensions
      thumbnailCanvas.width = this.THUMBNAIL_WIDTH;
      thumbnailCanvas.height = this.THUMBNAIL_HEIGHT;

      // Calculate scale to fit content
      const scaleX = this.THUMBNAIL_WIDTH / canvas.width;
      const scaleY = this.THUMBNAIL_HEIGHT / canvas.height;
      const scale = Math.min(scaleX, scaleY);

      // Calculate centering offset
      const offsetX = (this.THUMBNAIL_WIDTH - canvas.width * scale) / 2;
      const offsetY = (this.THUMBNAIL_HEIGHT - canvas.height * scale) / 2;

      // Clear thumbnail canvas
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, this.THUMBNAIL_WIDTH, this.THUMBNAIL_HEIGHT);

      // Draw scaled content
      ctx.save();
      ctx.translate(offsetX, offsetY);
      ctx.scale(scale, scale);
      ctx.drawImage(canvas, 0, 0);
      ctx.restore();

      // Convert to data URL
      const dataUrl = thumbnailCanvas.toDataURL('image/jpeg', this.QUALITY);

      return {
        id: `${boardId}-thumb`,
        dataUrl,
        width: this.THUMBNAIL_WIDTH,
        height: this.THUMBNAIL_HEIGHT,
        timestamp: Date.now()
      };
    } catch (error) {
      console.error('Thumbnail generation failed:', error);
      throw error;
    }
  }

  /**
   * Generate thumbnail from board content (images, strokes, texts)
   */
  static async generateThumbnailFromContent(
    boardContent: any,
    boardId: string
  ): Promise<ThumbnailData> {
    try {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      
      if (!ctx) {
        throw new Error('Could not get canvas context');
      }

      // Set canvas size to board dimensions
      canvas.width = 5000; // Standard board width
      canvas.height = 5000; // Standard board height

      // Clear canvas
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // Draw grid (optional)
      this.drawGrid(ctx, canvas.width, canvas.height);

      // Draw images
      if (boardContent.images) {
        for (const imgData of boardContent.images) {
          if (imgData.image && !imgData.error) {
            try {
              ctx.drawImage(
                imgData.image,
                imgData.x,
                imgData.y,
                imgData.width || 200,
                imgData.height || 200
              );
            } catch (error) {
              console.warn('Failed to draw image in thumbnail:', error);
            }
          }
        }
      }

      // Draw strokes
      if (boardContent.strokes) {
        for (const stroke of boardContent.strokes) {
          ctx.strokeStyle = stroke.color;
          ctx.lineWidth = stroke.size;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
          
          if (stroke.points && stroke.points.length >= 2) {
            ctx.beginPath();
            ctx.moveTo(stroke.points[0], stroke.points[1]);
            
            for (let i = 2; i < stroke.points.length; i += 2) {
              ctx.lineTo(stroke.points[i], stroke.points[i + 1]);
            }
            
            ctx.stroke();
          }
        }
      }

      // Draw texts
      if (boardContent.texts) {
        for (const text of boardContent.texts) {
          ctx.fillStyle = text.color;
          ctx.font = `${text.fontSize}px Arial`;
          ctx.fillText(text.text, text.x, text.y + text.fontSize);
        }
      }

      // Generate thumbnail from the content canvas
      return await this.generateThumbnail(canvas, boardId);
    } catch (error) {
      console.error('Content-based thumbnail generation failed:', error);
      throw error;
    }
  }

  /**
   * Draw a subtle grid pattern
   */
  private static drawGrid(ctx: CanvasRenderingContext2D, width: number, height: number) {
    const gridSize = 100;
    ctx.strokeStyle = '#f0f0f0';
    ctx.lineWidth = 1;

    // Vertical lines
    for (let x = 0; x <= width; x += gridSize) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
      ctx.stroke();
    }

    // Horizontal lines
    for (let y = 0; y <= height; y += gridSize) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
      ctx.stroke();
    }
  }

  /**
   * Store thumbnail in localStorage for offline access
   */
  static storeThumbnail(boardId: string, thumbnail: ThumbnailData): void {
    try {
      const key = `thumbnail-${boardId}`;
      localStorage.setItem(key, JSON.stringify(thumbnail));
    } catch (error) {
      console.warn('Failed to store thumbnail in localStorage:', error);
    }
  }

  /**
   * Retrieve thumbnail from localStorage
   */
  static getStoredThumbnail(boardId: string): ThumbnailData | null {
    try {
      const key = `thumbnail-${boardId}`;
      const stored = localStorage.getItem(key);
      return stored ? JSON.parse(stored) : null;
    } catch (error) {
      console.warn('Failed to retrieve thumbnail from localStorage:', error);
      return null;
    }
  }

  /**
   * Clear old thumbnails (keep only last 50)
   */
  static cleanupOldThumbnails(): void {
    try {
      const thumbnails: Array<{ key: string; timestamp: number }> = [];
      
      // Collect all thumbnail keys and timestamps
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith('thumbnail-')) {
          try {
            const thumbnail = JSON.parse(localStorage.getItem(key)!);
            thumbnails.push({ key, timestamp: thumbnail.timestamp });
          } catch (error) {
            // Remove invalid entries
            localStorage.removeItem(key);
          }
        }
      }

      // Sort by timestamp and remove old ones
      thumbnails.sort((a, b) => b.timestamp - a.timestamp);
      
      for (let i = 50; i < thumbnails.length; i++) {
        localStorage.removeItem(thumbnails[i].key);
      }
    } catch (error) {
      console.warn('Failed to cleanup old thumbnails:', error);
    }
  }
}
