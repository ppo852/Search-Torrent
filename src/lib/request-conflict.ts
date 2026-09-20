/** Conflit médiathèque — déjà présent dans Emby. */
export function isAlreadyPresentConflict(error: unknown): boolean {
  return typeof error === 'object'
    && error !== null
    && 'status' in error
    && (error as { status?: number }).status === 409;
}
