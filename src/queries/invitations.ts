"use server";

import { db } from "@/lib/db";
import { clerkClient, currentUser } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";

import { createTeamUser } from "./auth";
import { saveActivityLogsNotification } from "./notifications";

import { Role, InvitationStatus } from "@prisma/client";
import { logger } from "@/lib/utils";

export const sendInvitation = async (
  role: Role,
  email: string,
  agencyId: string
) => {
  try {
    if (!email || !agencyId) {
      throw new Error("Missing email or agencyId");
    }

    const normalizedEmail = email.trim().toLowerCase();

    // 🔥 1. Check if user already exists
    const existingUser = await db.user.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingUser?.role === role) {
      throw new Error("This user already has this role");
    }

    // 🔥 2. Prevent duplicate invitation crash (UNIQUE email constraint)
    const existingInvitation = await db.invitation.findUnique({
      where: {
        email: normalizedEmail,
      },
    });

    if (existingInvitation) {
      // If already invited, just return instead of crashing
      return existingInvitation;
    }

    // 🔥 3. Create DB invitation FIRST (safe)
    const response = await db.invitation.create({
      data: {
        email: normalizedEmail,
        agencyId,
        role,
        status: InvitationStatus.PENDING,
      },
    });

    // 🔥 4. TRY Clerk invitation (but DO NOT crash app if it fails)
    try {
      await clerkClient.invitations.createInvitation({
        emailAddress: normalizedEmail,
        redirectUrl:
          process.env.NEXT_PUBLIC_URL ||
          "http://localhost:3000/sign-in",
        ignoreExisting: true,
        publicMetadata: {
          throughInvitation: true,
          role,
          agencyId,
        },
      });
    } catch (clerkError) {
      // ⚠️ Do NOT throw — just log (this was breaking your UI)
      console.error("CLERK INVITATION ERROR:", clerkError);
      logger(clerkError);
      // Still return DB invitation so UI succeeds
    }

    return response;
  } catch (error) {
    console.error("SEND INVITATION ERROR:", error);
    throw new Error("Failed to send invitation");
  }
};

export const verifyInvintation = async () => {
  const user = await currentUser();

  if (!user) return redirect("/sign-in");

  const email = user.emailAddresses[0].emailAddress.toLowerCase();

  const invitationExists = await db.invitation.findUnique({
    where: {
      email,
    },
  });

  // If user already exists, skip invitation flow
  const isUserExist = await db.user.findUnique({
    where: {
      email,
    },
  });

  if (isUserExist) {
    return isUserExist.agencyId;
  }

  if (invitationExists && invitationExists.status === "PENDING") {
    const userDetails = await createTeamUser(invitationExists.agencyId, {
      id: user.id,
      role: invitationExists.role,
      email: invitationExists.email,
      agencyId: invitationExists.agencyId,
      avatarUrl: user.imageUrl,
      name: `${user.firstName} ${user.lastName}`,
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    await saveActivityLogsNotification({
      agencyId: invitationExists.agencyId,
      description: "Joined",
      subAccountId: undefined,
    });

    if (userDetails) {
      await clerkClient.users.updateUserMetadata(user.id, {
        privateMetadata: {
          role: userDetails.role || Role.SUBACCOUNT_USER,
        },
      });

      // 🔥 Clean invitation after accept
      await db.invitation.delete({
        where: {
          email: userDetails.email,
        },
      });

      return userDetails.agencyId;
    }

    return null;
  }

  const agency = await db.user.findUnique({
    where: {
      email,
    },
  });

  return agency ? agency.agencyId : null;
};