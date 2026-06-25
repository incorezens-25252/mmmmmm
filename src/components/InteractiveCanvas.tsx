import React, { useState, useRef, useEffect } from "react";
import { Move, ZoomIn, ZoomOut, RotateCw, Image as ImageIcon, FileText, Sliders } from "lucide-react";
import { CustomizationSettings } from "../types";

interface InteractiveCanvasProps {
  filename: string;
  fileType: string;
  fileData: string; // Base64 data url
  settings: CustomizationSettings;
  onUpdateSettings: (settings: CustomizationSettings) => void;
}

export default function InteractiveCanvas({
  filename,
  fileType,
  fileData,
  settings,
  onUpdateSettings,
}: InteractiveCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [dragStart, setDragStart] = useState({ x: 0, y: 0 });

  const isImage = fileType.startsWith("image/");
  const isPdf = fileType === "application/pdf" || filename.toLowerCase().endsWith(".pdf");

  // Same-origin Blob URL state for PDFs to enable security-exception-free printing
  const [pdfBlobUrl, setPdfBlobUrl] = useState("");

  useEffect(() => {
    if (!isPdf || !fileData) {
      setPdfBlobUrl("");
      return;
    }
    if (fileData.startsWith("blob:")) {
      setPdfBlobUrl(fileData);
      return;
    }

    let active = true;
    let url = "";
    try {
      const parts = fileData.split(",");
      const mime = parts[0].match(/:(.*?);/)?.[1] || "application/pdf";
      const base64Content = parts[1] || parts[0];
      const binary = atob(base64Content);
      const array = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        array[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([array], { type: mime });
      url = URL.createObjectURL(blob);
      if (active) {
        setPdfBlobUrl(url);
      }
    } catch (err) {
      console.error("Failed to convert base64 to Blob URL:", err);
      if (active) {
        setPdfBlobUrl(fileData);
      }
    }

    return () => {
      active = false;
      if (url && url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
      }
    };
  }, [fileData, isPdf]);

  // Filter styles
  const filterStyle = () => {
    switch (settings.filter) {
      case "grayscale":
        return "grayscale contrast-110";
      case "sepia":
        return "sepia saturate-150 brightness-95";
      default:
        return "";
    }
  };

  // Color mode overlay
  const colorModeClass = () => {
    if (settings.colorMode === "bw") {
      return "grayscale contrast-125";
    }
    return "";
  };

  // Drag handlers for direct canvas panning
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isImage) return;
    setIsDragging(true);
    setDragStart({ x: e.clientX - settings.offsetX, y: e.clientY - settings.offsetY });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const newX = e.clientX - dragStart.x;
    const newY = e.clientY - dragStart.y;
    onUpdateSettings({
      ...settings,
      offsetX: Math.max(-250, Math.min(250, newX)),
      offsetY: Math.max(-250, Math.min(250, newY)),
    });
  };

  const handleMouseUpOrLeave = () => {
    setIsDragging(false);
  };

  // Keyboard shortcut or micro adjustment button functions
  const adjustValue = (key: "scale" | "offsetX" | "offsetY" | "rotation", delta: number) => {
    let value = settings[key] + delta;
    if (key === "scale") {
      value = Math.max(0.1, Math.min(3.0, value));
    } else if (key === "rotation") {
      value = (value + 360) % 360;
    } else {
      value = Math.max(-250, Math.min(250, value));
    }
    onUpdateSettings({
      ...settings,
      [key]: value,
    });
  };

  return (
    <div className="flex flex-col w-full bg-white border border-slate-200 rounded-3xl p-6 shadow-sm">
      {/* Canvas Frame Header */}
      <div className="w-full flex items-center justify-between mb-5 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          {isImage ? (
            <ImageIcon className="w-4 h-4 text-blue-600" />
          ) : (
            <FileText className="w-4 h-4 text-blue-600" />
          )}
          <span className="text-xs font-bold text-slate-700 max-w-[200px] truncate">
            {filename}
          </span>
        </div>
        <div className="flex items-center gap-1.5 bg-slate-100 px-2.5 py-1 rounded-md text-[10px] text-slate-500 font-bold tracking-wider uppercase">
          Format: {isImage ? "IMAGE" : "DOCUMENT/PDF"}
        </div>
      </div>

      {/* Simulator Backdrop Area */}
      <div
        ref={containerRef}
        className="relative w-full aspect-[4/3] flex items-center justify-center bg-slate-100 rounded-2xl overflow-hidden shadow-inner border border-slate-200 select-none group"
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUpOrLeave}
        onMouseLeave={handleMouseUpOrLeave}
      >
        {/* Interactive Overlay helpers */}
        {isImage && (
          <div className="absolute top-3 left-3 z-10 bg-slate-900/80 backdrop-blur-md text-[10px] text-white font-mono px-2.5 py-1 rounded-md flex items-center gap-1.5 opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none shadow-sm">
            <Move className="w-3 h-3 text-blue-400 animate-pulse" />
            Drag image directly to reposition
          </div>
        )}

        {/* 1. DOCUMENT PREVIEW (A4 PAGE SIMULATOR) */}
        {settings.merchandiseType === "document" && (
          <div
            id="print-area"
            className="relative w-[60%] aspect-[1/1.414] bg-white text-slate-900 shadow-xl rounded-sm border border-slate-200/80 overflow-hidden flex flex-col justify-between p-4 transition-all duration-300"
          >
            {/* Watermark grid background */}
            <div className="absolute inset-0 bg-[radial-gradient(#e2e8f0_1px,transparent_1px)] [background-size:12px_12px] opacity-60 pointer-events-none" />

            {isImage ? (
              <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
                <img
                  src={fileData}
                  alt="Print Preview"
                  draggable={false}
                  onMouseDown={handleMouseDown}
                  className={`max-w-none origin-center cursor-move transition-shadow duration-150 ${filterStyle()} ${colorModeClass()}`}
                  style={{
                    transform: `translate(${settings.offsetX}px, ${settings.offsetY}px) scale(${settings.scale}) rotate(${settings.rotation}deg)`,
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }}
                />
              </div>
            ) : (
              // Only raw PDF iframe occupying full 100% area
              <iframe
                src={`${pdfBlobUrl || fileData}#toolbar=0&navpanes=0&scrollbar=1`}
                title="PDF Live Preview"
                className="w-full h-full border-0 absolute inset-0 z-10 bg-white rounded-sm"
              />
            )}
          </div>
        )}

        {/* 2. MUG PREVIEW */}
        {settings.merchandiseType === "mug" && (
          <div className="relative w-48 h-48 flex items-center justify-center">
            {/* Mug handle */}
            <div className="absolute right-3 w-10 h-20 border-8 border-slate-300 rounded-r-3xl bg-transparent z-0 transform translate-x-2" />
            {/* Mug body */}
            <div className="w-36 h-40 bg-white border-4 border-slate-200 rounded-b-3xl rounded-t-md shadow-lg flex items-center justify-center overflow-hidden relative z-10">
              <div className="absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-slate-100/50 to-transparent pointer-events-none" />
              {/* Printed area cylinder */}
              <div className="w-20 h-24 border border-dashed border-slate-200 flex items-center justify-center overflow-hidden bg-slate-50/50 relative rounded-sm">
                {isImage ? (
                  <img
                    src={fileData}
                    alt="Mug Graphic"
                    draggable={false}
                    onMouseDown={handleMouseDown}
                    className={`max-w-none cursor-move transition-shadow duration-150 ${filterStyle()} ${colorModeClass()}`}
                    style={{
                      transform: `translate(${settings.offsetX * 0.4}px, ${settings.offsetY * 0.4}px) scale(${settings.scale}) rotate(${settings.rotation}deg)`,
                      maxWidth: "100%",
                      maxHeight: "100%",
                    }}
                  />
                ) : (
                  <div className="text-center p-2">
                    <FileText className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                    <span className="text-[8px] font-bold text-slate-400 block truncate max-w-[70px]">
                      {filename}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* 3. T-SHIRT PREVIEW */}
        {settings.merchandiseType === "tshirt" && (
          <div className="relative w-64 h-64 flex items-center justify-center">
            {/* Custom High-fidelity T-Shirt silhouette */}
            <div className="absolute inset-0 flex items-center justify-center text-slate-200 opacity-95">
              <svg
                viewBox="0 0 24 24"
                className="w-56 h-56 fill-current drop-shadow-md"
              >
                <path d="M18,2H16.22a3,3,0,0,0-4.44,0H10a3,3,0,0,0-4.44,0H3.8a1,1,0,0,0-1,1.11l1,9A1,1,0,0,0,4.8,13H6v8a1,1,0,0,0,1,1H17a1,1,0,0,0,1-1V13h1.2a1,1,0,0,0,1-.89l1-9A1,1,0,0,0,20.2,2ZM18,12H16v8H8V12H6V4H8.4a1,1,0,0,0,.82-.42,1,1,0,0,1,1.56,0A1,1,0,0,0,11.6,4h.8a1,1,0,0,0,.82-.42,1,1,0,0,1,1.56,0A1,1,0,0,0,15.6,4H18Z" />
              </svg>
            </div>

            {/* Print area bounding box */}
            <div className="absolute w-20 h-24 border border-dashed border-blue-500/30 bg-slate-50/50 rounded flex items-center justify-center overflow-hidden z-10 transform -translate-y-2">
              {isImage ? (
                <img
                  src={fileData}
                  alt="T-Shirt Graphic"
                  draggable={false}
                  onMouseDown={handleMouseDown}
                  className={`max-w-none cursor-move transition-shadow duration-150 ${filterStyle()} ${colorModeClass()}`}
                  style={{
                    transform: `translate(${settings.offsetX * 0.35}px, ${settings.offsetY * 0.35}px) scale(${settings.scale * 0.85}) rotate(${settings.rotation}deg)`,
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }}
                />
              ) : (
                <div className="text-center p-2">
                  <FileText className="w-8 h-8 mx-auto text-slate-300 mb-1" />
                  <span className="text-[8px] font-bold text-slate-400 block truncate max-w-[50px]">
                    {filename}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 4. POSTER PREVIEW */}
        {settings.merchandiseType === "poster" && (
          <div className="relative w-52 aspect-[3/4] bg-slate-900 border-8 border-slate-950 rounded-md shadow-lg overflow-hidden flex items-center justify-center p-1.5">
            <div className="absolute inset-0 bg-gradient-to-tr from-slate-900 via-slate-800 to-slate-900 opacity-60" />
            <div className="relative w-full h-full border border-slate-700/30 flex items-center justify-center overflow-hidden bg-black">
              {isImage ? (
                <img
                  src={fileData}
                  alt="Poster Graphic"
                  draggable={false}
                  onMouseDown={handleMouseDown}
                  className={`max-w-none cursor-move transition-shadow duration-150 ${filterStyle()} ${colorModeClass()}`}
                  style={{
                    transform: `translate(${settings.offsetX * 0.75}px, ${settings.offsetY * 0.75}px) scale(${settings.scale * 1.05}) rotate(${settings.rotation}deg)`,
                    maxWidth: "100%",
                    maxHeight: "100%",
                  }}
                />
              ) : (
                <div className="text-center p-4">
                  <FileText className="w-10 h-10 mx-auto text-slate-500 mb-2" />
                  <span className="text-[10px] font-mono text-slate-400 block truncate max-w-[100px]">
                    {filename}
                  </span>
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Sleek Layout Adjustments Panel */}
      {isImage && (
        <div className="w-full mt-5 bg-slate-50 p-4 rounded-2xl border border-slate-200">
          <div className="flex items-center gap-1.5 mb-3 text-slate-700 font-extrabold uppercase tracking-widest text-[10px]">
            <Sliders className="w-3.5 h-3.5 text-blue-600" /> Layout Alignment Fine-Tuning
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Scale Slider */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                <ZoomIn className="w-3.5 h-3.5 text-blue-600" /> Zoom Scale
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjustValue("scale", -0.1)}
                  className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                >
                  <ZoomOut className="w-4 h-4" />
                </button>
                <input
                  type="range"
                  min="0.1"
                  max="3.0"
                  step="0.05"
                  value={settings.scale}
                  onChange={(e) =>
                    onUpdateSettings({ ...settings, scale: parseFloat(e.target.value) })
                  }
                  className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />
                <button
                  onClick={() => adjustValue("scale", 0.1)}
                  className="p-1.5 rounded-lg bg-white hover:bg-slate-100 text-slate-600 border border-slate-200"
                >
                  <ZoomIn className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Rotation Buttons */}
            <div className="flex flex-col gap-1.5">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                <RotateCw className="w-3.5 h-3.5 text-blue-600" /> Rotation
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => adjustValue("rotation", -90)}
                  className="flex-1 py-2 text-[10px] font-bold rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                >
                  Rotate -90°
                </button>
                <button
                  onClick={() => adjustValue("rotation", 90)}
                  className="flex-1 py-2 text-[10px] font-bold rounded-lg bg-white border border-slate-200 hover:bg-slate-100 text-slate-700 transition-colors"
                >
                  Rotate +90°
                </button>
                <span className="text-[10px] font-bold text-slate-600 bg-white px-2.5 py-2 rounded-lg border border-slate-200 min-w-[45px] text-center">
                  {settings.rotation}°
                </span>
              </div>
            </div>

            {/* Offsets positioning sliders */}
            <div className="md:col-span-2 flex flex-col gap-1.5 border-t border-slate-200/60 pt-3">
              <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1.5 uppercase tracking-wider">
                <Move className="w-3.5 h-3.5 text-blue-600" /> Manual Center Alignment Shift (X & Y)
              </span>
              <div className="flex flex-col sm:flex-row gap-4">
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400">Horizontal (X):</span>
                  <input
                    type="range"
                    min="-250"
                    max="250"
                    value={settings.offsetX}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, offsetX: parseInt(e.target.value) })
                    }
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-[10px] font-bold text-slate-600 min-w-[35px] text-right">
                    {settings.offsetX}px
                  </span>
                </div>
                <div className="flex-1 flex items-center gap-2">
                  <span className="text-[10px] font-bold text-slate-400">Vertical (Y):</span>
                  <input
                    type="range"
                    min="-250"
                    max="250"
                    value={settings.offsetY}
                    onChange={(e) =>
                      onUpdateSettings({ ...settings, offsetY: parseInt(e.target.value) })
                    }
                    className="w-full h-1 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                  />
                  <span className="text-[10px] font-bold text-slate-600 min-w-[35px] text-right">
                    {settings.offsetY}px
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
