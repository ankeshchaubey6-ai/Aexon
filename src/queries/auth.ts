"use server";

import { db } from "@/lib/db";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { Role, type User } from "@prisma/client";
import { logger } from "@/lib/utils";
import { cache } from "react";

export const getAuthUser = async (email: string) => {
  try {
    const details = await db.user.findUnique({
      where: {
        email,
      },
    });

    if (!details) {
      throw new Error("Not authorized");
    }

    return details as User;
  } catch (error) {
    logger(error);
  }
};

export const getAuthUserDetails = cache(async () => {
  const user = await currentUser();

  if (!user) {
    return;
  }

  const userData = await db.user.findUnique({
    where: {
      email: user.emailAddresses[0].emailAddress,
    },
    include: {
      agency: {
        include: {
          sidebarOptions: true,
          subAccounts: {
            include: {
              sidebarOptions: true,
            },
          },
        },
      },
      permissions: {
        include: {
          subAccount: true,
        },
      },
    },
  });

  return userData;
});

/**
 * Lightweight authorization lookup for server actions.
 * The full auth query intentionally loads navigation/account relations for
 * layouts, but mutations only need role, agency and accessible sub-account IDs.
 */
export const getAuthUserAccess = cache(async () => {
  const user = await currentUser();

  if (!user) return;

  return db.user.findUnique({
    where: { email: user.emailAddresses[0].emailAddress },
    select: {
      id: true,
      role: true,
      agencyId: true,
      permissions: {
        where: { access: true },
        select: { subAccountId: true },
      },
    },
  });
});

export const getAuthUserGroup = async (agencyId: string) => {
  const teamMembers = await db.user.findMany({
    where: {
      agency: {
        id: agencyId,
      },
    },
    include: {
      agency: { include: { subAccounts: true } },
      permissions: { include: { subAccount: true } },
    },
  });

  return teamMembers;
};

export const deleteUser = async (userId: string) => {
  await clerkClient.users.updateUserMetadata(userId, {
    privateMetadata: {
      role: undefined,
    },
  });
  await clerkClient.users.deleteUser(userId);
  const deletedUser = await db.user.delete({ where: { id: userId } });

  return deletedUser;
};

export const createTeamUser = async (agencyId: string, user: User) => {
  if (user.role === "AGENCY_OWNER") return null; // allready have an access

  const response = await db.user.create({
    data: {
      ...user,
    },
  });

  return response;
};

export const initUser = async (newUser: Partial<User>) => {
  const user = await currentUser();

  if (!user) {
    throw new Error("User not found");
  }

  const email = user.emailAddresses[0].emailAddress;

  const userData = await db.user.upsert({
    where: {
      email,
    },
    update: {
      role: newUser.role ?? Role.SUBACCOUNT_USER,
      agencyId: newUser.agencyId ?? undefined, // 🔥 IMPORTANT FIX
    },
    create: {
      id: user.id,
      avatarUrl: user.imageUrl || "",
      email,
      name: `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || "User",
      role: newUser.role ?? Role.SUBACCOUNT_USER,
      agencyId: newUser.agencyId ?? null, // 🔥 THIS WAS MISSING (CAUSE OF YOUR ERROR)
    },
  });

  // Sync Clerk metadata
  await clerkClient.users.updateUserMetadata(user.id, {
    privateMetadata: {
      role: newUser.role ?? Role.SUBACCOUNT_USER,
      agencyId: newUser.agencyId ?? null,
    },
  });

  return userData;
};

export const updateUser = async (user: {
  id: string;
  name: string;
  email: string;
  avatarUrl?: string | null;
  role: Role;
}) => {
  try {
    if (!user?.id) {
      throw new Error("Missing user ID");
    }

    // 🔥 GUARANTEED NON-EMPTY UPDATE (prevents prisma empty data error)
    const data = {
      name: user.name,
      email: user.email,
      avatarUrl: user.avatarUrl && user.avatarUrl !== "" 
        ? user.avatarUrl 
        : "https://ui-avatars.com/api/?name=" + encodeURIComponent(user.name),
      role: user.role,
    };

    const response = await db.user.update({
      where: {
        id: user.id, // NEVER use email here
      },
      data,
    });

    // Sync Clerk role safely
    await clerkClient.users.updateUserMetadata(response.id, {
      privateMetadata: {
        role: user.role,
      },
    });

    return response;
  } catch (error) {
    console.error("UPDATE USER SERVER ERROR:", error);
    throw new Error("Server failed to update user");
  }
};
