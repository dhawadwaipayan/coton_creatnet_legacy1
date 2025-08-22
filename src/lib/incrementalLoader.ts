// Incremental Loader for CotonAI Konva Boards
// Loads board content in chunks to improve performance with large boards

export interface LoadChunk {
  images: any[];
  strokes: any[];
  texts: any[];
  chunkIndex: number;
  totalChunks: number;
}

export class IncrementalLoader {
  private static readonly CHUNK_SIZE = 50; // Items per chunk
  private static readonly CHUNK_DELAY = 100; // ms between chunks

  /**
   * Load board content incrementally in chunks
   */
  static async loadBoardIncrementally(
    boardContent: any,
    onChunkLoaded: (chunk: LoadChunk) => void,
    onComplete: () => void
  ): Promise<void> {
    try {
      const { images = [], strokes = [], texts = [] } = boardContent;
      
      // Calculate total chunks needed
      const totalItems = images.length + strokes.length + texts.length;
      const totalChunks = Math.ceil(totalItems / this.CHUNK_SIZE);
      
      if (totalChunks <= 1) {
        // Small board, load everything at once
        onChunkLoaded({
          images,
          strokes,
          texts,
          chunkIndex: 0,
          totalChunks: 1
        });
        onComplete();
        return;
      }

      // Load in chunks
      let currentChunk = 0;
      
      const loadNextChunk = async () => {
        if (currentChunk >= totalChunks) {
          onComplete();
          return;
        }

        const startIndex = currentChunk * this.CHUNK_SIZE;
        const endIndex = Math.min(startIndex + this.CHUNK_SIZE, totalItems);
        
        // Distribute items across chunks
        const chunkImages = this.getChunkItems(images, startIndex, endIndex);
        const chunkStrokes = this.getChunkItems(strokes, startIndex, endIndex);
        const chunkTexts = this.getChunkItems(texts, startIndex, endIndex);

        const chunk: LoadChunk = {
          images: chunkImages,
          strokes: chunkStrokes,
          texts: chunkTexts,
          chunkIndex: currentChunk,
          totalChunks
        };

        onChunkLoaded(chunk);
        currentChunk++;

        // Schedule next chunk with delay
        setTimeout(loadNextChunk, this.CHUNK_DELAY);
      };

      // Start loading chunks
      loadNextChunk();
    } catch (error) {
      console.error('Incremental loading failed:', error);
      onComplete(); // Still call complete to prevent hanging
    }
  }

  /**
   * Get items for a specific chunk
   */
  private static getChunkItems<T>(items: T[], startIndex: number, endIndex: number): T[] {
    return items.slice(startIndex, endIndex);
  }

  /**
   * Load images with priority based on viewport position
   */
  static async loadImagesWithPriority(
    images: any[],
    viewportCenter: { x: number; y: number },
    onImageLoaded: (image: any, index: number) => void
  ): Promise<void> {
    try {
      // Sort images by distance from viewport center
      const sortedImages = [...images].sort((a, b) => {
        const distA = this.calculateDistance(a, viewportCenter);
        const distB = this.calculateDistance(b, viewportCenter);
        return distA - distB;
      });

      // Load images with priority
      for (let i = 0; i < sortedImages.length; i++) {
        const imageData = sortedImages[i];
        
        if (imageData.src && !imageData.error) {
          try {
            const img = new window.Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
              onImageLoaded({ ...imageData, image: img }, i);
            };
            
            img.onerror = () => {
              console.warn('Failed to load image:', imageData.src);
              onImageLoaded({ ...imageData, error: true }, i);
            };
            
            // Add progressive delay for better performance
            setTimeout(() => {
              img.src = imageData.src;
            }, i * 25); // 25ms delay between loads
            
          } catch (error) {
            console.warn('Error loading image:', error);
            onImageLoaded({ ...imageData, error: true }, i);
          }
        } else {
          onImageLoaded(imageData, i);
        }
      }
    } catch (error) {
      console.error('Priority image loading failed:', error);
    }
  }

  /**
   * Calculate distance between two points
   */
  private static calculateDistance(
    point1: { x: number; y: number },
    point2: { x: number; y: number }
  ): number {
    const dx = point1.x - point2.x;
    const dy = point1.y - point2.y;
    return Math.sqrt(dx * dx + dy * dy);
  }

  /**
   * Preload critical board elements
   */
  static async preloadCriticalElements(boardContent: any): Promise<void> {
    try {
      const { images = [], strokes = [], texts = [] } = boardContent;
      
      // Preload first few images (likely to be visible)
      const criticalImages = images.slice(0, 5);
      
      for (const imgData of criticalImages) {
        if (imgData.src && !imgData.error) {
          const img = new window.Image();
          img.crossOrigin = 'anonymous';
          img.src = imgData.src;
        }
      }
      
      console.log(`Preloaded ${criticalImages.length} critical images`);
    } catch (error) {
      console.warn('Critical element preloading failed:', error);
    }
  }

  /**
   * Estimate board loading time
   */
  static estimateLoadingTime(boardContent: any): number {
    const { images = [], strokes = [], texts = [] } = boardContent;
    const totalItems = images.length + strokes.length + texts.length;
    
    // Rough estimate: 50ms per chunk + 100ms base time
    const chunks = Math.ceil(totalItems / this.CHUNK_SIZE);
    return chunks * 50 + 100;
  }
}
