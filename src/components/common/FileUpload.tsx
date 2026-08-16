"use client";

import React from "react";
import Image from "next/image";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "../ui/button";

interface FileUploadProps {
  onChange: (url: string) => void;
  value?: string | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ onChange, value }) => {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = React.useState(false);
  const imageUrl = value || "";
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
  const uploadPreset = "builder";

  const handleFileUpload = async (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!cloudName) {
      toast.error("Cloudinary is not configured", {
        description: "NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME is missing.",
      });
      event.target.value = "";
      return;
    }

    if (!file.type.startsWith("image/")) {
      toast.error("Unsupported file type", {
        description: "Please choose an image file.",
      });
      event.target.value = "";
      return;
    }

    const formData = new FormData();
    formData.append("file", file);
    formData.append("upload_preset", uploadPreset);

    setIsUploading(true);

    try {
      const response = await fetch(
        `https://api.cloudinary.com/v1_1/${cloudName}/image/upload`,
        {
          method: "POST",
          body: formData,
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result?.error?.message || "Cloudinary rejected the upload."
        );
      }

      const url = result?.secure_url || result?.url;

      if (!url || typeof url !== "string") {
        throw new Error("Cloudinary returned an invalid upload response.");
      }

      onChange(url);
    } catch (error) {
      console.error("[FileUpload] Cloudinary upload error:", error);
      toast.error("Upload failed", {
        description:
          error instanceof Error
            ? error.message
            : "Could not upload image to Cloudinary.",
      });
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  };

  return (
    <div className="w-full">
      {/* IMAGE PREVIEW */}
      {imageUrl && (
        <div className="flex items-start gap-4">
          <div className="relative w-32 h-32 border rounded-md overflow-hidden shrink-0">
            <Image
              src={imageUrl}
              alt="Uploaded Image"
              fill
              sizes="128px"
              className="object-contain"
              unoptimized
            />
          </div>

          <Button
            type="button"
            variant="outline"
            onClick={() => onChange("")}
          >
            <X className="h-4 w-4 mr-2" />
            Remove Image
          </Button>
        </div>
      )}

      {/* UPLOAD BUTTON */}
      {!imageUrl && (
        <>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleFileUpload}
          />
          <Button
            type="button"
            className="w-full"
            disabled={isUploading}
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              inputRef.current?.click();
            }}
          >
            {isUploading ? (
              <Loader2 role="status" className="mr-2 h-4 w-4 animate-spin" />
            ) : null}
            {isUploading ? "Uploading..." : "Upload Image"}
          </Button>
        </>
      )}
    </div>
  );
};

export default FileUpload;
