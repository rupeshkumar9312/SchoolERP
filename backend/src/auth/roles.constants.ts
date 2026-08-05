/** Seeded once by prisma/seed.ts. SUPER_ADMIN is the only name with special,
 * hardcoded behaviour (it bypasses PermissionGuard entirely); the rest are
 * plain data rows an admin can extend later via Module 12's role UI. */
export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

/** The role every row created through POST /teachers is hard-wired to. */
export const TEACHER_ROLE = 'TEACHER';
