"use server";

import { db } from "@/lib/db";
import { assertSubAccountAccess } from "@/lib/auth/tenant";

export const getSubAccountDashboardMetrics = async (subAccountId: string) => {
  await assertSubAccountAccess(subAccountId);

  const [contactCount, pipelines] = await Promise.all([
    db.contact.count({ where: { subAccountId } }),
    db.pipeline.findMany({
      where: { subAccountId },
      select: {
        lanes: {
          orderBy: { order: "asc" },
          select: { id: true, tickets: { select: { value: true } } },
        },
      },
    }),
  ]);

  const lanes = pipelines.flatMap((pipeline) => pipeline.lanes);
  const tickets = lanes.flatMap((lane) => lane.tickets);
  const totalValue = tickets.reduce((sum, ticket) => sum + Number(ticket.value ?? 0), 0);
  const closedLaneIds = new Set(
    pipelines.map((pipeline) => pipeline.lanes.at(-1)?.id).filter(Boolean)
  );
  const closedTickets = lanes
    .filter((lane) => closedLaneIds.has(lane.id))
    .flatMap((lane) => lane.tickets);
  const closedValue = closedTickets.reduce(
    (sum, ticket) => sum + Number(ticket.value ?? 0),
    0
  );

  return {
    contactCount,
    ticketCount: tickets.length,
    closedCount: closedTickets.length,
    totalValue,
    closedValue,
    conversionRate: totalValue ? Math.round((closedValue / totalValue) * 100) : 0,
  };
};
