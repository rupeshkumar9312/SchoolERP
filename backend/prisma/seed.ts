import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const ROLE_NAMES = ['SUPER_ADMIN', 'DIRECTOR', 'PRINCIPAL', 'ADMIN', 'TEACHER', 'STUDENT'] as const;

// Starter permission set — later modules add their own keys here as they land.
const PERMISSIONS: Array<{ key: string; description: string }> = [
  { key: 'user.view', description: 'View staff user accounts' },
  { key: 'user.create', description: 'Create staff user accounts' },
  { key: 'user.edit', description: 'Edit staff user accounts' },
  { key: 'user.delete', description: 'Delete staff user accounts' },
  { key: 'role.manage', description: 'Manage roles and role-permission mappings' },
  { key: 'academic.view', description: 'View academic years, classes, sections and subjects' },
  { key: 'academic.manage', description: 'Create, edit and delete academic years, classes, sections and subjects' },
  { key: 'teacher.view', description: 'View teacher profiles and assignments' },
  { key: 'teacher.create', description: 'Create teacher logins and profiles' },
  { key: 'teacher.edit', description: 'Edit teacher profiles' },
  { key: 'teacher.delete', description: 'Delete teachers (removes their login too)' },
  { key: 'teacher.assign', description: 'Assign or unassign a teacher to a class, section and subject' },
  { key: 'student.view', description: 'View student records' },
  { key: 'student.create', description: 'Admit new students' },
  { key: 'student.edit', description: 'Edit student records' },
  { key: 'student.delete', description: 'Delete student records' },
  { key: 'attendance.student.view', description: 'View student attendance records' },
  { key: 'attendance.student.mark', description: 'Mark student attendance for a class/section' },
  { key: 'attendance.student.edit', description: 'Edit an existing student attendance record' },
  { key: 'attendance.teacher.view', description: 'View staff attendance records' },
  { key: 'attendance.teacher.mark', description: 'Mark staff attendance (own, or any staff member for admins)' },
  { key: 'assignment.view', description: 'View class assignments (own for a teacher, all for admin roles)' },
  { key: 'assignment.create', description: 'Create a class assignment' },
  { key: 'assignment.edit', description: 'Edit a class assignment (teacher may only edit their own)' },
  { key: 'assignment.delete', description: 'Delete a class assignment (teacher may only delete their own)' },
  { key: 'announcement.create', description: 'Post an announcement/notice' },
  { key: 'announcement.edit', description: 'Edit an announcement/notice' },
  { key: 'announcement.delete', description: 'Delete an announcement/notice' },
];

// Director/Principal/Admin share one "Management" permission set per the
// Module 1 spec. SUPER_ADMIN needs no explicit mapping — PermissionsService
// grants it every permission unconditionally.
const MANAGEMENT_ROLES = ['DIRECTOR', 'PRINCIPAL', 'ADMIN'] as const;
const MANAGEMENT_PERMISSION_KEYS = PERMISSIONS.map((p) => p.key);

// TEACHER gets exactly the attendance permissions — marking attendance for
// their own assigned classes is their core daily task. AttendanceService
// scopes *which* classes/sections/dates they may touch; the permission just
// gets them past the guard. TEACHER has no other permissions.
const TEACHER_PERMISSION_KEYS = [
  'attendance.student.view',
  'attendance.student.mark',
  'attendance.student.edit',
  'attendance.teacher.view',
  'attendance.teacher.mark',
  'assignment.view',
  'assignment.create',
  'assignment.edit',
  'assignment.delete',
];

const SUPER_ADMIN_EMAIL = 'admin@schoolerp.dev';
const SUPER_ADMIN_PASSWORD = 'ChangeMe123!';
// Reserved, not drawn from the IdSequence counter (which starts real ADM
// numbering at 001) — this is the one hardcoded bootstrap login, kept as a
// well-known documented credential rather than generated like every other
// account UsersService.create() provisions from here on. Width matches
// generate-edvance-id.ts's 3-digit ADM format.
const SUPER_ADMIN_EDVANCE_ID = 'EDV-ADM-000';

const ID_SEQUENCE_PREFIXES = ['ADM', 'TCH', 'STU'] as const;

async function main() {
  const roles = new Map<string, number>();
  for (const name of ROLE_NAMES) {
    const role = await prisma.role.upsert({ where: { name }, update: {}, create: { name } });
    roles.set(name, role.id);
  }

  const permissions = new Map<string, number>();
  for (const p of PERMISSIONS) {
    const permission = await prisma.permission.upsert({
      where: { key: p.key },
      update: { description: p.description },
      create: p,
    });
    permissions.set(p.key, permission.id);
  }

  for (const roleName of MANAGEMENT_ROLES) {
    const roleId = roles.get(roleName)!;
    for (const key of MANAGEMENT_PERMISSION_KEYS) {
      const permissionId = permissions.get(key)!;
      await prisma.rolePermission.upsert({
        where: { roleId_permissionId: { roleId, permissionId } },
        update: {},
        create: { roleId, permissionId },
      });
    }
  }

  const teacherRoleId = roles.get('TEACHER')!;
  for (const key of TEACHER_PERMISSION_KEYS) {
    const permissionId = permissions.get(key)!;
    await prisma.rolePermission.upsert({
      where: { roleId_permissionId: { roleId: teacherRoleId, permissionId } },
      update: {},
      create: { roleId: teacherRoleId, permissionId },
    });
  }

  for (const prefix of ID_SEQUENCE_PREFIXES) {
    await prisma.idSequence.upsert({
      where: { prefix },
      update: {},
      create: { prefix, lastValue: 0 },
    });
  }

  const superAdminRoleId = roles.get('SUPER_ADMIN')!;
  const passwordHash = await bcrypt.hash(SUPER_ADMIN_PASSWORD, 10);
  await prisma.user.upsert({
    where: { email: SUPER_ADMIN_EMAIL },
    update: {},
    create: {
      email: SUPER_ADMIN_EMAIL,
      edvanceId: SUPER_ADMIN_EDVANCE_ID,
      passwordHash,
      name: 'Super Admin',
      roleId: superAdminRoleId,
    },
  });

  console.log('Seed complete.');
  console.log(`  Roles:       ${ROLE_NAMES.join(', ')}`);
  console.log(`  Permissions: ${PERMISSIONS.map((p) => p.key).join(', ')}`);
  console.log(`  Login:       ${SUPER_ADMIN_EMAIL} / ${SUPER_ADMIN_PASSWORD}`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
