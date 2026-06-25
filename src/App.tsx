/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from "react";
import DesktopView from "./components/DesktopView";
import MobileView from "./components/MobileView";

export default function App() {
  const [view, setView] = useState<"desktop" | "mobile">("desktop");
  const [sessionId, setSessionId] = useState("");

  useEffect(() => {
    // Detect mobile view by parsing the path (e.g., /m/SESSION_CODE)
    const path = window.location.pathname;
    const match = path.match(/^\/m\/([a-zA-Z0-9]+)/i);
    
    if (match && match[1]) {
      setSessionId(match[1]);
      setView("mobile");
    } else {
      setView("desktop");
    }
  }, []);

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 font-sans">
      {view === "mobile" ? (
        <MobileView sessionId={sessionId} />
      ) : (
        <DesktopView />
      )}
    </div>
  );
}
