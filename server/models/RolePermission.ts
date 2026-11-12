import mongoose, { Schema, Document } from 'mongoose';
import { UserRole } from '../../src/types/index.ts';

export interface RolePermissionDoc extends Document {
  role: UserRole;
  permissions: string[];
  updatedAt: Date;
}

const RolePermissionSchema = new Schema(
  {
    role: { type: String, required: true, unique: true, index: true },
    permissions: [{ type: String, required: true }],
  },
  { timestamps: true, collection: 'role_permissions' }
);

export const RolePermissionModel: mongoose.Model<any> =
  mongoose.models.RolePermission || mongoose.model('RolePermission', RolePermissionSchema);
