/** Seeded once by prisma/seed.ts. SUPER_ADMIN is the only name with special,
 * hardcoded behaviour (it bypasses PermissionGuard entirely); the rest are
 * plain data rows an admin can extend later via Module 12's role UI. */
export const SUPER_ADMIN_ROLE = 'SUPER_ADMIN';

/** The role every row created through POST /teachers is hard-wired to. */
export const TEACHER_ROLE = 'TEACHER';

/** The role every login provisioned by StudentsService.create() is hard-wired to. */
export const STUDENT_ROLE = 'STUDENT';

/** Directors/Principals/Admins share the seeded "Management" permission set. */
export const MANAGEMENT_ROLES = ['DIRECTOR', 'PRINCIPAL', 'ADMIN'] as const;

/** Every role creatable through POST /users — i.e. every login that gets an
 * 'ADM'-prefixed Edvance ID and a name-derived @admin.edvance.edu email
 * (see UsersService.create()). */
export const ADMIN_TIER_ROLES = [SUPER_ADMIN_ROLE, ...MANAGEMENT_ROLES] as const;
