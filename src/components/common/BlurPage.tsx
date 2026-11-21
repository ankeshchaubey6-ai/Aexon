import React from "react";

const BlurPage: React.FC<React.PropsWithChildren> = ({ children }) => {
  return (
    <div
      className="relative min-h-full w-full overflow-auto bg-background mx-auto p-4 scrollbar scrollbar-thumb-muted-foreground/20 scrollbar-thumb-rounded-full scrollbar-track-rounded-full scrollbar-medium"
      id="blur-page" // for portals
    >
      {children}
    </div>
  );
};

export default BlurPage;
