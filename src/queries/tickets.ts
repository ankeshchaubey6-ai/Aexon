"use server";

import { db } from "@/lib/db";
import { v4 as uuidv4 } from "uuid";
import { Prisma, Tag } from "@prisma/client";
import { revalidatePath } from "next/cache";

/**
 * Get all tickets for a pipeline
 */
export const getTicketsWithTags = async (pipelineId: string) => {
  if (!pipelineId) return [];

  try {
    return await db.ticket.findMany({
      where: {
        lane: { pipelineId },
      },
      include: {
        tags: true,
        assigned: true,
        customer: true,
      },
      orderBy: {
        order: "asc",
      },
    });
  } catch (error) {
    console.error("getTicketsWithTags error:", error);
    return [];
  }
};

/**
 * Get tickets for a lane
 */
export const getTicketDetails = async (laneId: string) => {
  if (!laneId) return [];

  try {
    return await db.ticket.findMany({
      where: { laneId },
      include: {
        assigned: true,
        customer: true,
        lane: true,
        tags: true,
      },
      orderBy: {
        order: "asc",
      },
    });
  } catch (error) {
    console.error("getTicketDetails error:", error);
    return [];
  }
};

/**
 * 🔥 FINAL FIXED UPSERT (Supports Decimal, Form Strings, Modal Edit)
 */
export const upsertTicket = async (
  ticket: Prisma.TicketUncheckedCreateInput,
  tags: Tag[]
) => {
  try {
    // 🔴 HARD VALIDATION
    if (!ticket?.laneId) {
      throw new Error("laneId is required");
    }

    // 🔥 SAFE NAME (prevents trim/undefined crash)
    const safeName =
      typeof ticket.name === "string" ? ticket.name.trim() : "";

    if (!safeName) {
      throw new Error("Ticket name is required");
    }

    // 🔥 CRITICAL: Convert form string -> Prisma.Decimal (YOUR SCHEMA NEEDS THIS)
    let decimalValue: Prisma.Decimal | null = null;

    if (ticket.value !== undefined && ticket.value !== null && ticket.value !== "") {
      try {
        // Accepts "100", 100, "100.50"
        decimalValue = new Prisma.Decimal(ticket.value as any);
      } catch (err) {
        console.error("Decimal conversion error:", err);
        decimalValue = new Prisma.Decimal(0);
      }
    }

    // 🔥 ORDER AUTO CALC (for new tickets)
    let order = ticket.order ?? 0;

    if (ticket.order === undefined) {
      const existingTickets = await db.ticket.findMany({
        where: { laneId: ticket.laneId },
        select: { id: true },
      });
      order = existingTickets.length;
    }

    const id = ticket.id ?? uuidv4();

    // 🔥 SAFE TAG CONNECT
    const tagConnections =
      Array.isArray(tags) && tags.length > 0
        ? tags.map((t) => ({ id: t.id }))
        : [];

    const response = await db.ticket.upsert({
      where: { id },
      update: {
        name: safeName,
        description:
          typeof ticket.description === "string"
            ? ticket.description.trim()
            : "",
        value: decimalValue, // ✅ FIX FOR Decimal schema
        laneId: ticket.laneId,
        assignedUserId: ticket.assignedUserId ?? null,
        customerId: ticket.customerId ?? null,
        order,
        tags: {
          set: [],
          connect: tagConnections,
        },
      },
      create: {
        id,
        name: safeName,
        description:
          typeof ticket.description === "string"
            ? ticket.description.trim()
            : "",
        value: decimalValue, // ✅ MAIN FIX (was breaking your save)
        laneId: ticket.laneId,
        assignedUserId: ticket.assignedUserId ?? null,
        customerId: ticket.customerId ?? null,
        order,
        tags: {
          connect: tagConnections,
        },
      },
      include: {
        assigned: true,
        customer: true,
        tags: true,
        lane: true,
      },
    });

    // 🔥 Revalidate UI (important for pipeline refresh)
    revalidatePath(`/subaccount`);
    revalidatePath(`/subaccount/${ticket.laneId}`);

    return response;
  } catch (error) {
    console.error("UPSERT TICKET FATAL ERROR:", error);
    throw error; // So frontend shows real error instead of fake validation
  }
};

export const deleteTicket = async (ticketId: string) => {
  if (!ticketId) {
    throw new Error("ticketId is required");
  }

  try {
    return await db.ticket.delete({
      where: { id: ticketId },
    });
  } catch (error) {
    console.error("deleteTicket error:", error);
    throw error;
  }
};