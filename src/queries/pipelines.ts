"use server";

import { db } from "@/lib/db";
import { v4 } from "uuid";
import { Prisma } from "@prisma/client";
import { revalidatePath } from "next/cache";
import { assertSubAccountAccess } from "@/lib/auth/tenant";

export const getUserPipelines = async (subAccountId: string) => {
  if (!subAccountId) return [];
  await assertSubAccountAccess(subAccountId);
  return await db.pipeline.findMany({
    where: { subAccountId },
    orderBy: { createdAt: "desc" },
  });
};

export const getPipelines = async (subAccountId: string) => {
  if (!subAccountId) return [];
  await assertSubAccountAccess(subAccountId);

  return await db.pipeline.findMany({
    where: { subAccountId },
    include: {
      lanes: {
        orderBy: { order: "asc" },
        include: {
          tickets: {
            orderBy: { order: "asc" },
            include: {
              tags: true,
              customer: true,
              assigned: true,
            },
          },
        },
      },
    },
  });
};

export const getPipelineDetails = async (pipelineId: string) => {
  if (!pipelineId) return null;
  return await db.pipeline.findUnique({
    where: { id: pipelineId },
  });
};

export const createPipeline = async (subAccountId: string) => {
  if (!subAccountId) {
    throw new Error("subAccountId is required");
  }

  await assertSubAccountAccess(subAccountId);

  const response = await db.pipeline.create({
    data: {
      name: "Lead Cycle",
      subAccountId,
    },
  });

  revalidatePath(`/subaccount/${subAccountId}/pipelines`);
  return response;
};

export const upsertPipeline = async (
  pipeline: Prisma.PipelineUncheckedCreateWithoutLanesInput
) => {
  if (!pipeline.subAccountId) {
    throw new Error("subAccountId is required");
  }

  if (!pipeline.name || pipeline.name.trim() === "") {
    throw new Error("Pipeline name is required");
  }

  const id = pipeline.id ?? v4();

  const response = await db.pipeline.upsert({
    where: { id },
    update: {
      name: pipeline.name,
      subAccountId: pipeline.subAccountId,
    },
    create: {
      id,
      name: pipeline.name,
      subAccountId: pipeline.subAccountId,
    },
  });

  revalidatePath(`/subaccount/${pipeline.subAccountId}/pipelines`);
  return response;
};

export const deletePipeline = async (pipelineId: string) => {
  if (!pipelineId) {
    throw new Error("pipelineId is required");
  }

  return await db.pipeline.delete({
    where: { id: pipelineId },
  });
};
