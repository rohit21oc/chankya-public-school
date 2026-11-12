import mongoose, { Schema } from 'mongoose';

const HostelSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true, trim: true, index: true },
    type: { type: String, enum: ['BOYS', 'GIRLS', 'CO_ED'], required: true },
    wardenName: { type: String, required: true },
    wardenPhone: { type: String, required: true },
    emergencyPhone: { type: String },
    address: { type: String },
    floors: [{ type: Number }],
    totalRooms: { type: Number, default: 0 },
    capacity: { type: Number, default: 0 },
    monthlyFee: { type: Number, default: 0 },
    messFee: { type: Number, default: 0 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
  },
  {
    timestamps: true,
    collection: 'hostels',
  }
);

const BedSchema = new Schema(
  {
    bedNumber: { type: String, required: true },
    allocatedStudentId: { type: String, ref: 'Student' },
    allocatedStudentName: { type: String },
    allocatedAdmissionNo: { type: String },
    allocationDate: { type: String },
    status: {
      type: String,
      enum: ['AVAILABLE', 'OCCUPIED', 'MAINTENANCE', 'INACTIVE'],
      default: 'AVAILABLE',
    },
  },
  { _id: false }
);

const HostelRoomSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    hostelId: { type: String, ref: 'Hostel', required: true, index: true },
    hostelName: { type: String },
    roomNumber: { type: String, required: true, index: true },
    floor: { type: Number, required: true, default: 1 },
    roomType: { type: String, default: 'Standard Non-AC' },
    capacity: { type: Number, default: 2 },
    capacityBeds: { type: Number, default: 2 },
    occupiedBeds: { type: Number, default: 0 },
    monthlyFee: { type: Number, default: 0 },
    amenities: [{ type: String }],
    status: {
      type: String,
      enum: ['AVAILABLE', 'FULL', 'MAINTENANCE', 'INACTIVE'],
      default: 'AVAILABLE',
      index: true,
    },
    beds: [BedSchema],
  },
  {
    timestamps: true,
    collection: 'hostel_rooms',
  }
);

HostelRoomSchema.index({ hostelId: 1, roomNumber: 1 }, { unique: true });

const HostelAllocationSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    studentId: { type: String, ref: 'Student', required: true, index: true },
    studentName: { type: String, required: true },
    admissionNumber: { type: String, required: true, index: true },
    hostelId: { type: String, ref: 'Hostel', required: true, index: true },
    hostelName: { type: String, required: true },
    roomId: { type: String, ref: 'HostelRoom', required: true, index: true },
    roomNumber: { type: String, required: true },
    floor: { type: Number, required: true },
    bedNumber: { type: String, required: true },
    allocationDate: { type: String, required: true },
    vacateDate: { type: String },
    monthlyRent: { type: Number, default: 0 },
    messFee: { type: Number, default: 0 },
    status: {
      type: String,
      enum: ['ACTIVE', 'VACATED', 'TRANSFERRED'],
      default: 'ACTIVE',
      index: true,
    },
    remarks: { type: String },
  },
  {
    timestamps: true,
    collection: 'hostel_allocations',
  }
);

// Anti-Double-Booking database level enforcement: A bed can have only ONE ACTIVE allocation at a time!
HostelAllocationSchema.index(
  { roomId: 1, bedNumber: 1, status: 1 },
  {
    unique: true,
    partialFilterExpression: { status: 'ACTIVE' },
  }
);

export const HostelModel: mongoose.Model<any> =
  mongoose.models.Hostel || mongoose.model('Hostel', HostelSchema);
export const HostelRoomModel: mongoose.Model<any> =
  mongoose.models.HostelRoom || mongoose.model('HostelRoom', HostelRoomSchema);
export const HostelAllocationModel: mongoose.Model<any> =
  mongoose.models.HostelAllocation || mongoose.model('HostelAllocation', HostelAllocationSchema);

