import React from 'react';
import { SchoolSettings, Student, TeacherStaff } from '../../types';
import { useIdCardQr } from '../../services/idCardQrService';
import { TeacherIdCard } from './TeacherIdCard';
import {
  BackHeader,
  BottomWave,
  CardBody,
  CardFrame,
  CardSide,
  CardSides,
  DetailTable,
  FrontHeader,
  NameBlock,
  PhotoBadge,
  QrBlock,
  SignatureBlock,
  displayValue,
  formatCardDate,
  schoolIdentity,
} from './idcard/IdCardDesign';

interface StudentIdCardProps {
  student?: Student | null;
  staff?: TeacherStaff | null;
  settings: SchoolSettings;
  side?: CardSide;
  scale?: number;
  idPrefix?: string;
}

/**
 * Student ID card (front and back). The back carries a signed QR code that
 * teachers scan to mark the student's attendance; it holds no personal data.
 */
export const StudentIdCard: React.FC<StudentIdCardProps> = ({ student, staff, settings, side = 'both', idPrefix = 'card' }) => {
  if (staff && !student) {
    return <TeacherIdCard staff={staff} settings={settings} side={side} idPrefix={idPrefix} />;
  }
  return student ? <StudentCard student={student} settings={settings} side={side} idPrefix={idPrefix} /> : null;
};

const StudentCard: React.FC<{ student: Student; settings: SchoolSettings; side: CardSide; idPrefix: string }> = ({ student, settings, side, idPrefix }) => {
  const qr = useIdCardQr('STUDENT', student.id);
  const school = schoolIdentity(settings);
  const s: any = student;
  const mobile = s.fatherMobile || s.parentPhone || s.guardianMobile || s.motherMobile || s.mobile || '';
  const name = student.name || '';

  const front = (
    <CardFrame id={`${idPrefix}-front`} label={`Student ID card front, ${name}`}>
      <FrontHeader school={school} title="Student Identity Card" />
      <CardBody top={150} gap={8}>
        <PhotoBadge photoKey={student.photo || student.photoFileKey} name={name} bloodGroup={student.bloodGroup} size={132} />
        <NameBlock name={displayValue(name)} />
        <DetailTable
          rows={[
            ['Student ID', displayValue(student.admissionNumber)],
            ['Class', displayValue(student.className)],
            ['Section', displayValue(student.section)],
            ['Roll no', displayValue(student.rollNumber)],
            ['DOB', formatCardDate(student.dob)],
          ]}
        />
      </CardBody>
      <BottomWave />
    </CardFrame>
  );

  const back = (
    <CardFrame id={`${idPrefix}-back`} label={`Student ID card back, ${name}`}>
      <BackHeader school={school} />
      <CardBody top={142} gap={12}>
        <DetailTable
          width={300}
          labelWidth={112}
          valueLines={2}
          rows={[
            ['School Name', school.name],
            ["Father's Name", displayValue(student.fatherName || s.parentName)],
            ['Mobile', displayValue(mobile)],
            ['Address', displayValue(student.address)],
          ]}
        />
        <QrBlock qr={qr} />
        <SignatureBlock school={school} />
      </CardBody>
      <BottomWave />
    </CardFrame>
  );

  return <CardSides side={side} front={front} back={back} label={`Student ID card of ${name}`} />;
};
