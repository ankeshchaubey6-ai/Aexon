"use client";

import React from "react";
import { useRouter } from "next/navigation";
import type { Tag as TagType } from "@prisma/client";
import { v4 as uuidv4 } from "uuid";
import { toast } from "sonner";
import {
  PlusCircle,
  Trash,
  X,
  Tag as TagIcon,
  Sparkles,
  AlertCircle,
  CheckCircle2,
  XCircle,
  Palette,
} from "lucide-react";

import { deleteTag, getTagsForSubAccount, upsertTag } from "@/queries/tags";
import { saveActivityLogsNotification } from "@/queries/notifications";

import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "../ui/alert-dialog";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from "../ui/command";
import { Tag } from "../ui/tag";
import { Badge } from "../ui/badge";
import { Button } from "../ui/button";
import { Card, CardContent } from "../ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "../ui/tooltip";
import { cn } from "@/lib/utils";

interface TagDetailsProps {
  subAccountId: string;
  getSelectedTags: (tags: TagType[]) => void;
  defaultTags?: TagType[];
}

const TAG_COLORS = ["BLUE", "ORANGE", "ROSE", "PURPLE", "GREEN"] as const;
type TagColor = typeof TAG_COLORS[number];

const colorMap = {
  BLUE: "from-blue-600 to-cyan-600",
  ORANGE: "from-orange-500 to-amber-500",
  ROSE: "from-rose-500 to-pink-500",
  PURPLE: "from-purple-500 to-indigo-500",
  GREEN: "from-green-500 to-emerald-500",
};

const TagDetails: React.FC<TagDetailsProps> = ({
  getSelectedTags,
  subAccountId,
  defaultTags,
}) => {
  const router = useRouter();

  const [selectedTags, setSelectedTags] = React.useState<TagType[]>(
    defaultTags || []
  );
  const [tags, setTags] = React.useState<TagType[]>([]);
  const [value, setValue] = React.useState<string>("");
  const [selectedColor, setSelectedColor] = React.useState<string>("");

  React.useEffect(() => {
    if (subAccountId) {
      const fetchData = async () => {
        const response = await getTagsForSubAccount(subAccountId);
        if (response) {
          setTags(response);
        }
      };

      fetchData();
    }
  }, [subAccountId]);

  React.useEffect(() => {
    getSelectedTags(selectedTags);
  }, [selectedTags, getSelectedTags]);

  const handleDeleteSelection = (tagId: string) => {
    setSelectedTags(() => selectedTags.filter((tag) => tag.id !== tagId));
  };

  const handleAddSelections = (tag: TagType) => {
    if (selectedTags.every((t) => t.id !== tag.id)) {
      setSelectedTags([...selectedTags, tag]);
      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>Tag "{tag.name}" added</span>
        </div>
      );
    }
  };

  const handleAddTag = async () => {
    if (!value) {
      toast.error("Tag name is required", {
        description: "Please enter a name for your tag",
      });
      return;
    }
    if (!selectedColor) {
      toast.error("Color is required", {
        description: "Please select a color for your tag",
      });
      return;
    }

    const tagData: TagType = {
      id: uuidv4(),
      createdAt: new Date(),
      updatedAt: new Date(),
      color: selectedColor,
      name: value,
      subAccountId,
    };

    setTags([...tags, tagData]);
    setValue("");
    setSelectedColor("");

    try {
      const response = await upsertTag(subAccountId, tagData);

      await saveActivityLogsNotification({
        agencyId: undefined,
        description: `Created a new tag | ${response?.name}`,
        subAccountId,
      });

      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>Tag "{value}" created successfully</span>
        </div>
      );
    } catch (error) {
      toast.error("Failed to create tag", {
        description: "Please try again",
      });
    }
  };

  const handleDeleteTag = async (tagId: string) => {
    const tagToDelete = tags.find(t => t.id === tagId);
    setTags(tags.filter((tag) => tag.id !== tagId));

    try {
      const response = await deleteTag(tagId);

      toast.success(
        <div className="flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 text-emerald-500" />
          <span>Tag "{response?.name}" deleted</span>
        </div>
      );

      await saveActivityLogsNotification({
        agencyId: undefined,
        description: `Deleted a tag | ${response?.name}`,
        subAccountId,
      });

      router.refresh();
    } catch (error) {
      toast.error("Could not delete tag");
    }
  };

  return (
    <TooltipProvider>
      <AlertDialog>
        <div className="space-y-3">
          {/* Selected Tags */}
          {selectedTags.length > 0 && (
            <div className="p-3 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 rounded-lg border border-slate-200 dark:border-slate-700">
              <div className="flex items-center gap-1 mb-2">
                <TagIcon className="w-3.5 h-3.5 text-blue-600" />
                <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Selected Tags</span>
                <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1">
                  {selectedTags.length}
                </Badge>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {selectedTags.map((tag) => (
                  <div key={tag.id} className="flex items-center group">
                    <Tag title={tag.name} colorName={tag.color} />
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0 ml-0.5 opacity-0 group-hover:opacity-100 transition-opacity"
                      onClick={() => handleDeleteSelection(tag.id)}
                    >
                      <X className="w-3 h-3 text-slate-500 hover:text-rose-500" />
                    </Button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Color Picker */}
          <div className="p-3 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-1 mb-2">
              <Palette className="w-3.5 h-3.5 text-indigo-600" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Tag Color</span>
            </div>
            <div className="flex items-center gap-2">
              {TAG_COLORS.map((colorName) => (
                <Tooltip key={colorName}>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={() => setSelectedColor(colorName)}
                      className={cn(
                        "relative rounded-lg transition-all duration-200",
                        selectedColor === colorName && "ring-2 ring-offset-2 ring-blue-500"
                      )}
                    >
                      <div className={`w-8 h-8 rounded-lg bg-gradient-to-r ${colorMap[colorName]}`} />
                      {selectedColor === colorName && (
                        <div className="absolute -top-1 -right-1 w-3 h-3 bg-blue-500 rounded-full border-2 border-white dark:border-slate-900" />
                      )}
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">{colorName}</p>
                  </TooltipContent>
                </Tooltip>
              ))}
            </div>
          </div>

          {/* Add New Tag */}
          <div className="relative">
            <Command className="bg-transparent border border-slate-200 dark:border-slate-700 rounded-lg overflow-hidden">
              <div className="relative">
                <CommandInput
                  placeholder="Create new tag..."
                  value={value}
                  onValueChange={setValue}
                  className="h-10 pr-10 text-sm"
                />
                <Tooltip>
                  <TooltipTrigger asChild>
                    <button
                      type="button"
                      onClick={handleAddTag}
                      disabled={!value || !selectedColor}
                      className={cn(
                        "absolute top-1/2 transform -translate-y-1/2 right-2 transition-all",
                        value && selectedColor
                          ? "text-blue-600 hover:text-blue-700 cursor-pointer"
                          : "text-slate-300 cursor-not-allowed"
                      )}
                    >
                      <PlusCircle className="w-5 h-5" />
                    </button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">
                    <p className="text-xs">
                      {!value ? "Enter a tag name" : !selectedColor ? "Select a color" : "Add tag"}
                    </p>
                  </TooltipContent>
                </Tooltip>
              </div>
            </Command>
          </div>

          {/* Tag List */}
          <div className="p-3 bg-gradient-to-br from-slate-50 to-white dark:from-slate-900 dark:to-slate-950 rounded-lg border border-slate-200 dark:border-slate-700">
            <div className="flex items-center gap-1 mb-2">
              <TagIcon className="w-3.5 h-3.5 text-cyan-600" />
              <span className="text-xs font-medium text-slate-600 dark:text-slate-400">Available Tags</span>
              <Badge variant="outline" className="ml-auto text-[10px] h-4 px-1">
                {tags.length}
              </Badge>
            </div>

            <Command className="bg-transparent">
              <CommandList className="max-h-[200px]">
                <CommandEmpty className="py-6 text-center">
                  <div className="flex flex-col items-center gap-2">
                    <TagIcon className="w-8 h-8 text-slate-300" />
                    <p className="text-xs text-slate-500">No tags found</p>
                    <p className="text-[10px] text-slate-400">Create your first tag above</p>
                  </div>
                </CommandEmpty>

                <CommandGroup>
                  <div className="space-y-1">
                    {tags.map((tag) => (
                      <div
                        key={tag.id}
                        className="flex items-center justify-between p-1.5 rounded-md hover:bg-slate-50 dark:hover:bg-slate-800/50 group"
                      >
                        <button
                          type="button"
                          onClick={() => handleAddSelections(tag)}
                          className="flex-1 text-left"
                        >
                          <Tag title={tag.name} colorName={tag.color} />
                        </button>

                        <AlertDialogTrigger asChild>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                          >
                            <Trash className="w-3.5 h-3.5 text-slate-500 hover:text-rose-500" />
                          </Button>
                        </AlertDialogTrigger>

                        <AlertDialogContent>
                          <AlertDialogHeader>
                            <AlertDialogTitle className="flex items-center gap-2 text-base">
                              <AlertCircle className="w-5 h-5 text-rose-500" />
                              Delete Tag
                            </AlertDialogTitle>
                            <AlertDialogDescription className="text-sm">
                              Are you sure you want to delete "{tag.name}"? This action cannot be undone.
                            </AlertDialogDescription>
                          </AlertDialogHeader>
                          <AlertDialogFooter>
                            <AlertDialogCancel className="h-9 text-xs">Cancel</AlertDialogCancel>
                            <AlertDialogAction
                              onClick={() => handleDeleteTag(tag.id)}
                              className="h-9 text-xs bg-gradient-to-r from-rose-600 to-pink-600 hover:from-rose-700 hover:to-pink-700"
                            >
                              Delete Tag
                            </AlertDialogAction>
                          </AlertDialogFooter>
                        </AlertDialogContent>
                      </div>
                    ))}
                  </div>
                </CommandGroup>
              </CommandList>
            </Command>
          </div>
        </div>
      </AlertDialog>
    </TooltipProvider>
  );
};

export default TagDetails;