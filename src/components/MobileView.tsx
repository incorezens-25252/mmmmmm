import React, { useState, useEffect } from "react";
import { Upload, CheckCircle2, FileText, Image as ImageIcon, AlertCircle, Smartphone, ShieldCheck, RefreshCw } from "lucide-react";

interface MobileViewProps {
  sessionId: string;
}

export default function MobileView({ sessionId }: MobileViewProps) {
  const [file, setFile] = useState<File | null>(null);
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

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const selected = e.target.files[0];
      // File type checks
      const isValidType =
        selected.type.startsWith("image/") ||
        selected.type === "application/pdf" ||
        selected.name.toLowerCase().endsWith(".pdf");

      if (!isValidType) {
        setErrorMessage("Unsupported file. Please select an image or a PDF document.");
        return;
      }

      // 15MB size limit to avoid extreme base64 overheads
      if (selected.size > 15 * 1024 * 1024) {
        setErrorMessage("File exceeds 15MB limit. Please upload a smaller file.");
        return;
      }

      setErrorMessage("");
      setFile(selected);
    }
  };

  const handleUpload = async () => {
    if (!file) return;

    setLoading(true);
    setUploadProgress(10);

    const reader = new FileReader();
    reader.onload = async () => {
      try {
        const base64Data = reader.result as string;
        setUploadProgress(40);

        const response = await fetch(`/api/session/${sessionId}/upload`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            filename: file.name,
            fileType: file.type || (file.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg"),
            fileData: base64Data,
          }),
        });

        setUploadProgress(80);

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

    reader.onerror = () => {
      setLoading(false);
      setStatus("error");
      setErrorMessage("Could not parse file. It might be corrupted.");
    };

    reader.readAsDataURL(file);
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
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      const selected = e.dataTransfer.files[0];
      setFile(selected);
    }
  };

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
          <h1 className="text-2xl font-black text-slate-900 mb-2 tracking-tight">
            Sent Successfully!
          </h1>
          <p className="text-sm text-slate-500 mb-6 leading-relaxed">
            Your file <strong className="text-slate-800 font-bold">"{file?.name}"</strong> has been transferred.
          </p>
          
          <div className="bg-slate-50 rounded-2xl p-5 mb-6 border border-slate-200 text-left">
            <h2 className="text-xs font-bold text-slate-700 mb-2.5 flex items-center gap-1.5 uppercase tracking-wide">
              <Smartphone className="w-4 h-4 text-blue-600" /> Next Actions
            </h2>
            <ol className="text-xs text-slate-600 space-y-2 list-decimal list-inside leading-relaxed font-medium">
              <li>Check your computer / desktop screen.</li>
              <li>Position, align, or select specific pages.</li>
              <li>Tap <strong className="text-blue-600">Dispatch to USB Printer</strong> to release.</li>
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
      <header className="w-full max-w-md mx-auto py-4 mb-6 flex items-center justify-between border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-600/10">
            <span className="text-white font-bold text-sm">P</span>
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
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm flex flex-col">
          <div className="mb-5 text-center">
            <h2 className="text-lg font-black text-slate-800">
              Transmit Document
            </h2>
            <p className="text-xs text-slate-500 mt-1 font-medium">
              Choose an image or PDF from your library to customize on-screen.
            </p>
          </div>

          {/* Drag & Drop File Zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`border-2 border-dashed rounded-2xl p-6 text-center transition-all ${
              dragOver
                ? "border-blue-600 bg-blue-50/50"
                : file
                ? "border-slate-300 bg-slate-50"
                : "border-slate-200 hover:border-slate-300 bg-slate-50/50"
            }`}
          >
            <input
              type="file"
              id="mobile-file-picker"
              accept="image/*,application/pdf"
              className="hidden"
              onChange={handleFileChange}
              disabled={loading}
            />

            {file ? (
              <div className="flex flex-col items-center">
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3 border border-blue-100">
                  {file.type === "application/pdf" ? (
                    <FileText className="w-6 h-6" />
                  ) : (
                    <ImageIcon className="w-6 h-6" />
                  )}
                </div>
                <span className="text-xs font-bold text-slate-800 max-w-[200px] truncate block">
                  {file.name}
                </span>
                <span className="text-[10px] text-slate-400 font-mono mt-1 font-bold">
                  {(file.size / 1024 / 1024).toFixed(2)} MB
                </span>

                <button
                  onClick={() => setFile(null)}
                  disabled={loading}
                  className="mt-3.5 text-[10px] text-rose-500 hover:text-rose-600 font-bold uppercase tracking-wider"
                >
                  Choose Another File
                </button>
              </div>
            ) : (
              <label
                htmlFor="mobile-file-picker"
                className="cursor-pointer flex flex-col items-center py-4"
              >
                <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mb-3 border border-blue-100/50 group-hover:scale-105 transition-transform">
                  <Upload className="w-5 h-5" />
                </div>
                <span className="text-xs font-bold text-slate-700">
                  Select Document
                </span>
                <span className="text-[10px] text-slate-400 mt-1 block font-medium">
                  Images or PDF files up to 15MB
                </span>
              </label>
            )}
          </div>

          {/* Error Message */}
          {errorMessage && (
            <div className="mt-4 p-3.5 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-xs flex items-start gap-2 font-medium">
              <AlertCircle className="w-4 h-4 mt-0.5 flex-shrink-0 text-rose-500" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Progress loader */}
          {loading && (
            <div className="mt-5">
              <div className="flex justify-between items-center text-[10px] text-slate-500 font-mono mb-1.5 font-bold">
                <span>TRANSMITTING...</span>
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
            disabled={!file || loading}
            className={`mt-6 w-full py-3.5 px-4 rounded-xl text-xs font-bold tracking-wider uppercase flex items-center justify-center gap-2 transition-all ${
              !file || loading
                ? "bg-slate-100 text-slate-400 cursor-not-allowed border border-slate-200/50"
                : "bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-600/10 active:scale-95"
            }`}
          >
            {loading ? "Transmitting file..." : "Send to PrintIO Terminal"}
          </button>
        </div>

        {/* Secure Cloud Auto-delete disclaimer */}
        <div className="mt-6 text-center text-[10px] text-slate-400 font-bold uppercase tracking-wider flex items-center justify-center gap-1.5 leading-relaxed">
          <ShieldCheck className="w-4 h-4 text-emerald-500" /> Cloud memory scrub triggered automatically on print.
        </div>

        {/* Mobile App Installation Guide Card */}
        <div className="mt-8 bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <Smartphone className="w-4 h-4 text-blue-600" />
            <h3 className="text-xs font-black text-slate-800 uppercase tracking-wider">
              Install as Mobile App / मोबाइल ऐप कैसे बनाएं?
            </h3>
          </div>
          
          <div className="space-y-3.5 text-[11px] text-slate-600 leading-relaxed">
            <div className="border-b border-slate-100 pb-3">
              <span className="font-bold text-slate-800 block mb-1">🤖 For Android (Google Chrome):</span>
              <p>
                Tap the three dots icon (⋮) in the top-right corner of Chrome, then select <strong className="text-blue-600">"Add to Home screen"</strong> or <strong className="text-blue-600">"Install app"</strong>.
              </p>
              <p className="text-slate-500 mt-1 italic">
                क्रोम के ऊपर दाईं ओर तीन डॉट्स (⋮) पर टैप करें, फिर <strong>"Add to Home screen"</strong> या <strong>"Install app"</strong> चुनें।
              </p>
            </div>
            
            <div>
              <span className="font-bold text-slate-800 block mb-1">🍏 For iPhone/iOS (Apple Safari):</span>
              <p>
                Tap the <strong className="text-blue-600">Share</strong> button (box with an arrow pointing up) at the bottom, scroll down, and tap <strong className="text-blue-600">"Add to Home Screen"</strong>.
              </p>
              <p className="text-slate-500 mt-1 italic">
                सफारी ब्राउज़र में नीचे दिए गए <strong>Share</strong> बटन (तीर का निशान) पर टैप करें, फिर स्क्रॉल करके <strong>"Add to Home Screen"</strong> चुनें।
              </p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
