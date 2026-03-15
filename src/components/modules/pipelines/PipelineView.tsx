"use client";

import React from "react";
import { useRouter } from "next/navigation";
import {
  DragDropContext,
  Droppable,
  type DropResult,
} from "@hello-pangea/dnd";
import { Flag, Plus } from "lucide-react";
import { type Lane, type Ticket } from "@prisma/client";

import { useModal } from "@/hooks/use-modal";
import { Button } from "@/components/ui/button";
import CustomModal from "@/components/common/CustomModal";
import LaneDetails from "@/components/forms/LaneDetails";
import PipelineLane from "./PipelineLane";

import type {
  LaneDetails as LaneDetailsType,
  PipelineDetailsWithLanesCardsTagsTickets,
  TicketAndTags,
} from "@/lib/types";

interface PipelineViewProps {
  lanes: LaneDetailsType[];
  pipelineId: string;
  subAccountId: string;
  pipelineDetails: PipelineDetailsWithLanesCardsTagsTickets;
  updateLanesOrder: (lanes: Lane[]) => Promise<void>;
  updateTicketsOrder: (tickets: Ticket[]) => Promise<void>;
}

const PipelineView: React.FC<PipelineViewProps> = ({
  lanes,
  pipelineDetails,
  pipelineId,
  subAccountId,
  updateLanesOrder,
  updateTicketsOrder,
}) => {
  const router = useRouter();
  const { setOpen } = useModal();

  const [allLanes, setAllLanes] = React.useState<LaneDetailsType[]>(lanes);
  const [allTickets, setAllTickets] = React.useState<TicketAndTags[]>([]);

  React.useEffect(() => {
    setAllLanes(lanes);
  }, [lanes]);

  const handleAddLane = () => {
    setOpen(
      <CustomModal
        title="Create a Lane"
        subTitle="Lanes allow you to group tickets"
        scrollShadow={false}
      >
        <LaneDetails pipelineId={pipelineId} />
      </CustomModal>
    );
  };

  const onDragEnd = async (dropResult: DropResult) => {
    const { destination, source, type } = dropResult;

    if (
      !destination ||
      (destination.droppableId === source.droppableId &&
        destination.index === source.index)
    ) {
      return;
    }

    // 🔥 LANE DRAG
    if (type === "lane") {
      const newLanes = [...allLanes]
        .toSpliced(source.index, 1)
        .toSpliced(destination.index, 0, allLanes[source.index])
        .map((lane, index) => ({
          ...lane,
          order: index,
        }));

      setAllLanes(newLanes);
      await updateLanesOrder(newLanes);
      router.refresh();
      return;
    }

    // 🔥 TICKET DRAG
    if (type === "ticket") {
      const lanesCopy = [...allLanes];

      const originLane = lanesCopy.find(
        (lane) => lane.id === source.droppableId
      );
      const destinationLane = lanesCopy.find(
        (lane) => lane.id === destination.droppableId
      );

      if (!originLane || !destinationLane) return;

      if (originLane.id === destinationLane.id) {
        const newTickets = [...originLane.tickets]
          .toSpliced(source.index, 1)
          .toSpliced(destination.index, 0, originLane.tickets[source.index])
          .map((ticket, index) => ({
            ...ticket,
            order: index,
          }));

        originLane.tickets = newTickets;
        setAllLanes(lanesCopy);
        await updateTicketsOrder(newTickets);
      } else {
        const [movedTicket] = originLane.tickets.splice(source.index, 1);

        destinationLane.tickets.splice(destination.index, 0, {
          ...movedTicket,
          laneId: destinationLane.id,
        });

        originLane.tickets.forEach((t, i) => (t.order = i));
        destinationLane.tickets.forEach((t, i) => (t.order = i));

        setAllLanes(lanesCopy);
        await updateTicketsOrder([
          ...destinationLane.tickets,
          ...originLane.tickets,
        ]);
      }

      router.refresh();
    }
  };

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="bg-white/60 dark:bg-background/60 rounded-md p-4 use-automation-zoom-in">
        <div className="flex items-center justify-between">
          <h1 className="text-3xl font-bold">
            {pipelineDetails?.name}
          </h1>

          <Button
            className="inline-flex items-center gap-2"
            onClick={handleAddLane}
          >
            <Plus className="w-4 h-4" />
            Create Lane
          </Button>
        </div>

        <Droppable
          droppableId="lanes"
          type="lane"
          direction="horizontal"
        >
          {(provided) => (
            <div
              className="flex items-center gap-x-2 overflow-auto"
              ref={provided.innerRef}
              {...provided.droppableProps}
            >
              <div className="flex items-start gap-3 mt-4">
                {allLanes.map((lane, index) => (
                  <PipelineLane
                    key={lane.id}
                    allTickets={allTickets}
                    setAllTickets={setAllTickets}
                    subAccountId={subAccountId}
                    pipelineId={pipelineId}
                    tickets={lane.tickets}
                    laneDetails={lane}
                    index={index}
                  />
                ))}
                {provided.placeholder}
              </div>
            </div>
          )}
        </Droppable>

        {!allLanes.length && (
          <div className="flex items-center justify-center w-full flex-col gap-2 text-muted-foreground pb-10">
            <Flag className="w-32 h-32 opacity-100" />
            <p className="text-xs font-medium">
              You don&apos;t have any lanes. Go create one!
            </p>
          </div>
        )}
      </div>
    </DragDropContext>
  );
};

export default PipelineView;