import { useEffect, useState } from 'react';
import * as academic from '../../api/academic';
import { listMyClassTeacherOf } from '../../api/teachers';
import { useAuth } from '../../auth/useAuth';

export interface ClassSectionOption {
  classId: number;
  className: string;
  sectionId: number;
  sectionName: string;
}

/** Picking a class+section for attendance needs different data depending on
 * who's asking: admins can browse the full academic structure (they hold
 * academic.view), but a TEACHER doesn't — and even among teachers, only the
 * class (homeroom) teacher of a section may mark its attendance, not every
 * subject teacher assigned there. So for a TEACHER we derive the picker from
 * GET /teachers/me/class-teacher-of, not GET /teachers/me/assignments. */
export function useClassSectionScope() {
  const { hasPermission } = useAuth();
  const canBrowseAcademicStructure = hasPermission('academic.view');

  const [years, setYears] = useState<academic.AcademicYear[]>([]);
  const [classes, setClasses] = useState<academic.SchoolClass[]>([]);
  const [sections, setSections] = useState<academic.Section[]>([]);
  const [myOptions, setMyOptions] = useState<ClassSectionOption[]>([]);

  const [yearId, setYearId] = useState('');
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');

  useEffect(() => {
    if (canBrowseAcademicStructure) {
      void academic.listAcademicYears().then(setYears);
      return;
    }
    void listMyClassTeacherOf().then((sections) => {
      setMyOptions(
        sections.map((s) => ({
          classId: s.class.id,
          className: s.class.name,
          sectionId: s.section.id,
          sectionName: s.section.name,
        })),
      );
    });
  }, [canBrowseAcademicStructure]);

  useEffect(() => {
    if (!canBrowseAcademicStructure || !yearId) {
      setClasses([]);
      return;
    }
    void academic.listClasses(Number(yearId)).then(setClasses);
  }, [canBrowseAcademicStructure, yearId]);

  useEffect(() => {
    if (!canBrowseAcademicStructure || !classId) {
      setSections([]);
      return;
    }
    void academic.listSections(Number(classId)).then(setSections);
  }, [canBrowseAcademicStructure, classId]);

  const selectMyOption = (key: string) => {
    const opt = myOptions.find((o) => `${o.classId}-${o.sectionId}` === key);
    setClassId(opt ? String(opt.classId) : '');
    setSectionId(opt ? String(opt.sectionId) : '');
  };

  return {
    canBrowseAcademicStructure,
    years,
    classes,
    sections,
    myOptions,
    yearId,
    setYearId,
    classId,
    setClassId,
    sectionId,
    setSectionId,
    selectMyOption,
  };
}
