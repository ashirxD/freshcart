import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument, SchemaTypes, Types } from 'mongoose';
import { Role } from 'src/common/enums';

export type AuditLogDocument = HydratedDocument<AuditLog>;

export const AUDIT_LOG_COLLECTION = 'audit_logs';

/**
 * What happened. A closed vocabulary, because the point of an audit log is to
 * be *queryable* — "show me every price change last month" is only answerable
 * if the action is an enum rather than a sentence somebody typed.
 *
 * New entries are added when a genuinely new administrative operation exists,
 * not to describe an existing one more precisely.
 */
export enum AuditAction {
  PRODUCT_CREATED = 'PRODUCT_CREATED',
  PRODUCT_UPDATED = 'PRODUCT_UPDATED',
  PRODUCT_STATUS_CHANGED = 'PRODUCT_STATUS_CHANGED',

  CATEGORY_CREATED = 'CATEGORY_CREATED',
  CATEGORY_UPDATED = 'CATEGORY_UPDATED',
  CATEGORY_STATUS_CHANGED = 'CATEGORY_STATUS_CHANGED',

  INVENTORY_ADJUSTED = 'INVENTORY_ADJUSTED',

  ORDER_STATUS_CHANGED = 'ORDER_STATUS_CHANGED',
  ORDER_STATUS_OVERRIDDEN = 'ORDER_STATUS_OVERRIDDEN',

  USER_STATUS_CHANGED = 'USER_STATUS_CHANGED',
  USER_ROLE_CHANGED = 'USER_ROLE_CHANGED',

  STORE_MANAGER_CREATED = 'STORE_MANAGER_CREATED',
  STORE_MANAGER_UPDATED = 'STORE_MANAGER_UPDATED',

  STORE_CREATED = 'STORE_CREATED',
  STORE_UPDATED = 'STORE_UPDATED',

  DELIVERY_RULE_CREATED = 'DELIVERY_RULE_CREATED',
  DELIVERY_RULE_UPDATED = 'DELIVERY_RULE_UPDATED',
  DELIVERY_RULE_DELETED = 'DELIVERY_RULE_DELETED',

  SETTINGS_UPDATED = 'SETTINGS_UPDATED',
}

/** The kind of thing acted on. Pairs with `entityId` to name one record. */
export enum AuditEntity {
  PRODUCT = 'PRODUCT',
  CATEGORY = 'CATEGORY',
  INVENTORY = 'INVENTORY',
  ORDER = 'ORDER',
  USER = 'USER',
  STORE = 'STORE',
  DELIVERY_RULE = 'DELIVERY_RULE',
  SETTINGS = 'SETTINGS',
}

/**
 * ONE ADMINISTRATIVE ACTION, RECORDED
 * ===================================
 *
 * Section 27 defines the whole scope of this collection, and it is deliberately
 * narrow: WHO did WHAT to WHICH RESOURCE, WHEN. Nothing else.
 *
 * WHAT IS NOT HERE, and why:
 *
 *   - No request bodies. A full payload is how passwords, tokens and customer
 *     addresses end up in a log that is read by more people than the database.
 *   - No customer PII. `metadata` carries identifiers and small scalars — an
 *     order number, a status, a price that changed — never a name or an address.
 *   - No actor name. The user id is the durable identity; a name is a snapshot
 *     of a mutable field and reads like a byline rather than an audit record.
 *
 * WRITES ARE BEST-EFFORT AND NEVER BLOCK THE OPERATION. See AuditService: a
 * failed audit write is logged and swallowed, because refusing an admin's
 * legitimate product edit on the strength of a logging failure is a worse
 * outcome than a gap in the trail. Nothing in FreshCarts derives state from
 * these rows — they are evidence, not a ledger.
 */
@Schema({
  timestamps: { createdAt: 'occurredAt', updatedAt: false },
  collection: AUDIT_LOG_COLLECTION,
  toJSON: {
    virtuals: true,
    versionKey: false,
    transform: (_doc, ret: Record<string, unknown>) => {
      ret.id = String(ret._id);
      delete ret._id;
      return ret;
    },
  },
})
export class AuditLog {
  /** The authenticated principal. Never taken from a request body. */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'User', required: true })
  actorId: Types.ObjectId;

  /** The role they held at the time, which a later demotion must not rewrite. */
  @Prop({ type: String, required: true, enum: Object.values(Role) })
  actorRole: Role;

  @Prop({ type: String, required: true, enum: Object.values(AuditAction) })
  action: AuditAction;

  @Prop({ type: String, required: true, enum: Object.values(AuditEntity) })
  entityType: AuditEntity;

  /**
   * The record acted on. A string rather than an ObjectId because the settings
   * singleton has no ObjectId of its own, and one nullable typed field would be
   * worse than one always-present string.
   */
  @Prop({ type: String, required: true, maxlength: 64 })
  entityId: string;

  /**
   * The store the action belongs to, where one applies. Present for catalogue,
   * inventory and order events; absent for user and settings changes, which are
   * platform-wide.
   */
  @Prop({ type: SchemaTypes.ObjectId, ref: 'Store', default: null })
  storeId: Types.ObjectId | null;

  /**
   * Short, structured context — the before and after of what changed. Bounded
   * and sanitised by AuditService before it reaches here.
   */
  @Prop({ type: SchemaTypes.Mixed, default: {} })
  metadata: Record<string, unknown>;

  /** Set by the timestamps option above. */
  occurredAt: Date;
}

export const AuditLogSchema = SchemaFactory.createForClass(AuditLog);

// --- Indexes -------------------------------------------------------------
// The three questions the admin log screen actually asks.

// "What happened recently?" — the default view, newest first.
AuditLogSchema.index({ occurredAt: -1 });

// "What has this admin been doing?"
AuditLogSchema.index({ actorId: 1, occurredAt: -1 });

// "Who touched this product/order?" — the history of one record.
AuditLogSchema.index({ entityType: 1, entityId: 1, occurredAt: -1 });
