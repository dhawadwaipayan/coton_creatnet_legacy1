// Board URL utilities for URL-based board navigation

/**
 * Generate a board URL from board ID
 */
export function getBoardUrl(boardId: string): string {
  return `/board/${boardId}`;
}

/**
 * Extract board ID from URL path
 */
export function extractBoardIdFromPath(pathname: string): string | null {
  const match = pathname.match(/^\/board\/([a-f0-9-]+)$/);
  return match ? match[1] : null;
}

/**
 * Check if a path is a board URL
 */
export function isBoardUrl(pathname: string): boolean {
  return pathname.startsWith('/board/') && pathname !== '/board/';
}

/**
 * Validate board ID format (UUID)
 */
export function isValidBoardId(boardId: string): boolean {
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  return uuidRegex.test(boardId);
}

/**
 * Navigate to board URL with validation
 */
export function navigateToBoard(navigate: (path: string) => void, boardId: string): void {
  if (isValidBoardId(boardId)) {
    navigate(getBoardUrl(boardId));
  } else {
    console.error('Invalid board ID format:', boardId);
  }
}
