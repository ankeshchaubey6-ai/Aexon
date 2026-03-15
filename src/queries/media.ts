"use server";

import { db } from "@/lib/db";
import { CreateMediaType } from "@/lib/types";
import { revalidatePath } from "next/cache";

/**
 * Get all media for a subaccount
 */
export const getMedia = async (subAccountId: string) => {
  if (!subAccountId) {
    console.error("[getMedia] subAccountId missing");
    return null;
  }

  try {
    const mediaFiles = await db.subAccount.findUnique({
      where: {
        id: subAccountId,
      },
      include: {
        media: true,
      },
    });

    return mediaFiles;
  } catch (error) {
    console.error("[getMedia] ERROR:", error);
    throw error;
  }
};

/**
 * Create media (CLOUDINARY / FILEUPLOAD SAFE)
 */
export const createMedia = async (
  subAccountId: string,
  mediaFiles: CreateMediaType
) => {
  if (!subAccountId) {
    throw new Error("[createMedia] subAccountId is required");
  }

  const name = mediaFiles?.name?.trim();
  const link = mediaFiles?.link?.trim();

  // 🔥 CRITICAL VALIDATION (your app was missing this)
  if (!name || name === "") {
    throw new Error("[createMedia] name is required");
  }

  if (!link || link === "") {
    throw new Error(
      "[createMedia] link is empty (FileUpload is not returning URL)"
    );
  }

  try {
    console.log("[createMedia] START:", {
      subAccountId,
      name,
      link,
    });

    const response = await db.media.create({
      data: {
        subAccountId,
        name,
        link,
        type: mediaFiles?.type ?? null,
      },
    });

    // 🔥 VERY IMPORTANT for Next.js App Router cache
    revalidatePath(`/subaccount/${subAccountId}/media`);
    revalidatePath(`/subaccount/${subAccountId}`);

    console.log("[createMedia] SUCCESS:", response.id);

    return response;
  } catch (error) {
    console.error("[createMedia] FAILED:", error);
    throw error;
  }
};

/**
 * Delete media
 */
export const deleteMedia = async (mediaId: string) => {
  if (!mediaId) {
    throw new Error("[deleteMedia] mediaId is required");
  }

  try {
    const response = await db.media.delete({
      where: {
        id: mediaId,
      },
    });

    return response;
  } catch (error) {
    console.error("[deleteMedia] ERROR:", error);
    throw error;
  }
};