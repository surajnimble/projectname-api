/**
 * Shared helpers for the local-only demo seed.
 *
 * Every demo row is written with a fixed id and `update: {}`, so a re-run
 * inserts only what is missing and never overwrites a value someone edited.
 */
import { PrismaClient } from '@prisma/client';

/** Builds the deterministic id used by every demo row. */
export const demoId = (scope: string, index: number | string): string => `demo-${scope}-${index}`;

/**
 * Inserts a row under a fixed id when it is absent.
 *
 * `update: {}` is deliberate: a developer who edits demo data in the admin
 * panel should keep that edit across the next `npm run seed`.
 */
export const seedRow = async (
  prisma: PrismaClient,
  model: string,
  id: string,
  data: Record<string, any>,
): Promise<any> => {
  const delegate = (prisma as any)[model];
  return delegate.upsert({
    where: { id },
    create: { id, ...data },
    update: {},
  });
};

/**
 * Inserts a row under a natural unique key when it is absent.
 *
 * Used for rows the base seed may already own under a different id — users by
 * email, categories by slug, and similar.
 */
export const seedRowBy = async (
  prisma: PrismaClient,
  model: string,
  where: Record<string, any>,
  id: string,
  data: Record<string, any>,
): Promise<any> => {
  const delegate = (prisma as any)[model];
  return delegate.upsert({
    where,
    create: { id, ...data },
    update: {},
  });
};

/** Returns the id of a row matched by a natural key, or `''` when absent. */
export const findId = async (
  prisma: PrismaClient,
  model: string,
  where: Record<string, any>,
): Promise<string> => {
  const delegate = (prisma as any)[model];
  const row = await delegate.findFirst({ where, select: { id: true } });
  return row?.id ?? '';
};

/** Days from now, as a `Date`. */
export const daysFromNow = (days: number): Date => new Date(Date.now() + days * 86400000);
