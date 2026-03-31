"use client";

import React from "react";
import { CldUploadWidget } from "next-cloudinary";
import Image from "next/image";
import { X } from "lucide-react";
import { Button } from "../ui/button";

interface FileUploadProps {
  onChange: (url: string) => void;
  value?: string | null;
}

const FileUpload: React.FC<FileUploadProps> = ({ onChange, value }) => {
  const imageUrl = value || "";

  const handleUploadSuccess = (result: any) => {
    try {
      const url =
        result?.info?.secure_url ||
        result?.secure_url ||
        result?.info?.url ||
        "";

      if (!url || typeof url !== "string") return;

      onChange(url);
    } catch {
      // silent fail (optional: integrate toast or monitoring service)
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
        <CldUploadWidget
          uploadPreset="builder"
          options={{
            maxFiles: 1,
            resourceType: "image",
            clientAllowedFormats: ["jpg", "jpeg", "png", "webp"],
            multiple: false,
            styles: {
              palette: {
                window: "#FFFFFF",
                windowBorder: "#90A0B3",
              },
              frame: {
                zIndex: "999999",
              },
            },
          }}
          onSuccess={handleUploadSuccess}
          onError={() => {
            // optional: show toast instead of console
          }}
        >
          {({ open }) => (
            <Button
              type="button"
              className="w-full"
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                open();
              }}
            >
              Upload Image
            </Button>
          )}
        </CldUploadWidget>
      )}
    </div>
  );
};

export default FileUpload;