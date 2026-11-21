import { Role } from "@prisma/client";

import { db } from "@/lib/db";
import { getAuthUserDetails } from "@/queries/auth";

/**
 * Server-side tenant guard for actions and queries receiving IDs from the
 * browser. Layout guards are not enough because server actions can be called
 * directly.
 */
export const assertSubAccountAccess = async (subAccountId: string) => {
  if (!subAccountId) throw new Error("subAccountId is required");

  const user = await getAuthUserDetails();
  if (!user?.agency) throw new Error("Not authorized");

  const subAccount = await db.subAccount.findFirst({
    where: { id: subAccountId, agencyId: user.agency.id },
    select: { id: true, agencyId: true },
  });

  if (!subAccount) throw new Error("Sub-account not found");

  const isAgencyAdmin =
    user.role === Role.AGENCY_OWNER || user.role === Role.AGENCY_ADMIN;
  const hasPermission = user.permissions.some(
    (permission) =>
      permission.access && permission.subAccountId === subAccountId
  );

  if (!isAgencyAdmin && !hasPermission) throw new Error("Not authorized");

  return subAccount;
};
