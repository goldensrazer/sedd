/**
 * TypeScript Interfaces for {{FEATURE_NAME}}
 *
 * Feature ID: {{FEATURE_ID}}
 * Generated: {{TIMESTAMP}}
 *
 * These interfaces will be converted to Zod schemas during implementation.
 */

// ============================================================================
// Enums
// ============================================================================

export enum Status {
  DRAFT = 'draft',
  ACTIVE = 'active',
  COMPLETED = 'completed',
  ARCHIVED = 'archived',
}

// ============================================================================
// Value Objects (Immutable)
// ============================================================================

export interface Address {
  readonly street: string;
  readonly city: string;
  readonly country: string;
  readonly postalCode: string;
}

// ============================================================================
// Entities
// ============================================================================

export interface Entity1 {
  id: string;
  name: string;
  status: Status;
  createdAt: Date;
  updatedAt: Date;
}

export interface Entity2 {
  id: string;
  entity1Id: string;
  value: string;
  metadata?: Record<string, unknown>;
}

// ============================================================================
// Aggregates
// ============================================================================

export interface Aggregate1 {
  root: Entity1;
  children: Entity2[];
}

// ============================================================================
// DTOs (Data Transfer Objects)
// ============================================================================

export interface CreateEntity1Input {
  name: string;
  status?: Status;
}

export interface UpdateEntity1Input {
  name?: string;
  status?: Status;
}

export interface Entity1Output {
  id: string;
  name: string;
  status: Status;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// API Types
// ============================================================================

export interface PaginationParams {
  page?: number;
  limit?: number;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  page: number;
  limit: number;
  hasMore: boolean;
}

export interface ApiError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

// ============================================================================
// Event Types
// ============================================================================

export interface DomainEvent {
  type: string;
  aggregateId: string;
  timestamp: Date;
  payload: Record<string, unknown>;
}

export interface Entity1CreatedEvent extends DomainEvent {
  type: 'entity1.created';
  payload: {
    entity: Entity1;
  };
}

export interface Entity1UpdatedEvent extends DomainEvent {
  type: 'entity1.updated';
  payload: {
    before: Partial<Entity1>;
    after: Partial<Entity1>;
  };
}
