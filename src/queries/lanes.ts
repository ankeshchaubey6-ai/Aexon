"use server";

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { type Ticket, type Lane, Prisma } from "@prisma/client";
import { type LaneDetails } from "@/lib/types";
import { revalidatePath } from "next/cache";

export const getLanesWithTicketsAndTags = async (pipelineId: string) => {
  if (!pipelineId) return [];

  return (await db.lane.findMany({
    where: { pipelineId },
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
  })) as LaneDetails[];
};

export const updateLanesOrder = async (lanes: Lane[]) => {
  if (!lanes?.length) return;

  await db.$transaction(
    lanes.map((lane) =>
      db.lane.update({
        where: { id: lane.id },
        data: { order: lane.order },
      })
    )
  );
};

export const updateTicketsOrder = async (tickets: Ticket[]) => {
  if (!tickets?.length) return;

  await db.$transaction(
    tickets.map((ticket) =>
      db.ticket.update({
        where: { id: ticket.id },
        data: {
          order: ticket.order,
          laneId: ticket.laneId,
        },
      })
    )
  );
};

export const deleteLane = async (laneId: string) => {
  if (!laneId) throw new Error("laneId is required");

  return await db.lane.delete({
    where: { id: laneId },
  });
};

export const upsertLane = async (lane: Prisma.LaneUncheckedCreateInput) => {
  if (!lane.pipelineId) {
    throw new Error("pipelineId is required");
  }

  if (!lane.name || lane.name.trim() === "") {
    throw new Error("Lane name is required");
  }

  let order = lane.order ?? 0;

  if (lane.order === undefined) {
    const lanes = await db.lane.findMany({
      where: { pipelineId: lane.pipelineId },
    });
    order = lanes.length;
  }

  const id = lane.id ?? uuidv4();

  const response = await db.lane.upsert({
    where: { id },
    update: {
      name: lane.name,
      color: lane.color,
      pipelineId: lane.pipelineId,
      order,
    },
    create: {
      id,
      name: lane.name,
      color: lane.color,
      pipelineId: lane.pipelineId,
      order,
    },
  });

  revalidatePath(`/subaccount`);
  return response;
};