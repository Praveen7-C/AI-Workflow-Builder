import React from "react";
import { X, Trash2, ChevronDown, ChevronUp, Terminal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ScrollArea } from "@/components/ui/scroll-area";

export interface LogEntry {
  id: string;
  timestamp: string;
  level: "info" | "warn" | "error" | "success";
  step: string;
  message: string;
}

interface ExecutionLogsPanelProps {
  logs: LogEntry[];
  visible: boolean;
  onClear: () => void;
  onToggle: () => void;
}

const levelColors: Record<string, string> = {
  info: "text-blue-400",
  warn: "text-yellow-400",
  error: "text-red-400",
  success: "text-green-400",
};

const levelBg: Record<string, string> = {
  info: "bg-blue-500/10",
  warn: "bg-yellow-500/10",
  error: "bg-red-500/10",
  success: "bg-green-500/10",
};

const ExecutionLogsPanel = ({ logs, visible, onClear, onToggle }: ExecutionLogsPanelProps) => {
  if (!visible) {
    return null;
  }

  return (
    <div className="absolute bottom-0 left-0 right-0 h-80 bg-card border-t shadow-lg flex flex-col z-20">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/50">
        <div className="flex items-center gap-2">
          <Terminal className="h-4 w-4 text-primary" />
          <span className="text-sm font-semibold">Execution Logs</span>
          <span className="text-xs text-muted-foreground">({logs.length})</span>
        </div>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="sm" onClick={onClear} className="h-7 px-2 text-xs">
            <Trash2 className="h-3 w-3 mr-1" />
            Clear
          </Button>
          <Button variant="ghost" size="icon" onClick={onToggle} className="h-7 w-7">
            <ChevronDown className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Log entries */}
      <ScrollArea className="flex-1">
        <div className="p-2 font-mono text-xs space-y-0.5">
          {logs.length === 0 ? (
            <p className="text-muted-foreground text-center py-8">No logs yet. Run or chat with your workflow to see execution logs.</p>
          ) : (
            logs.map((log) => (
              <div key={log.id} className={`flex items-start gap-2 px-2 py-1 rounded ${levelBg[log.level]}`}>
                <span className="text-muted-foreground whitespace-nowrap flex-shrink-0">
                  {new Date(log.timestamp).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })}
                </span>
                <span className={`font-semibold uppercase w-12 flex-shrink-0 ${levelColors[log.level]}`}>
                  {log.level === "success" ? "OK" : log.level.toUpperCase()}
                </span>
                <span className="text-primary font-semibold flex-shrink-0">[{log.step}]</span>
                <span className="text-foreground break-all">{log.message}</span>
              </div>
            ))
          )}
        </div>
      </ScrollArea>
    </div>
  );
};

export default ExecutionLogsPanel;
