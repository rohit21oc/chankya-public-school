import mongoose, { Schema } from 'mongoose';

const TransportVehicleSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    vehicleNumber: { type: String, required: true, unique: true, index: true, uppercase: true },
    busName: { type: String, default: '' },
    busCode: { type: String, default: '' },
    model: { type: String, default: '' },
    vehicleType: { type: String, default: 'BUS' },
    capacity: { type: Number, required: true },
    driverName: { type: String, required: true },
    driverPhone: { type: String, required: true },
    driverLicense: { type: String, default: '' },
    helperName: { type: String, default: '' },
    helperPhone: { type: String, default: '' },
    conductorName: { type: String, default: '' },
    conductorPhone: { type: String, default: '' },
    permitDetails: { type: String, default: '' },
    rcNumber: { type: String, default: '' },
    insuranceExpiry: { type: String, default: '' },
    pollutionExpiry: { type: String, default: '' },
    fitnessExpiry: { type: String, default: '' },
    permitExpiry: { type: String, default: '' },
    status: { type: String, enum: ['ACTIVE', 'MAINTENANCE', 'INACTIVE'], default: 'ACTIVE', index: true },
    gpsDeviceId: { type: String, default: '' },
  },
  {
    timestamps: true,
    collection: 'transport_vehicles',
    bufferCommands: false,
    bufferTimeoutMS: 0,
  }
);

const RouteStopSchema = new Schema(
  {
    id: { type: String, required: true },
    stopName: { type: String, required: true },
    landmark: { type: String, default: '' },
    pickupTime: { type: String, required: true },
    dropTime: { type: String, required: true },
    monthlyFare: { type: Number, default: 0 },
    fare: { type: Number, default: 0 },
    fee: { type: Number, default: 0 },
    stopOrder: { type: Number, default: 1 },
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE' },
    active: { type: Boolean, default: true },
    slabId: { type: String, ref: 'TransportSlab' },
    distanceKm: { type: Number, default: 0 },
  },
  { _id: false }
);

const TransportRouteSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    routeName: { type: String, required: true, trim: true, index: true },
    routeNumber: { type: String, default: '' },
    startPoint: { type: String, default: 'School Campus' },
    endPoint: { type: String, default: '' },
    vehicleId: { type: String, ref: 'TransportVehicle', default: '' },
    vehicleNumber: { type: String, default: '' },
    driverName: { type: String, default: '' },
    driverPhone: { type: String, default: '' },
    stops: [RouteStopSchema],
    status: { type: String, enum: ['ACTIVE', 'INACTIVE'], default: 'ACTIVE', index: true },
    assignedStudentsCount: { type: Number, default: 0 },
  },
  {
    timestamps: true,
    collection: 'transport_routes',
    bufferCommands: false,
    bufferTimeoutMS: 0,
  }
);

const TransportSlabSchema = new Schema(
  {
    id: { type: String, required: true, unique: true, index: true },
    name: { type: String, required: true },
    minDistanceKm: { type: Number, default: 0 },
    maxDistanceKm: { type: Number, required: true },
    monthlyFee: { type: Number, required: true },
    academicSession: { type: String, index: true },
  },
  {
    timestamps: true,
    collection: 'transport_slabs',
    bufferCommands: false,
    bufferTimeoutMS: 0,
  }
);

export const TransportVehicleModel: mongoose.Model<any> =
  mongoose.models.TransportVehicle || mongoose.model('TransportVehicle', TransportVehicleSchema);
export const TransportRouteModel: mongoose.Model<any> =
  mongoose.models.TransportRoute || mongoose.model('TransportRoute', TransportRouteSchema);
export const TransportSlabModel: mongoose.Model<any> =
  mongoose.models.TransportSlab || mongoose.model('TransportSlab', TransportSlabSchema);
