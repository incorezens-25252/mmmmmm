import React, { useState, useEffect } from "react";
import { Upload, CheckCircle2, FileText, Image as ImageIcon, AlertCircle, Smartphone, ShieldCheck, RefreshCw, Trash2, Plus } from "lucide-react";

interface MobileViewProps {
  sessionId: string;
}

interface UploadedFileState {
  file: File;
  base64: string;
  pageCount: number;
}

export default function MobileView({ sessionId }: MobileViewProps) {
  const [selectedFiles, setSelectedFiles] = useState<UploadedFileState[]>([]);
  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [status, setStatus] = useState<"checking" | "ready" | "uploaded" | "error" | "expired">("checking");
  const [errorMessage, setErrorMessage] = useState("");

  // PWA Install Prompt State for Mobile
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  // Verify that the session is valid when mobile loads
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await fetch(`/api/session/${sessionId}`);
        if (!res.ok) {
          setStatus("expired");
        } else {
          const data = await res.json();
          if (data.status === "completed") {
            setStatus("expired");
          } else {
            setStatus("ready");
          }
        }
      } catch (err) {
        setStatus("error");
        setErrorMessage("Network issue connecting to PrintIO. Please try again.");
      }
    }
    checkSession();
  }, [sessionId]);

  // Listen for mobile PWA install capability
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    if (window.matchMedia("(display-mode: standalone)").matches) {
      setShowInstallBtn(false);
    }

    return () => {
      window.removeEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallApp = async () => {
    if (!deferredPrompt) return;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === "accepted") {
      console.log("User installed the PrintIO mobile app");
    }
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  const readFileData = (file: File): Promise<{ base64: string; pageCount: number }> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const base64 = reader.result as string;
        let pageCount = 1;

        if (file.type === "application/pdf" || file.name.toLowerCase().endsWith(".pdf")) {
          try {
            const base64Content = base64.includes(",") ? base64.split(",")[1] : base64;
            const binary = atob(base64Content);
            const pageMatches = binary.match(/\/Type\s*\/Page\b/g);
            if (pageMatches) {
              pageCount = pageMatches.length;
            } else {
              const countMatches = binary.match(/\/Count\s+(\d+)/);
              if (countMatches && countMatches[1]) {
                pageCount = parseInt(countMatches[1], 10);
              }
            }
          } catch (err) {
            console.error("Failed to parse PDF page count:", err);
          }
        }

        resolve({ base64, pageCount });
      };
      reader.onerror = () => reject(new Error("File reading error"));
      reader.readAsDataURL(file);
    });
  };

  const processAndAddFiles = async (filesList: FileList) => {
    setErrorMessage("");
    const newFiles: UploadedFileState[] = [...selectedFiles];

    for (let i = 0; i < filesList.length; i++) {
      const file = filesList[i];
      const isValidType =
        file.type.startsWith("image/") ||
        file.type === "application/pdf" ||
        file.name.toLowerCase().endsWith(".pdf");

      if (!isValidType) {
        setErrorMessage("Unsupported file. Please select images or PDF documents only.");
        continue;
      }

      if (file.size > 25 * 1024 * 1024) {
        setErrorMessage(`"${file.name}" exceeds the 25MB limit.`);
        continue;
      }

      // Check if file is already added to list
      const isDuplicate = newFiles.some((f) => f.file.name === file.name && f.file.size === file.size);
      if (isDuplicate) continue;

      try {
        const { base64, pageCount } = await readFileData(file);
        newFiles.push({ file, base64, pageCount });
      } catch (err) {
        setErrorMessage(`Failed to read "${file.name}".`);
      }
    }

    setSelectedFiles(newFiles);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      await processAndAddFiles(e.target.files);
    }
  };

  const handleRemoveFile = (index: number) => {
    setSelectedFiles(selectedFiles.filter((_, i) => i !== index));
  };

  const handleUpload = async () => {
    if (selectedFiles.length === 0) return;

    setLoading(true);
    setUploadProgress(10);

    try {
      const filesPayload = selectedFiles.map((f) => ({
        filename: f.file.name,
        fileType: f.file.type || (f.file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
        fileData: f.base64,
        pageCount: f.pageCount,
      }));

      setUploadProgress(40);

      const response = await fetch(`/api/session/${sessionId}/upload`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          files: filesPayload,
        }),
      });

      setUploadProgress(85);

      if (response.ok) {
        setUploadProgress(100);
        setStatus("uploaded");
      } else {
        setStatus("error");
        setErrorMessage("Failed to upload. Please try starting a fresh session.");
      }
    } catch (error) {
      setStatus("error");
      setErrorMessage("A network error occurred while uploading. Please retry.");
    } finally {
      setLoading(false);
    }
  };

  // Drag-Drop handlers for mobile browser
  const [dragOver, setDragOver] = useState(false);
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => {
    setDragOver(false);
  };
  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      await processAndAddFiles(e.dataTransfer.files);
    }
  };

  // Page Summary totals
  const totalFiles = selectedFiles.length;
  const totalPages = selectedFiles.reduce((sum, f) => sum + f.pageCount, 0);

  // CHECKING STATE
  if (status === "checking") {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-6">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="w-10 h-10 border-4 border-t-blue-600 border-slate-200 rounded-full animate-spin" />
          <p className="text-xs font-mono text-slate-500 font-semibold uppercase tracking-wider">Establishing handshakes with PrintIO...</p>
        </div>
      </div>
    );
  }

  // EXPIRED / INVALID STATE
  if (status === "expired") {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-3xl p-8 text-center shadow-md">
          <div className="w-16 h-16 bg-rose-50 text-rose-600 rounded-full flex items-center justify-center mx-auto mb-5 border border-rose-100">
            <AlertCircle className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold tracking-tight mb-2 text-slate-900">
            Session Closed or Expired
          </h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            This printing session is no longer active or the print job has already completed. Please scan a fresh QR code from the desktop terminal.
          </p>
          <div className="text-[9px] text-slate-400 font-bold uppercase tracking-widest font-mono">
            PRINTIO SECURITY GATEWAY
          </div>
        </div>
      </div>
    );
  }

  // COMPLETED/UPLOADED SUCCESS STATE
  if (status === "uploaded") {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-emerald-200 rounded-3xl p-8 text-center shadow-lg relative overflow-hidden">
          <div className="absolute top-0 inset-x-0 h-1.5 bg-emerald-500" />
          
          <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100">
            <CheckCircle2 className="w-10 h-10" />
          </div>
          <h1 className="text-2xl font-black text-slate-900 mb-2 tracking-tight animate-bounce">
            Sent Successfully!
          </h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Your <strong className="text-blue-600 font-extrabold">{totalFiles} files ({totalPages} pages)</strong> have been securely sent to the printer server.
          </p>
          
          <div className="bg-slate-50 rounded-2xl p-5 mb-6 border border-slate-200 text-left">
            <h2 className="text-xs font-bold text-slate-700 mb-2.5 flex items-center gap-1.5 uppercase tracking-wide">
              <Smartphone className="w-4 h-4 text-blue-600" /> Next Actions
            </h2>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed font-medium">
              <li>Check your computer / desktop screen.</li>
              <li>Select your files on the computer screen.</li>
              <li>Tap <strong className="text-blue-600">Dispatch to USB Printer</strong> to print.</li>
            </ol>
          </div>

          <div className="flex items-center justify-center gap-1.5 text-[9px] text-emerald-700 font-bold font-mono py-2 bg-emerald-50 rounded-lg border border-emerald-200/50 uppercase tracking-wider">
            <ShieldCheck className="w-4 h-4" /> Secure Cloud Buffer (Auto-deletes)
          </div>
        </div>
      </div>
    );
  }

  // READY FOR UPLOAD / DEFAULT UPLOAD FORM
  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col p-6">
      {/* Header */}
      <header className="w-full max-w-md mx-auto py-4 mb-4 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-600/10">
            <span className="text-white font-bold text-sm animate-pulse">P</span>
          </div>
          <div>
            <span className="font-extrabold text-slate-800 text-sm tracking-tight">PrintIO Secure Upload</span>
            <span className="block text-[9px] text-slate-400 font-bold uppercase tracking-wider">Mobile Portal</span>
          </div>
        </div>

        {showInstallBtn && (
          <button
            onClick={handleInstallApp}
            className="flex items-center gap-1 bg-blue-600 hover:bg-blue-700 text-white font-extrabold text-[10px] uppercase tracking-wider px-3 py-1.5 rounded-full transition-all shadow-md shadow-blue-500/10 cursor-pointer animate-pulse"
          >
            <Smartphone className="w-3.5 h-3.5" />
            Install App
          </button>
        )}
      </header>

      {/* Main Content */}
      <main className="w-full max-w-md mx-auto flex-grow flex flex-col justify-center">
        <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm flex flex-col">
          <div className="mb-4 text-center">
            <h2 className="text-lg font-black text-slate-800 leading-tight">
              Transmit Documents
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-semibold">
              Select multiple PDFs and Photos together to print at once.
            </p>
          </div>

          {/* Drag & Drop / Selection Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-4.5 text-center transition-all ${
              dragOver
                ? "border-blue-600 bg-blue-50/50"
                : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
            }`}
          >
            <input
              type="file"
              id="mobile-file-picker"
              accept="image/*,application/pdf,.pdf"
              className="hidden"
              multiple={true}
              onChange={handleFileChange}
              disabled={loading}
            />

            <label
              htmlFor="mobile-file-picker"
              className="cursor-pointer flex flex-col items-center py-1.5"
            >
              <div className="w-11 h-11 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-2.5 border border-blue-100/50 group-hover:scale-105 transition-transform shadow-sm">
                <Upload className="w-5 h-5" />
              </div>
              <span className="text-xs font-extrabold text-blue-600 uppercase tracking-wide">
                Select PDFs or Images
              </span>
              <span className="text-[10px] text-slate-500 mt-1 block font-medium leading-relaxed px-2">
                Choose <strong className="text-slate-800">multiple files</strong> at once.
              </span>
              <span className="text-[9px] text-slate-400 mt-2 block font-normal leading-normal">
                💡 <strong className="text-slate-500">Tip:</strong> Press and hold a file on your phone to select multiple files!
              </span>
            </label>
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs flex items-start gap-2 font-medium">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Selected Files List */}
          {selectedFiles.length > 0 && (
            <div className="mt-4 space-y-2">
              <div className="flex justify-between items-center text-[10px] font-bold text-slate-400 uppercase tracking-wider pb-1 border-b border-slate-100">
                <span>Selected Files ({totalFiles})</span>
                <label
                  htmlFor="mobile-file-picker"
                  className="text-blue-600 hover:text-blue-700 cursor-pointer flex items-center gap-1 font-black text-[9px] uppercase tracking-wider bg-blue-50 px-2 py-1 rounded-lg border border-blue-100"
                >
                  <Plus className="w-3 h-3" /> Add More
                </label>
              </div>
              
              <div className="max-h-[180px] overflow-y-auto space-y-1.5 pr-1">
                {selectedFiles.map((fileObj, idx) => (
                  <div
                    key={`${fileObj.file.name}-${idx}`}
                    className="flex items-center justify-between p-2.5 bg-slate-50 border border-slate-100 rounded-xl hover:border-slate-200 transition-colors"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <div className="w-8 h-8 bg-white border border-slate-200 rounded flex items-center justify-center text-slate-500 flex-shrink-0 shadow-sm">
                        {fileObj.file.type === "application/pdf" || fileObj.file.name.toLowerCase().endsWith(".pdf") ? (
                          <FileText className="w-4 h-4 text-rose-500" />
                        ) : (
                          <ImageIcon className="w-4 h-4 text-sky-500" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <div className="text-[11px] font-bold text-slate-700 truncate max-w-[160px] leading-snug">
                          {fileObj.file.name}
                        </div>
                        <div className="text-[9px] text-slate-400 font-mono flex items-center gap-1.5 leading-none mt-0.5">
                          <span>{(fileObj.file.size / 1024 / 1024).toFixed(2)} MB</span>
                          <span>•</span>
                          <span className="text-blue-600 font-bold uppercase tracking-wider">
                            {fileObj.file.type === "application/pdf" || fileObj.file.name.toLowerCase().endsWith(".pdf")
                              ? `📄 ${fileObj.pageCount} Pages`
                              : "🖼️ 1 Page"}
                          </span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleRemoveFile(idx)}
                      disabled={loading}
                      className="p-1.5 text-slate-400 hover:text-rose-500 rounded-lg hover:bg-rose-50 transition-colors"
                      title="Remove file"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* Indian Rupees Dynamic Billing Estimate Panel */}
              <div className="mt-3.5 p-3.5 bg-blue-50/50 border border-blue-100 rounded-xl">
                <div className="text-[9px] font-extrabold text-blue-700 uppercase tracking-widest mb-2 flex items-center gap-1">
                  <span>💰 Dynamic Cost Estimates</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-1">Monochrome Print</span>
                    <span className="text-base font-black text-slate-800">₹{totalPages * 3}</span>
                    <span className="block text-[8px] text-slate-400 mt-0.5 font-medium">₹3 per page</span>
                  </div>
                  <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-center">
                    <span className="block text-[8px] font-bold uppercase tracking-wider text-slate-400 leading-none mb-1">Colour Print</span>
                    <span className="text-base font-black text-slate-800">₹{totalPages * 5}</span>
                    <span className="block text-[8px] text-slate-400 mt-0.5 font-medium">₹5 per page</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Progress loader */}
          {loading && (
            <div className="mt-4">
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mb-1.5 font-bold">
                <span>TRANSMITTING TO TERMINAL...</span>
                <span>{uploadProgress}%</span>
              </div>
              <div className="w-full h-1.5 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-blue-600 transition-all duration-300"
                  style={{ width: `${uploadProgress}%` }}
                />
              </div>
            </div>
          )}

          {/* Action Button */}
          <button
            onClick={handleUpload}
            disabled={selectedFiles.length === 0 || loading}
            className={`mt-4 w-full py-3.5 px-4 rounded-xl text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 transition-all ${
              selectedFiles.length === 0 || loading
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/50"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/10 active:scale-95 cursor-pointer"
            }`}
          >
            {loading ? "Sending files..." : `Send ${totalFiles > 0 ? `${totalFiles} Files` : "Files"} to Printer`}
          </button>
        </div>

        {/* Secure Cloud Auto-delete disclaimer */}
        <div className="mt-4 text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-emerald-500" /> Cloud memory scrub triggered automatically on print.
        </div>

        {/* Mobile App Installation Guide Card */}
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Install as Mobile App
            </h3>
          </div>
          
          <div className="space-y-3.5 text-[11px] text-slate-600 leading-relaxed">
            <div className="border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-800 block mb-1">🤖 For Android (Google Chrome):</span>
              <p>
                Tap the three dots icon (⋮) in the top-right corner of Chrome, then select <strong className="text-blue-600">"Add to Home screen"</strong> or <strong className="text-blue-600">"Install app"</strong>.
              </p>
            </div>
            
            <div>
              <span className="font-bold text-slate-800 block mb-1">🍏 For iPhone/iOS (Apple Safari):</span>
              <p>
                Tap the <strong className="text-blue-600">Share</strong> button (box with an arrow pointing up) at the bottom, scroll down, and tap <strong className="text-blue-600">"Add to Home Screen"</strong>.
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
