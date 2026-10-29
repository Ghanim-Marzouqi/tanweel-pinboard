/** Throwaway admin, created on the first run against the e2e test database. */
export const E2E_ADMIN = {
  username: process.env.E2E_ADMIN_USERNAME ?? 'e2e-admin',
  password: process.env.E2E_ADMIN_PASSWORD ?? 'e2e-admin-password',
};
