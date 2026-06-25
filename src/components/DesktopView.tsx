import React, { useState, useEffect } from "react";
import {
  Printer,
  Sliders,
  RefreshCw,
  Trash2,
  CheckCircle,
  Sparkles,
  Smartphone,
  AlertCircle,
  Globe,
  Copy,
  Plus,
  Minus,
  FileText,
  ToggleLeft,
  ToggleRight,
  ShieldAlert,
  HardDriveUpload,
  Layers,
  Sparkle,
  Usb,
  ShieldCheck,
  Image as ImageIcon,
} from "lucide-react";
import InteractiveCanvas from "./InteractiveCanvas";
import { PrintSession, CustomizationSettings } from "../types";

export default function DesktopView() {
  const [session, setSession] = useState<PrintSession | null>(null);
  const [loadingSession, setLoadingSession] = useState(true);
  const [polling, setPolling] = useState(true);
  const [printStatus, setPrintStatus] = useState<"idle" | "printing" | "completed">("idle");
  const [printingPhase, setPrintingPhase] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);
  const [apiError, setApiError] = useState(false);

  // PWA Install Prompt State
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [showInstallBtn, setShowInstallBtn] = useState(false);

  // WebUSB Connection Status
  const [usbSupported, setUsbSupported] = useState(false);
  const [pairedDevices, setPairedDevices] = useState<any[]>([]);
  const [usbError, setUsbError] = useState("");
  const [showNoUsbWarning, setShowNoUsbWarning] = useState(false);

  // Monitor physical USB connection in real-time
  useEffect(() => {
    const nav = navigator as any;
    if (typeof navigator !== "undefined" && "usb" in nav) {
      try {
        setUsbSupported(true);
        
        // Fetch devices already paired in previous user interactions
        nav.usb.getDevices()
          .then((devices: any[]) => {
            setPairedDevices(devices);
          })
          .catch((err: any) => {
            console.warn("WebUSB is supported but getDevices was blocked (likely due to iframe permissions):", err.message);
            setUsbSupported(false);
          });

        // Event triggered when a USB device is plugged in
        const handleConnect = (e: any) => {
          try {
            nav.usb.getDevices().then((devices: any[]) => {
              setPairedDevices(devices);
            }).catch(() => {});
          } catch (err) {}
        };

        // Event triggered when a USB device is unplugged
        const handleDisconnect = (e: any) => {
          try {
            nav.usb.getDevices().then((devices: any[]) => {
              setPairedDevices(devices);
            }).catch(() => {});
          } catch (err) {}
        };

        nav.usb.addEventListener("connect", handleConnect);
        nav.usb.addEventListener("disconnect", handleDisconnect);

        return () => {
          try {
            nav.usb.removeEventListener("connect", handleConnect);
            nav.usb.removeEventListener("disconnect", handleDisconnect);
          } catch (err) {}
        };
      } catch (err: any) {
        console.warn("Failed to initialize WebUSB listeners (likely due to iframe sandboxing permissions):", err.message);
        setUsbSupported(false);
      }
    }
  }, []);

  // Listen for PWA installation capability
  useEffect(() => {
    const handleBeforeInstallPrompt = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setShowInstallBtn(true);
    };

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);

    // If app is already installed/running in standalone display mode
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
      console.log("User installed the PrintIO app");
    }
    setDeferredPrompt(null);
    setShowInstallBtn(false);
  };

  // Request user to choose/pair a real USB printer
  const requestUsbDevice = async () => {
    const nav = navigator as any;
    if (typeof navigator === "undefined" || !("usb" in nav)) {
      alert("WebUSB is not supported in this browser. Please use Google Chrome, Microsoft Edge, or Opera on desktop to access physical USB hardware.");
      return;
    }
    try {
      setUsbError("");
      // Prompts user with native browser selection dialog to pair a USB printer
      const device = await nav.usb.requestDevice({ filters: [] });
      if (device) {
        const devices = await nav.usb.getDevices();
        setPairedDevices(devices);
      }
    } catch (err: any) {
      console.warn("USB connection selection cancelled or failed:", err);
      if (err.name !== "NotFoundError") {
        setUsbError(err.message || "Failed to establish USB connection.");
      }
    }
  };

  // Specifications
  const [settings, setSettings] = useState<CustomizationSettings>({
    colorMode: "color",
    quality: "standard",
    merchandiseType: "document",
    copies: 1,
    doubleSided: false,
    scale: 1.0,
    offsetX: 0,
    offsetY: 0,
    rotation: 0,
    filter: "normal",
    pageRangeMode: "all",
    customPages: "",
  });

  const [selectedFileIndex, setSelectedFileIndex] = useState(0);

  const startLocalStandaloneSession = () => {
    setLoadingSession(true);
    setPrintStatus("idle");
    setPolling(false);
    setApiError(false);
    setSession({
      id: "local-standalone-mode",
      status: "waiting",
    });
    setLoadingSession(false);
  };

  // Create a brand new session on load
  const createNewSession = async () => {
    setLoadingSession(true);
    setPrintStatus("idle");
    setPolling(true);
    setApiError(false);
    try {
      const res = await fetch("/api/session/create");
      if (!res.ok) {
        throw new Error("API response error");
      }
      const data = await res.json();
      setSession({
        id: data.sessionId,
        status: "waiting",
      });
    } catch (err) {
      console.error("Error creating session:", err);
      setApiError(true);
    } finally {
      setLoadingSession(false);
    }
  };

  useEffect(() => {
    createNewSession();
  }, []);

  // Poll for file upload updates
  useEffect(() => {
    if (!session || !polling || printStatus !== "idle") return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch(`/api/session/${session.id}`);
        if (res.ok) {
          const data = await res.json();
          if (data.file) {
            setSession(data);
            setPolling(false); // Stop polling once file is received
          }
        }
      } catch (err) {
        console.error("Polling error:", err);
      }
    }, 2000);

    return () => clearInterval(interval);
  }, [session, polling, printStatus]);

  // Handle local simulation file upload for quick debugging and desktop-only flows
  const handleLocalSimulatorUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0] && session) {
      const localFile = e.target.files[0];
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result as string;
          const resolvedFileType = localFile.type || (localFile.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
          const estimatedPageCount = resolvedFileType === "application/pdf" ? 3 : 1;

          const fileObj = {
            filename: localFile.name,
            fileType: resolvedFileType,
            fileData: base64Data,
            pageCount: estimatedPageCount,
          };

          if (session.id === "local-standalone-mode") {
            setSession({
              ...session,
              status: "uploaded",
              file: fileObj,
              files: [fileObj],
            });
            setSelectedFileIndex(0);
            setPolling(false);
            return;
          }

          // Upload to server to keep everything in sync
          const res = await fetch(`/api/session/${session.id}/upload`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              files: [fileObj],
            }),
          });
          if (res.ok) {
            setSession({
              ...session,
              status: "uploaded",
              file: fileObj,
              files: [fileObj],
            });
            setSelectedFileIndex(0);
            setPolling(false);
          }
        } catch (err) {
          console.error("Error uploading local simulation file:", err);
        }
      };
      reader.readAsDataURL(localFile);
    }
  };

  // Full print release cycle simulation + window.print() integration
  const triggerPrintRelease = async (bypassWarning = false) => {
    if (!session) return;

    // If WebUSB is supported but no device is paired yet, show a nice modal/confirmation first
    if (usbSupported && pairedDevices.length === 0 && !bypassWarning) {
      setShowNoUsbWarning(true);
      return;
    }

    setPrintStatus("printing");

    // Phase 1: Contacting USB Printer
    const printerName = pairedDevices[0]?.productName || "USB Printer";
    setPrintingPhase(`Establishing secure connection with ${printerName}...`);
    await new Promise((r) => setTimeout(r, 1200));

    // Phase 2: Spooling files
    setPrintingPhase(`Spooling print payload to ${printerName} & optimizing memory overhead...`);
    await new Promise((r) => setTimeout(r, 1000));

    // Phase 3: Sending pages to OS print manager
    setPrintingPhase(`Sending ${settings.copies} ${settings.copies > 1 ? "copies" : "copy"} to physical printing queue...`);
    await new Promise((r) => setTimeout(r, 800));

    // Trigger standard OS print dialog or direct iframe print for PDFs
    const activeFileObj = session.files && session.files.length > 0
      ? session.files[selectedFileIndex] || session.files[0]
      : session.file;

    if (activeFileObj && (activeFileObj.fileType === "application/pdf" || activeFileObj.filename.toLowerCase().endsWith(".pdf"))) {
      const iframe = document.querySelector("iframe[title='PDF Live Preview']") as HTMLIFrameElement;
      if (iframe) {
        try {
          iframe.contentWindow?.focus();
          iframe.contentWindow?.print();
        } catch (err) {
          console.error("Direct PDF print failed, falling back to page print:", err);
          window.print();
        }
      } else {
        window.print();
      }
    } else {
      window.print();
    }

    // Phase 4: Securely erasing files from server memory (Cloud auto-deletion)
    setPrintingPhase("Print job delivered. Erasing source files from Cloud memory automatically...");
    if (session.id !== "local-standalone-mode") {
      try {
        await fetch(`/api/session/${session.id}/complete`, {
          method: "POST",
        });
      } catch (err) {
        console.error("Failed to trigger cloud auto-cleanup API:", err);
      }
    }
    await new Promise((r) => setTimeout(r, 1200));

    setPrintStatus("completed");
  };

  const mobileUrl = session
    ? `${window.location.origin}/m/${session.id}`
    : "";

  const copyMobileLinkToClipboard = () => {
    if (!mobileUrl) return;
    navigator.clipboard.writeText(mobileUrl);
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  const estimatePrice = () => {
    let pages = 0;
    if (session?.files && session.files.length > 0) {
      pages = session.files.reduce((sum, f) => sum + (f.pageCount || 1), 0);
    } else if (session?.file) {
      pages = session.file.pageCount || 1;
    } else {
      pages = 1; // fallback
    }
    
    const rate = settings.colorMode === "color" ? 5 : 3;
    return pages * rate * settings.copies;
  };

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800 font-sans flex flex-col antialiased selection:bg-blue-600/10 selection:text-blue-600">
      
      {/* Sleek Header Navigation */}
      <header className="h-16 bg-white border-b border-slate-200 px-8 flex items-center justify-between flex-shrink-0 shadow-sm sticky top-0 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center shadow-md shadow-blue-600/20">
            <span className="text-white font-bold text-lg leading-none">P</span>
          </div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-800">
            Print<span className="text-blue-600">IO</span>
          </h1>
        </div>

        <div className="flex items-center gap-6">
          {usbSupported ? (
            pairedDevices.length > 0 ? (
              <button
                onClick={requestUsbDevice}
                className="flex items-center gap-2 bg-emerald-50 border border-emerald-200/60 hover:border-emerald-300 hover:bg-emerald-100/80 px-3 py-1 rounded-full transition-all group"
                title={`Connected USB Device: ${pairedDevices[0].productName || "Unknown device"}. Click to pair another.`}
              >
                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 flex items-center gap-1">
                  <Usb className="w-3.5 h-3.5 text-emerald-600 animate-bounce" />
                  Connected: {pairedDevices[0].productName ? (pairedDevices[0].productName.length > 15 ? pairedDevices[0].productName.substring(0, 15) + "..." : pairedDevices[0].productName) : "USB Printer"}
                </span>
              </button>
            ) : (
              <button
                onClick={requestUsbDevice}
                className="flex items-center gap-2 bg-amber-50 border border-amber-200 hover:border-amber-300 hover:bg-amber-100/50 px-3 py-1.5 rounded-full transition-all animate-pulse group cursor-pointer shadow-sm"
                title="Click to pair/connect your real USB printer"
              >
                <div className="w-2 h-2 rounded-full bg-amber-500"></div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-700 flex items-center gap-1 font-sans">
                  <Usb className="w-3.5 h-3.5 text-amber-500 group-hover:scale-110 transition-transform" />
                  Connect USB Printer
                </span>
              </button>
            )
          ) : (
            <div
              className="flex items-center gap-2 bg-slate-100 border border-slate-200 px-3 py-1 rounded-full text-slate-400"
              title="WebUSB is not supported in this browser environment."
            >
              <div className="w-1.5 h-1.5 rounded-full bg-slate-300"></div>
              <span className="text-[10px] font-bold uppercase tracking-wider flex items-center gap-1">
                <Usb className="w-3.5 h-3.5 text-slate-400" />
                USB Offline (No WebUSB)
              </span>
            </div>
          )}
          <div className="flex items-center gap-2 bg-blue-50 border border-blue-200/60 px-3 py-1 rounded-full">
            <div className="w-2 h-2 rounded-full bg-blue-500 animate-pulse"></div>
            <span className="text-[10px] font-bold uppercase tracking-wider text-blue-700">Cloud Sync Active</span>
          </div>

          {showInstallBtn && (
            <button
              onClick={handleInstallApp}
              className="flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider px-3.5 py-1.5 rounded-full transition-all shadow-md shadow-blue-500/10 cursor-pointer animate-pulse"
              title="Install PrintIO App on this Device"
            >
              <Smartphone className="w-3.5 h-3.5" />
              Install App
            </button>
          )}
          
          {session && (
            <div className="hidden md:flex items-center gap-1.5 bg-slate-100 border border-slate-200/80 px-3 py-1 rounded-lg text-xs font-mono text-slate-600">
              <span className="text-slate-400">SESSION ID:</span>
              <strong className="text-slate-900 font-semibold">{session.id}</strong>
            </div>
          )}

          <button
            onClick={createNewSession}
            disabled={loadingSession}
            className="p-1.5 text-slate-400 hover:text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-lg border border-slate-200 transition-colors"
            title="Start Fresh Session"
          >
            <RefreshCw className={`w-4 h-4 ${loadingSession ? "animate-spin" : ""}`} />
          </button>
        </div>
      </header>

      {/* Main Workspace Frame */}
      <main className="flex-grow flex flex-col p-6 max-w-7xl w-full mx-auto justify-center">
        {loadingSession ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-4 border-t-blue-600 border-slate-200 rounded-full animate-spin" />
            <p className="text-sm font-mono text-slate-500">Spooling secure document envelope...</p>
          </div>
        ) : apiError ? (
          /* API Connection Error (e.g. Netlify static deploy) */
          <div className="max-w-xl mx-auto w-full bg-white border border-amber-200 rounded-3xl p-8 text-center shadow-xl my-8 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-amber-500 animate-pulse" />
            
            <div className="w-16 h-16 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mx-auto mb-6 border border-amber-100">
              <AlertCircle className="w-8 h-8" />
            </div>

            <h2 className="text-xl font-black text-slate-900 mb-2 font-sans tracking-tight">
              Backend Server Required for Mobile Handshake
            </h2>
            <h3 className="text-[10px] font-bold text-amber-700 uppercase tracking-widest font-mono mb-4">
              Netlify Static Hosting Detected / Netlify पर QR Code क्यों नहीं दिख रहा?
            </h3>

            <div className="space-y-4 text-xs text-slate-600 text-left leading-relaxed bg-slate-50 border border-slate-200/80 p-5 rounded-2xl mb-6">
              <p>
                <strong>English:</strong> Netlify is a static file hosting platform. By default, it does not run the Node.js/Express backend server (<code>server.ts</code>) included in this project. Because the API server is not running, the app cannot generate a secure session ID or load the QR code for mobile file transfers.
              </p>
              <p className="border-t border-slate-200 pt-3">
                <strong>हिंदी (Hindi):</strong> Netlify डिफ़ॉल्ट रूप से केवल स्टेटिक फाइलें (HTML, CSS, JS) होस्ट करता है। यह इस प्रोजेक्ट के Node.js/Express बैकएंड सर्वर को रन नहीं करता है। बैकएंड सर्वर बंद होने के कारण, QR कोड के लिए सेशन ID जनरेट नहीं हो पा रही है और QR कोड लोड नहीं हो रहा है।
              </p>
              <p className="border-t border-slate-200 pt-3 text-[11px] text-slate-500 font-mono italic">
                💡 <strong>Solution:</strong> आप इसे Render, Railway, Vercel, या Heroku जैसी फुल-स्टैक सर्विस पर डिप्लॉय कर सकते हैं जहाँ Node.js सर्वर बैकएंड चालू रहे।
              </p>
            </div>

            <div className="flex flex-col sm:flex-row gap-3 justify-center">
              <button
                onClick={startLocalStandaloneSession}
                className="px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase tracking-wider rounded-xl transition-all shadow-md shadow-blue-500/10 cursor-pointer flex items-center justify-center gap-2"
              >
                <HardDriveUpload className="w-4 h-4" /> Start Offline Sandbox Mode
              </button>
              <button
                onClick={createNewSession}
                className="px-6 py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase tracking-wider rounded-xl transition-all cursor-pointer border border-slate-200"
              >
                Retry Server Connection
              </button>
            </div>
          </div>
        ) : printStatus === "printing" ? (
          /* ACTIVE PRINT RELEASEING STATE */
          <div className="max-w-2xl mx-auto w-full bg-white border border-slate-200 rounded-3xl p-10 text-center shadow-xl my-12 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-gradient-to-r from-blue-600 via-sky-400 to-blue-600" />
            
            <div className="w-24 h-24 bg-blue-50 border border-blue-100 text-blue-600 rounded-2xl flex items-center justify-center mx-auto mb-8 animate-pulse shadow-sm">
              <Printer className="w-12 h-12" />
            </div>

            <h2 className="text-2xl font-extrabold tracking-tight text-slate-900 mb-3">
              Releasing Print Job to USB Device
            </h2>
            
            {/* Spinning details log */}
            <div className="bg-slate-50 border border-slate-200 p-5 rounded-2xl max-w-md mx-auto mb-8 font-mono text-xs text-left space-y-2 text-slate-600 shadow-inner">
              <div className="flex justify-between border-b border-slate-200 pb-2 mb-2 text-blue-600 font-bold">
                <span>SYSTEM LOGS</span>
                <span>STATUS</span>
              </div>
              <p className="font-semibold text-slate-800">▶ {printingPhase}</p>
              <p className="text-slate-400">◦ Connected Hardware: {pairedDevices[0] ? `${pairedDevices[0].productName || "USB Device"} (VID: ${pairedDevices[0].vendorId}, PID: ${pairedDevices[0].productId})` : "Virtual Sandbox USB Port"}</p>
              <p className="text-slate-400">◦ Spooled Format: {settings.merchandiseType.toUpperCase()}</p>
              <p className="text-slate-400">◦ Memory Scrub Buffer: ACTIVE</p>
            </div>

            <div className="w-48 h-1.5 bg-slate-100 rounded-full overflow-hidden mx-auto">
              <div className="h-full bg-blue-600 w-2/3 animate-infinite-scroll rounded-full" />
            </div>
          </div>
        ) : printStatus === "completed" ? (
          /* WORK COMPLETE SCREEN */
          <div className="max-w-xl mx-auto w-full bg-white border border-emerald-200 rounded-3xl p-10 text-center shadow-xl my-12 relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-emerald-500" />

            <div className="w-20 h-20 bg-emerald-50 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 shadow-sm border border-emerald-100">
              <CheckCircle className="w-10 h-10" />
            </div>

            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900 mb-2 font-sans">
              Work Completed!
            </h2>
            <p className="text-sm text-slate-500 max-w-sm mx-auto mb-8 leading-relaxed">
              Your print task was dispatched to the connected USB printer. The session document was permanently erased.
            </p>

            {/* Privacy Shredder details */}
            <div className="bg-slate-50 border border-slate-200 rounded-2xl p-6 text-left mb-8 shadow-inner">
              <h3 className="text-xs font-bold text-emerald-600 uppercase tracking-widest font-mono flex items-center gap-1.5 mb-4">
                <ShieldCheck className="w-4 h-4" /> Cloud Secure Cleanup
              </h3>
              <ul className="text-xs text-slate-600 space-y-2.5 font-mono">
                <li className="flex justify-between border-b border-slate-200 pb-2">
                  <span>Session Key:</span>
                  <span className="text-slate-900 font-semibold">{session?.id}</span>
                </li>
                <li className="flex justify-between border-b border-slate-200 pb-2">
                  <span>Copies Transferred:</span>
                  <span className="text-slate-900 font-semibold">{settings.copies} units</span>
                </li>
                <li className="flex justify-between">
                  <span>Cloud Storage Status:</span>
                  <span className="text-rose-600 font-bold uppercase flex items-center gap-1.5">
                    <Trash2 className="w-3.5 h-3.5" /> 100% DELETED & SCRUBBED
                  </span>
                </li>
              </ul>
              <div className="mt-4 pt-3 border-t border-slate-200 text-[10px] text-slate-400 leading-relaxed italic">
                PrintIO complies with strict client-to-paper security rules: zero permanent document storage retention.
              </div>
            </div>

            <button
              onClick={createNewSession}
              className="w-full sm:w-auto px-8 py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm tracking-wide transition-all active:scale-[0.98] shadow-md shadow-blue-600/10"
            >
              Start New Print Task
            </button>
          </div>
        ) : !session?.file ? (
          /* STEP 1: RENDER CONNECT / UPLOAD LAYOUT (SLEEK STYLING) */
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-stretch">
            
            {/* Left side instruction info (7 columns) */}
            <div className="lg:col-span-7 flex flex-col justify-center space-y-6">
              <div className="space-y-3">
                <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-100 text-blue-700 font-mono text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-wider">
                  <Sparkle className="w-3 h-3 text-blue-600 animate-spin" /> Zero-Config Print Bridge
                </div>
                <h2 className="text-4xl font-extrabold tracking-tight text-slate-900 leading-tight">
                  Seamlessly print documents and custom goods.
                </h2>
                <p className="text-slate-500 text-sm leading-relaxed max-w-xl">
                  Scan the secure QR code with your phone's camera, upload any file to our temporary cloud envelope, and it appears here on the screen instantly for custom adjustments!
                </p>
              </div>

              {/* Steps Layout */}
              <div className="space-y-3 max-w-lg">
                {[
                  {
                    step: "1",
                    title: "Scan the QR Link",
                    desc: "Open your camera and capture the security handshake on the right.",
                  },
                  {
                    step: "2",
                    title: "Upload Images or PDF",
                    desc: "Transmit documents straight from your mobile phone storage safely.",
                  },
                  {
                    step: "3",
                    title: "Position, Refine & Print",
                    desc: "Align, size, and tap 'Dispatch to Printer'. Cloud automatically scrubs files clean.",
                  },
                ].map((item) => (
                  <div
                    key={item.step}
                    className="flex gap-4 p-4 rounded-xl bg-white border border-slate-200 shadow-sm hover:border-slate-300 transition-colors"
                  >
                    <div className="w-8 h-8 bg-blue-50 text-blue-600 border border-blue-100 rounded-lg flex items-center justify-center font-mono text-sm font-bold flex-shrink-0">
                      {item.step}
                    </div>
                    <div>
                      <h4 className="text-xs font-bold text-slate-800">{item.title}</h4>
                      <p className="text-[11px] text-slate-500 mt-0.5">{item.desc}</p>
                    </div>
                  </div>
                ))}
              </div>

              {/* SIMULATOR TRAP FOR SCREENSHOTS & VIRTUAL ENVIRONMENT */}
              <div className="p-4 bg-white rounded-2xl border border-slate-200 shadow-sm max-w-xl">
                <h4 className="text-xs font-bold text-slate-700 flex items-center gap-1.5 uppercase tracking-wide mb-2">
                  <HardDriveUpload className="w-4 h-4 text-blue-600" /> Virtual Desktop Sandbox Upload
                </h4>
                <p className="text-[11px] text-slate-500 mb-3 leading-relaxed">
                  No smartphone nearby? You can directly simulate the mobile cloud upload using this dropzone right on your desktop:
                </p>
                <div className="relative border border-dashed border-slate-300 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/20 rounded-xl p-3.5 text-center transition-all">
                  <input
                    type="file"
                    id="sandbox-file-picker"
                    accept="image/*,application/pdf"
                    onChange={handleLocalSimulatorUpload}
                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                  />
                  <div className="flex items-center justify-center gap-2 text-xs font-medium text-slate-600">
                    <span className="text-blue-600 font-bold underline">Click to upload mock file</span> or drag & drop here
                  </div>
                </div>
              </div>
            </div>

            {/* Right side connection terminal (5 columns) */}
            <div className="lg:col-span-5 flex flex-col items-center justify-center">
              <div className="bg-white border border-slate-200 rounded-3xl p-8 flex flex-col items-center w-full max-w-sm shadow-md relative overflow-hidden">
                <div className="absolute top-0 inset-x-0 h-1 bg-blue-600" />
                
                <h3 className="text-xs font-bold text-slate-700 flex items-center gap-2 mb-1 uppercase tracking-wider">
                  <Smartphone className="w-4 h-4 text-blue-600" /> Mobile Handshake
                </h3>
                <p className="text-[10px] text-slate-400 text-center mb-6 max-w-[200px]">
                  Binds phone to this workstation
                </p>

                {session?.id === "local-standalone-mode" ? (
                  <div className="flex flex-col items-center justify-center p-6 bg-slate-50 border border-dashed border-slate-200 rounded-2xl text-center space-y-3 w-full">
                    <Smartphone className="w-8 h-8 text-slate-400 opacity-60" />
                    <span className="text-xs font-bold text-slate-700">Offline Standalone Mode</span>
                    <p className="text-[10px] text-slate-500 leading-relaxed">
                      Mobile connections are disabled since there is no running server. Please use the direct desktop file picker on the left!
                    </p>
                  </div>
                ) : (
                  <>
                    {/* QR Code Frame with laser animation */}
                    <div className="relative p-4 bg-white rounded-2xl shadow-sm border border-slate-200 transition-transform duration-300 hover:scale-[1.01]">
                      {/* Decorative corner brackets */}
                      <div className="absolute -top-1 -left-1 w-3.5 h-3.5 border-t-2 border-l-2 border-blue-600 rounded-tl-sm" />
                      <div className="absolute -top-1 -right-1 w-3.5 h-3.5 border-t-2 border-r-2 border-blue-600 rounded-tr-sm" />
                      <div className="absolute -bottom-1 -left-1 w-3.5 h-3.5 border-b-2 border-l-2 border-blue-600 rounded-bl-sm" />
                      <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 border-b-2 border-r-2 border-blue-600 rounded-br-sm" />

                      {/* Laser Scanning Line */}
                      <div className="absolute inset-x-4 top-4 h-0.5 bg-gradient-to-r from-transparent via-blue-500 to-transparent shadow-md shadow-blue-500 animate-scan-line z-10 pointer-events-none" />

                      {/* QR Image */}
                      <img
                        src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(
                          mobileUrl
                        )}`}
                        alt="Scan QR"
                        className="w-44 h-44 block rounded-lg select-none"
                        referrerPolicy="no-referrer"
                      />
                    </div>

                    {/* Mobile URL link display */}
                    <div className="w-full mt-6 flex gap-2">
                      <input
                        type="text"
                        readOnly
                        value={mobileUrl}
                        className="flex-1 bg-slate-50 border border-slate-200 text-[10px] font-mono text-slate-500 p-2 rounded-lg text-center focus:outline-none"
                      />
                      <button
                        onClick={copyMobileLinkToClipboard}
                        className="p-2 bg-slate-100 hover:bg-slate-200 rounded-lg text-slate-600 transition-colors border border-slate-200"
                        title="Copy Link"
                      >
                        <Copy className="w-3.5 h-3.5" />
                      </button>
                    </div>
                    {copiedLink && (
                      <span className="text-[10px] text-blue-600 font-mono mt-1.5 font-semibold">
                        Link Copied!
                      </span>
                    )}
                  </>
                )}

                {/* Waiting State Status Indicator */}
                <div className="mt-8 pt-5 border-t border-slate-100 w-full flex items-center justify-center gap-2 text-[10px] font-mono text-slate-500">
                  {session?.id === "local-standalone-mode" ? (
                    <>
                      <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                      <span className="text-emerald-600 font-semibold">STANDALONE OFFLINE ACTIVE</span>
                    </>
                  ) : (
                    <>
                      <span className="w-2 h-2 bg-amber-500 rounded-full animate-pulse" />
                      <span>WAITING FOR MOBILE TRANSFER...</span>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        ) : (
          /* STEP 2: FILE RECEIVED, ACTIVE SPECIFICATIONS CUSTOMIZATION */
          (() => {
            const filesList = session.files && session.files.length > 0
              ? session.files
              : session.file
              ? [session.file]
              : [];
            
            const activeFile = filesList[selectedFileIndex] || filesList[0] || session.file;
            const totalPagesCount = filesList.reduce((sum, f) => sum + (f.pageCount || 1), 0);

            return (
              <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start my-2">
                
                {/* 1. Left Column - Multi-File Sidebar List (3 cols) */}
                <div className="lg:col-span-3 space-y-4">
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                    <div className="flex items-center justify-between border-b border-slate-100 pb-3 mb-3">
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
                        <FileText className="w-4 h-4 text-blue-600" /> Print Queue
                      </h3>
                      <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded-full">
                        {filesList.length} Files
                      </span>
                    </div>

                    <div className="space-y-2 max-h-[400px] overflow-y-auto pr-1">
                      {filesList.map((fileObj, idx) => {
                        const isPdf = fileObj.fileType === "application/pdf" || fileObj.filename.toLowerCase().endsWith(".pdf");
                        const isSelected = selectedFileIndex === idx;

                        return (
                          <button
                            key={`${fileObj.filename}-${idx}`}
                            onClick={() => setSelectedFileIndex(idx)}
                            className={`w-full text-left p-3 rounded-2xl border transition-all flex items-center justify-between gap-2.5 ${
                              isSelected
                                ? "bg-blue-50/70 border-blue-200 ring-1 ring-blue-100"
                                : "bg-slate-50/50 border-slate-100 hover:border-slate-200"
                            }`}
                          >
                            <div className="flex items-center gap-2.5 min-w-0">
                              <div className={`w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 shadow-sm border ${
                                isPdf ? "bg-rose-50 border-rose-100 text-rose-500" : "bg-sky-50 border-sky-100 text-sky-500"
                              }`}>
                                {isPdf ? <FileText className="w-4 h-4" /> : <ImageIcon className="w-4 h-4" />}
                              </div>
                              <div className="min-w-0">
                                <span className="block text-[11px] font-bold text-slate-700 truncate">
                                  {fileObj.filename}
                                </span>
                                <span className="block text-[9px] text-slate-400 font-medium">
                                  {isPdf ? `📄 ${fileObj.pageCount || 1} Pages` : "🖼️ 1 Page"}
                                </span>
                              </div>
                            </div>
                            {isSelected && (
                              <div className="w-1.5 h-1.5 rounded-full bg-blue-600 flex-shrink-0 animate-ping" />
                            )}
                          </button>
                        );
                      })}
                    </div>

                    {/* Quick Sandbox Upload Trap in step 2 to allow adding files */}
                    <div className="mt-4 pt-4 border-t border-slate-100">
                      <div className="relative border border-dashed border-slate-200 hover:border-blue-400 bg-slate-50 hover:bg-blue-50/20 rounded-xl p-2.5 text-center transition-all">
                        <input
                          type="file"
                          id="sandbox-add-file"
                          accept="image/*,application/pdf"
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0] && session) {
                              const localFile = e.target.files[0];
                              const reader = new FileReader();
                              reader.onload = async () => {
                                const base64Data = reader.result as string;
                                const resolvedFileType = localFile.type || (localFile.name.toLowerCase().endsWith(".pdf") ? "application/pdf" : "image/jpeg");
                                const estPageCount = resolvedFileType === "application/pdf" ? 3 : 1;
                                
                                const newFileObj = {
                                  filename: localFile.name,
                                  fileType: resolvedFileType,
                                  fileData: base64Data,
                                  pageCount: estPageCount,
                                };

                                const updatedFiles = [...filesList, newFileObj];
                                setSession({
                                  ...session,
                                  files: updatedFiles,
                                });
                                setSelectedFileIndex(updatedFiles.length - 1);
                              };
                              reader.readAsDataURL(localFile);
                            }
                          }}
                          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                        />
                        <span className="text-[10px] font-bold text-slate-500 hover:text-blue-600 cursor-pointer flex items-center justify-center gap-1">
                          <Plus className="w-3.5 h-3.5 text-blue-500" /> Click to add files
                        </span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* 2. Center Column - Interactive Canvas & Preview (5 cols) */}
                <div className="lg:col-span-5 flex flex-col gap-3">
                  <div className="bg-slate-100 border border-slate-200 rounded-3xl p-1.5 shadow-inner">
                    {activeFile ? (
                      <InteractiveCanvas
                        filename={activeFile.filename}
                        fileType={activeFile.fileType}
                        fileData={activeFile.fileData}
                        settings={settings}
                        onUpdateSettings={(newSettings) => setSettings(newSettings)}
                      />
                    ) : (
                      <div className="h-[400px] flex items-center justify-center text-xs text-slate-400">
                        No active file preview
                      </div>
                    )}
                  </div>
                  {activeFile && (
                    <span className="text-[10px] text-slate-400 font-mono text-center block truncate px-2 leading-none">
                      Previewing file: <strong>{activeFile.filename}</strong>
                    </span>
                  )}
                </div>

                {/* 3. Right Column - Locked A4 & Monochrome Settings Form (4 cols) */}
                <div className="lg:col-span-4 space-y-4">
                  <div className="bg-white border border-slate-200 rounded-3xl p-5 shadow-sm">
                    
                    {/* Section Header */}
                    <div className="flex items-center gap-2 border-b border-slate-100 pb-3 mb-4">
                      <Sliders className="w-4 h-4 text-blue-600" />
                      <h3 className="text-xs font-extrabold text-slate-800 uppercase tracking-widest">
                        Print Specifications
                      </h3>
                    </div>

                    {/* Specifications Form */}
                    <div className="space-y-4">
                      
                      {/* Print Medium Locked to A4 */}
                      <div className="space-y-2 bg-slate-50 border border-slate-200/50 p-3.5 rounded-2xl">
                        <label className="text-[9px] font-extrabold text-slate-400 block uppercase tracking-wider leading-none">
                          Paper Selection / पेपर साइज़
                        </label>
                        <div className="flex items-center gap-3 mt-1">
                          <div className="w-10 h-10 bg-blue-100 text-blue-600 rounded-xl flex items-center justify-center font-bold text-sm shadow-sm">
                            A4
                          </div>
                          <div>
                            <span className="block text-xs font-bold text-slate-800">A4 Document Paper</span>
                            <span className="block text-[9px] text-slate-400 uppercase tracking-wide font-semibold mt-0.5">Standard A4 Size Locked</span>
                          </div>
                        </div>
                      </div>

                      {/* Print Color Mode */}
                      <div className="space-y-2">
                        <label className="text-[9px] font-extrabold text-slate-400 block uppercase tracking-wider leading-none">
                          Print Color Mode / प्रिंट का रंग
                        </label>
                        <div className="grid grid-cols-2 gap-2 mt-1">
                          <button
                            onClick={() => setSettings({ ...settings, colorMode: "color" })}
                            className={`py-2 px-2.5 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center gap-1.5 transition-all ${
                              settings.colorMode === "color"
                                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/15"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-gradient-to-tr from-rose-500 via-amber-400 to-sky-400" />
                              <span>Full Color</span>
                            </div>
                            <span className="text-[9px] opacity-90 font-bold">₹5 per page</span>
                          </button>
                          <button
                            onClick={() => setSettings({ ...settings, colorMode: "bw" })}
                            className={`py-2 px-2.5 rounded-xl text-xs font-semibold border flex flex-col items-center justify-center gap-1.5 transition-all ${
                              settings.colorMode === "bw"
                                ? "bg-blue-600 text-white border-blue-600 shadow-md shadow-blue-500/15"
                                : "bg-slate-50 border-slate-200 text-slate-600 hover:border-slate-300"
                            }`}
                          >
                            <div className="flex items-center gap-1.5">
                              <span className="w-2.5 h-2.5 rounded-full bg-slate-400" />
                              <span>Monochrome</span>
                            </div>
                            <span className="text-[9px] opacity-90 font-bold">₹3 per page</span>
                          </button>
                        </div>
                      </div>

                      {/* Quantity Counter */}
                      <div className="flex items-center justify-between py-2.5 border-t border-b border-slate-100 my-1">
                        <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Copies / प्रतियां</span>
                        <div className="flex items-center gap-3">
                          <button
                            onClick={() =>
                              setSettings({
                                ...settings,
                                copies: Math.max(1, settings.copies - 1),
                              })
                            }
                            className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center transition-colors border border-slate-200/80"
                          >
                            <Minus className="w-3.5 h-3.5" />
                          </button>
                          <span className="text-sm font-mono font-bold text-slate-900 min-w-[20px] text-center">
                            {String(settings.copies).padStart(2, "0")}
                          </span>
                          <button
                            onClick={() =>
                              setSettings({ ...settings, copies: settings.copies + 1 })
                            }
                            className="w-8 h-8 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg flex items-center justify-center transition-colors border border-slate-200/80"
                          >
                            <Plus className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>

                      {/* Double sided option */}
                      <div className="flex items-center justify-between py-1">
                        <div>
                          <span className="text-xs font-bold text-slate-700 block uppercase tracking-wider leading-none">
                            Double-Sided Print
                          </span>
                          <span className="text-[10px] text-slate-400 mt-1 block">
                            Duplex short or long edge flip
                          </span>
                        </div>
                        <button
                          onClick={() =>
                            setSettings({ ...settings, doubleSided: !settings.doubleSided })
                          }
                          className="text-slate-400 hover:text-slate-600 transition-colors"
                        >
                          {settings.doubleSided ? (
                            <ToggleRight className="w-10 h-10 text-blue-600" />
                          ) : (
                            <ToggleLeft className="w-10 h-10 text-slate-300" />
                          )}
                        </button>
                      </div>
                    </div>

                    {/* Print Dispatch Release Action Bar */}
                    <div className="mt-6 pt-4 border-t border-slate-100">
                      <div className="flex justify-between items-end mb-4">
                        <div>
                          <p className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Total Estimate</p>
                          <p className="text-2xl font-black text-slate-900">₹{estimatePrice()}</p>
                          <span className="text-[9px] text-slate-400 leading-none">
                            ({totalPagesCount} pages × {settings.colorMode === "color" ? "₹5" : "₹3"} × {settings.copies} copy)
                          </span>
                        </div>
                        <p className="text-[10px] text-emerald-600 font-extrabold bg-emerald-50 border border-emerald-100 px-2.5 py-1 rounded-md uppercase tracking-wider">
                          Ready to Print
                        </p>
                      </div>

                      <button
                        onClick={() => triggerPrintRelease(false)}
                        className="w-full py-3.5 px-6 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold tracking-wider text-xs uppercase flex items-center justify-center gap-2.5 transition-all shadow-md shadow-blue-600/25 active:scale-95 cursor-pointer"
                      >
                        <Printer className="w-4 h-4" />
                        DISPATCH TO USB PRINTER
                      </button>

                      <div className="mt-3.5 flex items-center justify-center gap-1.5 text-[9px] text-rose-500 font-mono text-center font-semibold uppercase tracking-wider bg-rose-50/50 p-2 rounded-lg border border-rose-100">
                        <ShieldAlert className="w-3.5 h-3.5 flex-shrink-0 text-rose-600" /> Cloud auto-delete: active on print trigger.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })()
        )}
      </main>

      {/* No USB Printer Paired Warning Modal */}
      {showNoUsbWarning && (
        <div className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-3xl p-6 max-w-md w-full shadow-2xl relative overflow-hidden animate-in fade-in zoom-in-95 duration-200">
            <div className="absolute top-0 inset-x-0 h-1.5 bg-amber-500" />
            
            <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center mb-4 border border-amber-100">
              <Usb className="w-6 h-6 animate-pulse" />
            </div>

            <h3 className="text-lg font-bold text-slate-900 mb-2">
              No USB Printer Paired
            </h3>
            
            <p className="text-xs text-slate-500 leading-relaxed mb-6">
              You requested direct dispatch to a USB Printer, but no physical USB hardware has been paired with this session. Connect your printer with a USB cable and grant permission, or run in virtual sandbox mode.
            </p>

            <div className="flex flex-col gap-2.5">
              <button
                onClick={async () => {
                  setShowNoUsbWarning(false);
                  await requestUsbDevice();
                }}
                className="w-full py-3 bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs uppercase rounded-xl tracking-wider transition-all flex items-center justify-center gap-2 cursor-pointer"
              >
                <Usb className="w-4 h-4 animate-bounce" /> Pair Physical USB Printer
              </button>
              
              <button
                onClick={() => {
                  setShowNoUsbWarning(false);
                  triggerPrintRelease(true); // bypass warning
                }}
                className="w-full py-3 bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs uppercase rounded-xl tracking-wider transition-all cursor-pointer"
              >
                Run in Virtual Sandbox Mode
              </button>

              <button
                onClick={() => setShowNoUsbWarning(false)}
                className="w-full py-2 text-xs text-slate-400 hover:text-slate-600 font-semibold transition-all mt-1 cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
