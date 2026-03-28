export type AuditLogItemDto = {
  id: string;
  entityType: string | null;
  entityId: string | null;
  action: string;
  actorUserId: string;
  createdAt: string;
  reason: string | null;
  before: unknown | null;
  after: unknown | null;
};

