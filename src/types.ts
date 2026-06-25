export interface PrintSession {
  id: string;
  file?: {
    filename: string;
    fileType: string;
    fileData: string; // Base64 Content
    pageCount?: number;
  };
  files?: Array<{
    filename: string;
    fileType: string;
    fileData: string; // Base64 Content
    pageCount?: number;
  }>;
  status: "waiting" | "uploaded" | "completed";
}

export type PrintColorMode = "color" | "bw";
export type PrintQuality = "draft" | "standard" | "high";
export type MerchandiseType = "document" | "mug" | "tshirt" | "poster";

export interface CustomizationSettings {
  colorMode: PrintColorMode;
  quality: PrintQuality;
  merchandiseType: MerchandiseType;
  copies: number;
  doubleSided: boolean;
  
  // Image positioning & sizing
  scale: number;       // Range: 0.1 to 3.0
  offsetX: number;     // X-axis displacement
  offsetY: number;     // Y-axis displacement
  rotation: number;    // Rotation angle in degrees
  filter: "normal" | "grayscale" | "sepia";
  
  // PDF page management
  pageRangeMode: "all" | "first" | "custom";
  customPages: string; // e.g., "1, 3, 5-8"
}
