"use client";

import React from "react";

import { getMedia } from "@/queries/media";
import { useModal } from "@/hooks/use-modal";

import MediaPicker from "../../media/MediaPicker";

import { type MediaFiles } from "@/lib/types";

interface MediaTabProps {
  subAccountId: string;
}

const MediaTab: React.FC<MediaTabProps> = ({ subAccountId }) => {
  const [data, setData] = React.useState<MediaFiles>(null);
  const { data: modalData } = useModal();

  React.useEffect(() => {
    const fetchMedia = async () => {
      const response = await getMedia(subAccountId);
      setData(response);
    };

    fetchMedia();
  }, [subAccountId, modalData]);

  return (
    <div className="h-full overflow-hidden">
      <MediaPicker data={data} />
    </div>
  );
};

export default MediaTab;
