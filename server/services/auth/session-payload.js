/** Payload user renvoyé au client après login / SSO. */
export function toAuthUserPayload(user) {
  return {
    id: user.id,
    username: user.username,
    is_admin: user.is_admin,
    allow_force_interactive_download: !!user.allow_force_interactive_download,
    qbit_url: user.qbit_url,
    created_at: user.created_at,
    last_seen_app_version: user.last_seen_app_version || null,
    auth_via: user.auth_via === 'organizr' ? 'organizr' : 'password',
  };
}
