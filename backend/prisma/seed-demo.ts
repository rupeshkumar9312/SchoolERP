// Demo/test dataset — separate from prisma/seed.ts (roles/permissions/SUPER_ADMIN),
// which every environment needs. This script is optional and adds realistic
// classes, subjects, teachers, students, attendance history and exams so the
// app has something to look at. Safe to re-run: every write is an upsert
// keyed on the same unique constraints the app itself relies on.
import { AttendanceStatus, PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';

const prisma = new PrismaClient();

const TEACHER_PASSWORD = 'Demo@1234';
const PASSWORD_BCRYPT_ROUNDS = 10;
const ATTENDANCE_DAYS = 7;

const SUBJECT_NAMES = ['Mathematics', 'Science', 'English', 'Social Studies'];

interface ClassPlan {
  name: string;
  sections: string[];
}

const CLASS_PLAN: ClassPlan[] = [
  { name: 'Class 1', sections: ['A', 'B'] },
  { name: 'Class 2', sections: ['A', 'B'] },
  { name: 'Class 3', sections: ['A', 'B'] },
];

interface TeacherPlan {
  name: string;
  email: string;
  qualification: string;
  /** classIndex/sectionIndex into CLASS_PLAN this teacher is class teacher of, or undefined for a floating subject teacher. */
  classTeacherOf?: { classIndex: number; sectionIndex: number };
  /** Subjects taught, each in one or more (classIndex, sectionIndex) pairs. */
  teaches: Array<{ subject: string; in: Array<{ classIndex: number; sectionIndex: number }> }>;
}

const TEACHER_PLAN: TeacherPlan[] = [
  {
    name: 'Ananya Sharma',
    email: 'ananya.sharma@demo.schoolerp.dev',
    qualification: 'M.Sc Mathematics, B.Ed',
    classTeacherOf: { classIndex: 0, sectionIndex: 0 },
    teaches: [{ subject: 'Mathematics', in: [{ classIndex: 0, sectionIndex: 0 }] }],
  },
  {
    name: 'Rahul Verma',
    email: 'rahul.verma@demo.schoolerp.dev',
    qualification: 'M.Sc Physics, B.Ed',
    classTeacherOf: { classIndex: 0, sectionIndex: 1 },
    teaches: [{ subject: 'Science', in: [{ classIndex: 0, sectionIndex: 1 }] }],
  },
  {
    name: 'Priya Nair',
    email: 'priya.nair@demo.schoolerp.dev',
    qualification: 'M.A English, B.Ed',
    classTeacherOf: { classIndex: 1, sectionIndex: 0 },
    teaches: [{ subject: 'English', in: [{ classIndex: 1, sectionIndex: 0 }] }],
  },
  {
    name: 'Vikram Singh',
    email: 'vikram.singh@demo.schoolerp.dev',
    qualification: 'M.Sc Mathematics, B.Ed',
    classTeacherOf: { classIndex: 1, sectionIndex: 1 },
    teaches: [{ subject: 'Mathematics', in: [{ classIndex: 1, sectionIndex: 1 }] }],
  },
  {
    name: 'Sneha Iyer',
    email: 'sneha.iyer@demo.schoolerp.dev',
    qualification: 'M.Sc Chemistry, B.Ed',
    classTeacherOf: { classIndex: 2, sectionIndex: 0 },
    teaches: [{ subject: 'Science', in: [{ classIndex: 2, sectionIndex: 0 }] }],
  },
  {
    name: 'Arjun Mehta',
    email: 'arjun.mehta@demo.schoolerp.dev',
    qualification: 'M.A History, B.Ed',
    classTeacherOf: { classIndex: 2, sectionIndex: 1 },
    teaches: [{ subject: 'Social Studies', in: [{ classIndex: 2, sectionIndex: 1 }] }],
  },
  {
    name: 'Kavita Rao',
    email: 'kavita.rao@demo.schoolerp.dev',
    qualification: 'M.A English Literature, B.Ed',
    teaches: [
      {
        subject: 'English',
        in: [
          { classIndex: 0, sectionIndex: 0 },
          { classIndex: 0, sectionIndex: 1 },
          { classIndex: 2, sectionIndex: 0 },
          { classIndex: 2, sectionIndex: 1 },
        ],
      },
    ],
  },
  {
    name: 'Manoj Kumar',
    email: 'manoj.kumar@demo.schoolerp.dev',
    qualification: 'M.A Political Science, B.Ed',
    teaches: [
      {
        subject: 'Social Studies',
        in: [
          { classIndex: 0, sectionIndex: 0 },
          { classIndex: 0, sectionIndex: 1 },
          { classIndex: 1, sectionIndex: 0 },
          { classIndex: 1, sectionIndex: 1 },
        ],
      },
    ],
  },
];

const STUDENT_FIRST_NAMES = [
  'Aarav', 'Vivaan', 'Aditya', 'Ishaan', 'Kabir', 'Reyansh', 'Arnav', 'Dhruv',
  'Ananya', 'Diya', 'Saanvi', 'Myra', 'Aadhya', 'Kiara', 'Riya', 'Meera',
  'Advait', 'Sai', 'Vihaan', 'Arjun', 'Anika', 'Ira', 'Navya', 'Pari',
  'Rohan', 'Karan', 'Yash', 'Nikhil', 'Tara', 'Sara', 'Zara', 'Aisha',
  'Krish', 'Aryan', 'Devansh', 'Om', 'Larisa', 'Naina', 'Siya', 'Avni',
  'Rudra', 'Shaurya',
];
const STUDENT_LAST_NAMES = [
  'Sharma', 'Verma', 'Gupta', 'Reddy', 'Nair', 'Iyer', 'Mehta', 'Singh',
  'Rao', 'Kapoor', 'Joshi', 'Bhatt', 'Malhotra', 'Chopra', 'Desai', 'Pillai',
];
const STUDENTS_PER_SECTION = 7;

function utcDateDaysAgo(daysAgo: number): Date {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - daysAgo);
  return new Date(d.toISOString().slice(0, 10));
}

/** Weighted pick: mostly PRESENT, occasional ABSENT/LATE/LEAVE. */
function randomStatus(presentWeight: number): AttendanceStatus {
  const r = Math.random();
  if (r < presentWeight) return 'PRESENT';
  if (r < presentWeight + 0.06) return 'ABSENT';
  if (r < presentWeight + 0.09) return 'LATE';
  return 'LEAVE';
}

async function main() {
  let year = await prisma.academicYear.findFirst({ where: { isCurrent: true } });
  if (!year) {
    // Indian school year: April–March. `now` in Jan–Mar belongs to the year
    // that started the previous April.
    const now = new Date();
    const startYear = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
    const name = `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
    year = await prisma.academicYear.upsert({
      where: { name },
      update: { isCurrent: true },
      create: { name, isCurrent: true },
    });
    console.log(`No academic year was marked current — created and set "${name}" as current.`);
  }
  console.log(`Using current academic year: ${year.name}`);

  // ---- Classes, sections, subjects ----
  const classIds: number[] = [];
  const sectionIds: number[][] = [];
  const subjectIdByClassAndName: Array<Record<string, number>> = [];

  for (const plan of CLASS_PLAN) {
    const klass = await prisma.class.upsert({
      where: { academicYearId_name: { academicYearId: year.id, name: plan.name } },
      update: {},
      create: { name: plan.name, academicYearId: year.id },
    });
    classIds.push(klass.id);

    const secIds: number[] = [];
    for (const sectionName of plan.sections) {
      const section = await prisma.section.upsert({
        where: { classId_name: { classId: klass.id, name: sectionName } },
        update: {},
        create: { name: sectionName, classId: klass.id },
      });
      secIds.push(section.id);
    }
    sectionIds.push(secIds);

    const subjectsByName: Record<string, number> = {};
    for (const subjectName of SUBJECT_NAMES) {
      const subject = await prisma.subject.upsert({
        where: { classId_name: { classId: klass.id, name: subjectName } },
        update: {},
        create: { name: subjectName, classId: klass.id },
      });
      subjectsByName[subjectName] = subject.id;
    }
    subjectIdByClassAndName.push(subjectsByName);
  }
  console.log(`Classes ready: ${CLASS_PLAN.map((c) => c.name).join(', ')}`);

  // ---- Teachers + assignments + class-teacher hand-off ----
  const teacherRole = await prisma.role.findUnique({ where: { name: 'TEACHER' } });
  if (!teacherRole) throw new Error('TEACHER role is not seeded — run `npm run db:seed` first.');

  const passwordHash = await bcrypt.hash(TEACHER_PASSWORD, PASSWORD_BCRYPT_ROUNDS);
  const credentials: Array<{ name: string; email: string; role: string }> = [];

  for (const [index, plan] of TEACHER_PLAN.entries()) {
    // Literal, memorable demo emails stay as-is (this script's whole point is
    // human-readable manual-testing logins, not exercising the real
    // generated-Edvance-ID path) — just reserve a distinct edvanceId per
    // teacher since the column is now required+unique. 'DEMOxx' can never
    // collide with the real numeric counter (see generate-edvance-id.ts).
    const edvanceId = `EDV-TCH-DEMO${String(index + 1).padStart(2, '0')}`;
    const user = await prisma.user.upsert({
      where: { email: plan.email },
      update: {},
      create: { name: plan.name, email: plan.email, edvanceId, passwordHash, roleId: teacherRole.id },
    });
    const teacher = await prisma.teacher.upsert({
      where: { userId: user.id },
      update: {},
      create: { userId: user.id, qualification: plan.qualification, joiningDate: new Date('2024-06-01') },
    });

    for (const { subject, in: locations } of plan.teaches) {
      for (const { classIndex, sectionIndex } of locations) {
        const classId = classIds[classIndex];
        const sectionId = sectionIds[classIndex][sectionIndex];
        const subjectId = subjectIdByClassAndName[classIndex][subject];
        await prisma.teacherClassSubject.upsert({
          where: {
            teacherId_classId_sectionId_subjectId: { teacherId: teacher.id, classId, sectionId, subjectId },
          },
          update: {},
          create: { teacherId: teacher.id, classId, sectionId, subjectId },
        });
      }
    }

    let roleLabel = 'Subject teacher';
    if (plan.classTeacherOf) {
      const sectionId = sectionIds[plan.classTeacherOf.classIndex][plan.classTeacherOf.sectionIndex];
      await prisma.section.update({ where: { id: sectionId }, data: { classTeacherId: teacher.id } });
      const className = CLASS_PLAN[plan.classTeacherOf.classIndex].name;
      const sectionName = CLASS_PLAN[plan.classTeacherOf.classIndex].sections[plan.classTeacherOf.sectionIndex];
      roleLabel = `Class teacher — ${className} ${sectionName}`;
    }
    credentials.push({ name: plan.name, email: plan.email, role: roleLabel });
  }
  console.log(`Teachers ready: ${TEACHER_PLAN.length}`);

  // ---- Students ----
  let nameCursor = 0;
  let admissionCounter = 1;
  const studentsBySection: number[][][] = CLASS_PLAN.map((plan) => plan.sections.map(() => []));

  for (let ci = 0; ci < CLASS_PLAN.length; ci++) {
    for (let si = 0; si < CLASS_PLAN[ci].sections.length; si++) {
      const classId = classIds[ci];
      const sectionId = sectionIds[ci][si];
      for (let n = 0; n < STUDENTS_PER_SECTION; n++) {
        const first = STUDENT_FIRST_NAMES[nameCursor % STUDENT_FIRST_NAMES.length];
        const last = STUDENT_LAST_NAMES[(nameCursor * 7) % STUDENT_LAST_NAMES.length];
        const admissionNo = `DEMO-${String(admissionCounter).padStart(4, '0')}`;
        const student = await prisma.student.upsert({
          where: { admissionNo },
          update: {},
          create: {
            admissionNo,
            name: `${first} ${last}`,
            classId,
            sectionId,
            gender: nameCursor % 2 === 0 ? 'Female' : 'Male',
            guardianName: `${last} Family`,
          },
        });
        studentsBySection[ci][si].push(student.id);
        nameCursor++;
        admissionCounter++;
      }
    }
  }
  console.log(`Students ready: ${admissionCounter - 1}`);

  // ---- Attendance history (students + teachers), last N days ----
  const teacherAndUserIdByEmail = new Map<string, { teacherId: number; userId: number }>();
  for (const plan of TEACHER_PLAN) {
    const user = await prisma.user.findUniqueOrThrow({ where: { email: plan.email } });
    const teacher = await prisma.teacher.findUniqueOrThrow({ where: { userId: user.id } });
    teacherAndUserIdByEmail.set(plan.email, { teacherId: teacher.id, userId: user.id });
  }

  const classTeacherUserIdBySection = new Map<number, number>();
  for (const plan of TEACHER_PLAN) {
    if (!plan.classTeacherOf) continue;
    const sectionId = sectionIds[plan.classTeacherOf.classIndex][plan.classTeacherOf.sectionIndex];
    classTeacherUserIdBySection.set(sectionId, teacherAndUserIdByEmail.get(plan.email)!.userId);
  }

  for (let dayAgo = 0; dayAgo < ATTENDANCE_DAYS; dayAgo++) {
    const date = utcDateDaysAgo(dayAgo);

    for (const plan of TEACHER_PLAN) {
      const { teacherId, userId } = teacherAndUserIdByEmail.get(plan.email)!;
      await prisma.teacherAttendance.upsert({
        where: { teacherId_date: { teacherId, date } },
        update: {},
        create: { teacherId, date, status: randomStatus(0.88), markedById: userId },
      });
    }

    for (let ci = 0; ci < CLASS_PLAN.length; ci++) {
      for (let si = 0; si < CLASS_PLAN[ci].sections.length; si++) {
        const classId = classIds[ci];
        const sectionId = sectionIds[ci][si];
        const markedById = classTeacherUserIdBySection.get(sectionId);
        if (!markedById) continue;

        for (const studentId of studentsBySection[ci][si]) {
          await prisma.studentAttendance.upsert({
            where: { studentId_date: { studentId, date } },
            update: {},
            create: { studentId, date, classId, sectionId, status: randomStatus(0.85), markedById },
          });
        }
      }
    }
  }
  console.log(`Attendance history seeded for the last ${ATTENDANCE_DAYS} days.`);

  // ---- Exams: one umbrella + one schedule per class (all subjects, every
  // student marked) — gives the Exams/Results/report-card screens something
  // real to show. Unit Test 1 is fully graded and published; Half-Yearly
  // Exam is fully graded but left as a draft, so the Publish button on the
  // schedule page has something to actually do.
  const superAdmin = await prisma.user.findFirst({ where: { role: { name: 'SUPER_ADMIN' } } });
  if (!superAdmin) throw new Error('No SUPER_ADMIN user found — run `npm run db:seed` first.');

  interface ExamPlan {
    name: string;
    type: 'UNIT_TEST' | 'TERM_EXAM';
    maxMarks: number;
    passMarks: number;
    publish: boolean;
  }
  const EXAM_PLAN: ExamPlan[] = [
    { name: 'Unit Test 1', type: 'UNIT_TEST', maxMarks: 25, passMarks: 10, publish: true },
    { name: 'Half-Yearly Exam', type: 'TERM_EXAM', maxMarks: 80, passMarks: 32, publish: false },
  ];

  /** Skewed toward a decent score (50%-98% of max), with an occasional
   * absence — realistic-looking rather than uniformly random. */
  function randomMark(maxMarks: number): { marksObtained: number | null; isAbsent: boolean } {
    if (Math.random() < 0.03) return { marksObtained: null, isAbsent: true };
    const pct = 0.5 + Math.random() * 0.48;
    return { marksObtained: Math.min(maxMarks, Math.round(maxMarks * pct)), isAbsent: false };
  }

  for (const examPlan of EXAM_PLAN) {
    // No unique constraint on Exam.name (by design — nothing stops two
    // unrelated exams sharing a name), so re-run safety here is a manual
    // find-or-create rather than a real upsert.
    let exam = await prisma.exam.findFirst({ where: { name: examPlan.name } });
    if (!exam) {
      exam = await prisma.exam.create({ data: { name: examPlan.name, type: examPlan.type, createdById: superAdmin.id } });
    }

    for (let ci = 0; ci < CLASS_PLAN.length; ci++) {
      const classId = classIds[ci];
      const schedule = await prisma.examSchedule.upsert({
        where: { examId_classId: { examId: exam.id, classId } },
        update: {},
        create: {
          examId: exam.id,
          classId,
          startDate: utcDateDaysAgo(21),
          endDate: utcDateDaysAgo(14),
          status: examPlan.publish ? 'PUBLISHED' : 'DRAFT',
          createdById: superAdmin.id,
        },
      });

      const examSubjectIdByName: Record<string, number> = {};
      for (const subjectName of SUBJECT_NAMES) {
        const subjectId = subjectIdByClassAndName[ci][subjectName];
        const examSubject = await prisma.examSubject.upsert({
          where: { examScheduleId_subjectId: { examScheduleId: schedule.id, subjectId } },
          update: {},
          create: { examScheduleId: schedule.id, subjectId, maxMarks: examPlan.maxMarks, passMarks: examPlan.passMarks },
        });
        examSubjectIdByName[subjectName] = examSubject.id;
      }

      for (let si = 0; si < CLASS_PLAN[ci].sections.length; si++) {
        const sectionId = sectionIds[ci][si];
        for (const studentId of studentsBySection[ci][si]) {
          for (const subjectName of SUBJECT_NAMES) {
            const examSubjectId = examSubjectIdByName[subjectName];
            const { marksObtained, isAbsent } = randomMark(examPlan.maxMarks);
            await prisma.examMark.upsert({
              where: { examSubjectId_studentId: { examSubjectId, studentId } },
              update: {},
              create: { examSubjectId, studentId, sectionId, marksObtained, isAbsent },
            });
          }
        }
      }
    }
  }
  console.log(`Exams ready: ${EXAM_PLAN.map((e) => e.name).join(', ')}`);

  console.log('\n=== Demo teacher credentials (password is the same for all) ===');
  console.log(`Password: ${TEACHER_PASSWORD}\n`);
  const nameWidth = Math.max(...credentials.map((c) => c.name.length), 4);
  const emailWidth = Math.max(...credentials.map((c) => c.email.length), 5);
  for (const c of credentials) {
    console.log(`${c.name.padEnd(nameWidth)}  ${c.email.padEnd(emailWidth)}  ${c.role}`);
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
