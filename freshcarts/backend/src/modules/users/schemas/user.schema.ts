import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Language, Role } from 'src/common/enums';
import { PK_MOBILE_E164 } from 'src/common/utils';

export type UserDocument = HydratedDocument<User>;

/**
 * The account record for every role in the platform.
 *
 * Identity decision: `phone` is the primary login identifier (Pakistani grocery
 * shoppers overwhelmingly have a mobile number, not an email address). Email is
 * optional and only unique when present.
 *
 * Secrets (`passwordHash`, `refreshTokenHash`) are `select: false` so they are
 * never loaded — and therefore never leaked — unless a query asks for them explicitly.
 */
@Schema({
  timestamps: true,
  collection: 'users',
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      delete ret.passwordHash;
      delete ret.refreshTokenHash;
      return ret;
    },
  },
})
export class User {
  @Prop({ type: String, required: true, trim: true, minlength: 2, maxlength: 80 })
  fullName: string;

  @Prop({
    type: String,
    required: true,
    unique: true,
    trim: true,
    match: [
      PK_MOBILE_E164,
      'Phone must be a valid Pakistani mobile number in +923XXXXXXXXX format',
    ],
  })
  phone: string;

  @Prop({ type: String, lowercase: true, trim: true, maxlength: 160, default: undefined })
  email?: string;

  @Prop({ type: String, required: true, select: false })
  passwordHash: string;

  @Prop({ type: String, enum: Object.values(Role), default: Role.CUSTOMER })
  role: Role;

  @Prop({ type: Boolean, default: true })
  isActive: boolean;

  @Prop({ type: Date, default: null })
  phoneVerifiedAt: Date | null;

  @Prop({ type: Date, default: null })
  emailVerifiedAt: Date | null;

  @Prop({ type: Date, default: null })
  lastLoginAt: Date | null;

  /** Hash of the currently valid refresh token. Nulled on logout to revoke the session. */
  @Prop({ type: String, select: false, default: null })
  refreshTokenHash: string | null;

  /** Required for STORE_MANAGER: scopes all back-office access to a single store. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Store', default: null })
  storeId: Types.ObjectId | null;

  @Prop({ type: String, enum: Object.values(Language), default: Language.EN })
  preferredLanguage: Language;

  createdAt: Date;
  updatedAt: Date;
}

export const UserSchema = SchemaFactory.createForClass(User);

// Unique only when an email is actually present (partial index, not sparse:
// partial indexes are the supported way to combine uniqueness with optionality).
UserSchema.index(
  { email: 1 },
  { unique: true, partialFilterExpression: { email: { $type: 'string' } } },
);

// Back-office listing: "active store managers", "all customers", newest first.
UserSchema.index({ role: 1, isActive: 1, createdAt: -1 });

// Store manager rosters.
UserSchema.index({ storeId: 1 }, { partialFilterExpression: { storeId: { $type: 'objectId' } } });

/**
 * Data-integrity invariant enforced at the persistence layer so it holds no
 * matter which code path writes the document.
 */
UserSchema.pre('validate', function (next) {
  if (this.role === Role.STORE_MANAGER && !this.storeId) {
    this.invalidate('storeId', 'A STORE_MANAGER account must be linked to a store');
  }
  if (this.role !== Role.STORE_MANAGER && this.storeId) {
    this.invalidate('storeId', 'Only STORE_MANAGER accounts may be linked to a store');
  }
  return next();
});
