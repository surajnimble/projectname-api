-- Store per-user SUB_ADMIN permission overrides. Legacy users continue to inherit role permissions.
ALTER TABLE "User"
  ADD COLUMN "subAdminPermissions" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],
  ADD COLUMN "hasCustomPermissions" BOOLEAN NOT NULL DEFAULT false;
