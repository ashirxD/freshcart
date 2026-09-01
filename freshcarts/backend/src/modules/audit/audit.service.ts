import { Injectable, Logger } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { FilterQuery, Model, Types } from 'mongoose';
import { PaginatedResult, paginated } from 'src/common/dto';
import { Role } from 'src/common/enums';
import { QueryAuditLogsDto } from './dto';
import { AuditAction, AuditEntity, AuditLog, AuditLogDocument } from './schemas';

/** Who performed the action. Always the verified principal. */
export interface AuditActor {
  userId: string;
  role: Role;
}

/** One recordable event. */
export interface AuditEvent {
  actor: AuditActor;
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string;
  storeId?: Types.ObjectId | string | null;
  metadata?: Record<string, unknown>;
}

/** The shape the admin log screen renders. */
export interface AuditLogView {
  id: string;
  actorId: string;
  actorName: string | null;
  actorRole: Role;
  action: AuditAction;
  entityType: AuditEntity;
  entityId: string;
  metadata: Record<string, unknown>;
  occurredAt: Date;
}

/** Keys that must never reach an audit row, whatever a caller passes. */
const FORBIDDEN_METADATA_KEYS = new Set([
  'password',
  'passwordhash',
  'newpassword',
  'currentpassword',
  'token',
  'accesstoken',
  'refreshtoken',
  'refreshtokenhash',
  'authorization',
  'secret',
  'apikey',
  'cookie',
  'cvv',
  'cardnumber',
]);

/** Bounds one metadata object, so no single row can grow unboundedly. */
const MAX_METADATA_KEYS = 20;
const MAX_METADATA_STRING_LENGTH = 200;

@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(@InjectModel(AuditLog.name) private readonly auditModel: Model<AuditLogDocument>) {}

  /**
   * Records an administrative action.
   *
   * NEVER THROWS. An audit write that failed must not turn a successful product
   * edit into a 500 the admin then retries, producing the double-write the log
   * was supposed to help investigate. The failure is logged at `error` so it is
   * visible in monitoring, and the caller carries on.
   *
   * Deliberately awaited by callers rather than fired and forgotten: the write
   * is a single insert against an indexed collection, and awaiting it means a
   * process that exits immediately after the operation still leaves the record.
   */
  async record(event: AuditEvent): Promise<void> {
    try {
      await this.auditModel.create({
        actorId: new Types.ObjectId(event.actor.userId),
        actorRole: event.actor.role,
        action: event.action,
        entityType: event.entityType,
        entityId: event.entityId,
        storeId: event.storeId ? new Types.ObjectId(event.storeId.toString()) : null,
        metadata: AuditService.sanitiseMetadata(event.metadata),
      });
    } catch (error) {
      this.logger.error(
        'Failed to record audit event ' + event.action + ' on ' + event.entityType,
        error instanceof Error ? error.stack : undefined,
      );
    }
  }

  /**
   * The admin log listing. Paginated and bounded like every other collection
   * endpoint — an audit log is the collection most likely to be large.
   *
   * Actor names are resolved in one `$lookup` rather than one query per row,
   * and only `fullName` is projected: the log needs to say who acted, not to
   * republish an account.
   */
  async list(query: QueryAuditLogsDto): Promise<PaginatedResult<AuditLogView>> {
    const filter: FilterQuery<AuditLogDocument> = {};

    if (query.action) filter.action = query.action;
    if (query.entityType) filter.entityType = query.entityType;
    if (query.entityId) filter.entityId = query.entityId;
    if (query.actorId) filter.actorId = new Types.ObjectId(query.actorId);

    if (query.from || query.to) {
      filter.occurredAt = {
        ...(query.from ? { $gte: query.from } : {}),
        ...(query.to ? { $lte: query.to } : {}),
      };
    }

    type Row = AuditLogDocument & { actor?: Array<{ fullName: string }> };

    const [rows, total] = await Promise.all([
      this.auditModel
        .aggregate<Row>([
          { $match: filter },
          { $sort: { occurredAt: -1 } },
          { $skip: query.skip },
          { $limit: query.limit },
          {
            $lookup: {
              from: 'users',
              localField: 'actorId',
              foreignField: '_id',
              as: 'actor',
              pipeline: [{ $project: { fullName: 1 } }],
            },
          },
        ])
        .exec(),
      this.auditModel.countDocuments(filter).exec(),
    ]);

    const items = rows.map((row) => ({
      id: row._id.toString(),
      actorId: row.actorId.toString(),
      actorName: row.actor?.[0]?.fullName ?? null,
      actorRole: row.actorRole,
      action: row.action,
      entityType: row.entityType,
      entityId: row.entityId,
      metadata: row.metadata ?? {},
      occurredAt: row.occurredAt,
    }));

    return paginated(items, total, { page: query.page, limit: query.limit });
  }

  /**
   * Strips and bounds metadata before it is persisted.
   *
   * The forbidden-key check is the backstop, not the strategy — callers are
   * expected to pass only identifiers and small scalars. It exists because a
   * future caller spreading a DTO into `metadata` is a realistic mistake, and
   * the cost of that mistake is a password in a log.
   *
   * Nested objects are dropped entirely rather than recursed into: a value
   * worth auditing is a scalar, and recursion is how a whole request body gets
   * in through a field nobody inspected.
   */
  static sanitiseMetadata(metadata: Record<string, unknown> | undefined): Record<string, unknown> {
    if (!metadata) return {};

    const clean: Record<string, unknown> = {};

    for (const [key, value] of Object.entries(metadata)) {
      if (Object.keys(clean).length >= MAX_METADATA_KEYS) break;
      if (FORBIDDEN_METADATA_KEYS.has(key.toLowerCase())) continue;
      if (value === undefined || value === null) continue;

      if (typeof value === 'string') {
        clean[key] = value.slice(0, MAX_METADATA_STRING_LENGTH);
      } else if (typeof value === 'number' || typeof value === 'boolean') {
        clean[key] = value;
      } else if (value instanceof Date) {
        clean[key] = value.toISOString();
      } else if (value instanceof Types.ObjectId) {
        clean[key] = value.toString();
      }
      // Anything else — objects, arrays, functions — is deliberately dropped.
    }

    return clean;
  }
}
