import React, { useState, useEffect } from "react";
import { Bell, Settings } from "lucide-react";
import { getUnacknowledgedAlerts } from "../../services/alertService";
import { AlertDropdown } from "./AlertDropdown";
import { AlertConfigModal } from "./AlertConfigModal";

export function AlertBell() {
  const [unacknowledgedCount, setUnacknowledgedCount] = useState(0);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showConfigModal, setShowConfigModal] = useState(false);

  useEffect(() => {
    updateUnacknowledgedCount();

    // Update count every 5 seconds
    const interval = setInterval(() => {
      updateUnacknowledgedCount();
    }, 5000);

    return () => clearInterval(interval);
  }, []);

  const updateUnacknowledgedCount = () => {
    const alerts = getUnacknowledgedAlerts();
    setUnacknowledgedCount(alerts.length);
  };

  const handleAlertsUpdated = () => {
    updateUnacknowledgedCount();
  };

  return (
    <div className="relative">
      <div className="flex items-center gap-2">
        {/* Alert Bell Button */}
        <button
          onClick={() => setShowDropdown(!showDropdown)}
          className="relative p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
          title="View alerts"
        >
          <Bell size={20} />
          {unacknowledgedCount > 0 && (
            <span className="absolute -top-1 -right-1 bg-red-500 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center font-medium">
              {unacknowledgedCount > 9 ? "9+" : unacknowledgedCount}
            </span>
          )}
        </button>

        {/* Settings Button */}
        <button
          onClick={() => setShowConfigModal(true)}
          className="p-2 text-gray-400 hover:text-white transition-colors rounded-lg hover:bg-gray-800"
          title="Configure alerts"
        >
          <Settings size={18} />
        </button>
      </div>

      {/* Alert Dropdown */}
      {showDropdown && (
        <AlertDropdown
          onClose={() => setShowDropdown(false)}
          onAlertsUpdated={handleAlertsUpdated}
        />
      )}

      {/* Config Modal */}
      <AlertConfigModal
        isOpen={showConfigModal}
        onClose={() => setShowConfigModal(false)}
      />
    </div>
  );
}
