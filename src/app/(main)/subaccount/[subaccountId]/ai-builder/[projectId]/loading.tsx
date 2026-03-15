// src/app/(main)/subaccount/[subaccountId]/ai-builder/[projectId]/loading.tsx
const Loading = () => {
  return (
    <div className="w-full h-[calc(100vh-64px)] flex items-center justify-center">
      <div className="animate-pulse text-muted-foreground">
        Initializing AI Builder Workspace...
      </div>
    </div>
  );
};

export default Loading;