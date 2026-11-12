import React from 'react';
import { SchoolSettings, TeacherStaff } from '../../types';
import { useIdCardQr } from '../../services/idCardQrService';
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
  titleCase,
} from './idcard/IdCardDesign';

interface TeacherIdCardProps {
  staff: TeacherStaff;
  settings: SchoolSettings;
  side?: CardSide;
  idPrefix?: string;
}

/** Subjects shown on the card: expertise first, then assigned subjects (at most two). */
export function staffCardSubjects(staff: Partial<TeacherStaff>): string {
  const list = [
    ...(staff.subjectExpertise || []),
    ...(staff.assignedPrimarySubject ? [staff.assignedPrimarySubject] : []),
    ...(staff.assignedSubjects || []),
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean);
  return Array.from(new Set(list)).slice(0, 2).join(', ');
}

/**
 * Faculty / staff ID card (front and back). The back carries a signed QR code
 * that administrators scan to mark staff attendance; it holds no personal data.
 */
export const TeacherIdCard: React.FC<TeacherIdCardProps> = React.memo(({ staff, settings, side = 'both', idPrefix = 'staff-card' }) => {
  const qr = useIdCardQr('STAFF', staff?.id);
  if (!staff) return null;
  const school = schoolIdentity(settings);
  const name = staff.name || '';
  const department = titleCase(staff.customDepartment || staff.department);

  const front = (
    <CardFrame id={`${idPrefix}-front`} label={`Staff ID card front, ${name}`}>
      <FrontHeader school={school} title="Faculty / Staff Identity Card" />
      <CardBody top={150} gap={8}>
        <PhotoBadge photoKey={staff.photo || staff.photoFileKey} name={name} bloodGroup={staff.bloodGroup} size={140} />
        <NameBlock
          name={displayValue(name)}
          subtitle={
            <span className="uppercase">
              Designation: <span style={{ fontWeight: 600 }}>{displayValue(staff.designation)}</span>
            </span>
          }
        />
        <DetailTable
          rows={[
            ['Staff ID', displayValue(staff.employeeId)],
            ['Subject', displayValue(staffCardSubjects(staff))],
            ['DOB', formatCardDate(staff.dob)],
          ]}
        />
      </CardBody>
      <BottomWave />
    </CardFrame>
  );

  const back = (
    <CardFrame id={`${idPrefix}-back`} label={`Staff ID card back, ${name}`}>
      <BackHeader school={school} />
      <CardBody top={142} gap={12}>
        <DetailTable
          width={300}
          labelWidth={106}
          valueLines={2}
          rows={[
            ['School Name', school.name],
            ['Department', displayValue(department)],
            ['Mobile', displayValue(staff.phone)],
            ['Email', displayValue(staff.email)],
          ]}
        />
        <QrBlock qr={qr} />
        <SignatureBlock school={school} />
      </CardBody>
      <BottomWave />
    </CardFrame>
  );

  return <CardSides side={side} front={front} back={back} label={`Staff ID card of ${name}`} />;
});
