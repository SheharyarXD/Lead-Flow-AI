import { useState, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PhoneOff, Mic, MicOff, Volume2, ShieldCheck, User } from "lucide-react";

interface CallDialerModalProps {
  isOpen: boolean;
  phoneNumber: string;
  contactName?: string;
  onClose: () => void;
}

export function CallDialerModal({ isOpen, phoneNumber, contactName, onClose }: CallDialerModalProps) {
  const [callState, setCallState] = useState<"connecting" | "ringing" | "connected" | "ended">("connecting");
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      setCallState("connecting");
      setSeconds(0);
      setIsMuted(false);
      return;
    }

    const t1 = setTimeout(() => setCallState("ringing"), 1500);
    const t2 = setTimeout(() => setCallState("connected"), 4000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [isOpen]);

  useEffect(() => {
    let interval: NodeJS.Timeout;
    if (callState === "connected") {
      interval = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  const handleEndCall = () => {
    setCallState("ended");
    setTimeout(() => {
      onClose();
    }, 1000);
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && handleEndCall()}>
      <DialogContent className="max-w-sm bg-zinc-950 border-zinc-800 text-white rounded-2xl p-6 shadow-2xl overflow-hidden select-none">
        <div className="flex flex-col items-center text-center space-y-6 pt-4 pb-2">
          
          {/* Avatar Ring */}
          <div className="relative">
            <div
              className={`w-20 h-20 rounded-full flex items-center justify-center border-2 transition-all duration-500 ${
                callState === "connected"
                  ? "bg-emerald-500/20 border-emerald-500 text-emerald-400 animate-pulse"
                  : callState === "ended"
                  ? "bg-zinc-800 border-zinc-700 text-zinc-500"
                  : "bg-indigo-500/20 border-indigo-500 text-indigo-400 animate-bounce"
              }`}
            >
              <User className="w-10 h-10" />
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white tracking-tight">
              {contactName || phoneNumber}
            </h3>
            <p className="text-xs font-semibold text-zinc-400">{phoneNumber}</p>

            {/* Call Status Badge */}
            <div className="pt-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold capitalize ${
                  callState === "connected"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : callState === "ended"
                    ? "bg-zinc-800 text-zinc-400"
                    : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    callState === "connected"
                      ? "bg-emerald-400"
                      : callState === "ended"
                      ? "bg-zinc-500"
                      : "bg-indigo-400 animate-ping"
                  }`}
                />
                {callState === "connected" ? formatTimer(seconds) : callState}
              </span>
            </div>
          </div>

          {/* Call Controls */}
          <div className="grid grid-cols-3 gap-4 w-full pt-4 border-t border-zinc-800">
            <Button
              variant="outline"
              onClick={() => setIsMuted(!isMuted)}
              disabled={callState !== "connected"}
              className={`h-12 rounded-xl border-zinc-800 text-xs font-semibold ${
                isMuted
                  ? "bg-amber-500/20 text-amber-400 border-amber-500/50"
                  : "bg-zinc-900 text-zinc-300 hover:bg-zinc-800 hover:text-white"
              }`}
            >
              {isMuted ? <MicOff className="w-5 h-5" /> : <Mic className="w-5 h-5" />}
            </Button>

            <Button
              variant="outline"
              disabled
              className="h-12 rounded-xl bg-zinc-900 text-zinc-400 border-zinc-800"
            >
              <Volume2 className="w-5 h-5" />
            </Button>

            <Button
              onClick={handleEndCall}
              className="h-12 rounded-xl bg-red-600 hover:bg-red-700 text-white font-bold shadow-lg shadow-red-600/30"
            >
              <PhoneOff className="w-5 h-5" />
            </Button>
          </div>

          <div className="flex items-center gap-1.5 text-[10px] text-zinc-500 font-semibold">
            <ShieldCheck className="w-3.5 h-3.5 text-indigo-400" />
            <span>Encrypted Twilio VoIP Line</span>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
