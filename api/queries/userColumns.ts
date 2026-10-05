/**
 * Column selection applied wherever a user row is returned through the API.
 *
 * Drizzle's `with: { user: true }` and `query.users.findMany()` select every
 * column, which includes `passwordHash` — the scrypt salt+hash. That was being
 * serialised straight to the browser by auth.me, auth.login, the admin user
 * list, organization.members, and every leads/tasks/calls/conversations/
 * appointments/dashboard query that joins an assigned user. Any authenticated
 * member of an organization could therefore read their teammates' password
 * hashes and attack them offline.
 *
 * `false` on a single column is a Drizzle exclusion: every other column is
 * still returned, so adding a column to the users table does not silently
 * start leaking it here, and callers keep the fields they already use.
 */
export const SAFE_USER_COLUMNS = { passwordHash: false } as const;
