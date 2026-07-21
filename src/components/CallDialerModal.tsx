import { useState, useEffect, useRef } from "react";
import { Device, Call as TwilioCall } from "@twilio/voice-sdk";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { PhoneOff, Mic, MicOff, Volume2, ShieldCheck, User, AlertTriangle, FlaskConical } from "lucide-react";
import { trpc } from "@/providers/trpc";

interface CallDialerModalProps {
  isOpen: boolean;
  organizationId: number;
  phoneNumber: string;
  contactName?: string;
  callId?: number | null;
  onClose: () => void;
}

type CallState = "connecting" | "ringing" | "connected" | "ended" | "failed";

export function CallDialerModal({ isOpen, organizationId, phoneNumber, contactName, callId, onClose }: CallDialerModalProps) {
  const [callState, setCallState] = useState<CallState>("connecting");
  const [seconds, setSeconds] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isSimulated, setIsSimulated] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const secondsRef = useRef(0);
  const deviceRef = useRef<Device | null>(null);
  const activeCallRef = useRef<TwilioCall | null>(null);
  const simulatedTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const utils = trpc.useUtils();

  const generateToken = trpc.calls.generateVoiceToken.useQuery(
    { organizationId },
    { enabled: false }
  );

  const updateCallMutation = trpc.calls.update.useMutation({
    onSuccess: () => {
      utils.calls.list.invalidate();
      utils.calls.stats.invalidate();
    },
  });

  const hangupMutation = trpc.calls.hangup.useMutation({
    onSuccess: () => {
      utils.calls.list.invalidate();
      utils.calls.stats.invalidate();
    },
  });

  const cleanupDevice = () => {
    if (simulatedTimeoutRef.current) {
      clearTimeout(simulatedTimeoutRef.current);
      simulatedTimeoutRef.current = null;
    }
    if (activeCallRef.current) {
      activeCallRef.current.removeAllListeners();
      activeCallRef.current = null;
    }
    if (deviceRef.current) {
      deviceRef.current.destroy();
      deviceRef.current = null;
    }
  };

  // Reset local state whenever the modal closes so the next call starts clean.
  useEffect(() => {
    if (!isOpen) {
      cleanupDevice();
      setCallState("connecting");
      setSeconds(0);
      secondsRef.current = 0;
      setIsMuted(false);
      setIsSimulated(false);
      setErrorMessage(null);
    }
  }, [isOpen]);

  // Establishes the real WebRTC connection once the server has created a call
  // record (callId). Falls back to a clearly-labeled simulated call when this
  // organization has no working Twilio Voice configuration.
  useEffect(() => {
    if (!isOpen || !callId) return;

    let cancelled = false;

    (async () => {
      const result = await generateToken.refetch();
      const tokenData = result.data;
      if (cancelled || !tokenData) return;

      if (tokenData.simulated) {
        setIsSimulated(true);
        setCallState("ringing");
        simulatedTimeoutRef.current = setTimeout(() => {
          if (!cancelled) setCallState("connected");
        }, 1200);
        return;
      }

      try {
        const device = new Device(tokenData.token, { logLevel: "error" });
        deviceRef.current = device;
        device.on("error", (err) => {
          if (cancelled) return;
          setErrorMessage(err.message || "Voice connection error");
          setCallState("failed");
        });

        await device.register();
        if (cancelled) return;

        const call = await device.connect({
          params: { To: phoneNumber, callRecordId: String(callId) },
        });
        if (cancelled) {
          call.disconnect();
          return;
        }
        activeCallRef.current = call;

        call.on("ringing", () => !cancelled && setCallState("ringing"));
        call.on("accept", () => !cancelled && setCallState("connected"));
        call.on("disconnect", () => !cancelled && setCallState("ended"));
        call.on("cancel", () => !cancelled && setCallState("ended"));
        call.on("reject", () => !cancelled && setCallState("ended"));
        call.on("error", (err) => {
          if (cancelled) return;
          setErrorMessage(err.message || "Call error");
          setCallState("failed");
        });
      } catch (err) {
        if (!cancelled) {
          setErrorMessage(err instanceof Error ? err.message : "Failed to start call");
          setCallState("failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, callId]);

  useEffect(() => {
    let interval: ReturnType<typeof setInterval>;
    if (callState === "connected") {
      interval = setInterval(() => {
        setSeconds((prev) => {
          const next = prev + 1;
          secondsRef.current = next;
          return next;
        });
      }, 1000);
    }
    return () => clearInterval(interval);
  }, [callState]);

  const handleEndCall = () => {
    if (activeCallRef.current) {
      activeCallRef.current.disconnect();
    }
    cleanupDevice();
    setCallState("ended");

    const finalDuration = secondsRef.current;
    if (callId) {
      if (isSimulated) {
        updateCallMutation.mutate({
          id: callId,
          status: "completed",
          duration: finalDuration,
          notes: `Call completed by agent after ${finalDuration} seconds (simulated — Twilio Voice is not configured for this organization).`,
        });
      } else {
        hangupMutation.mutate({ id: callId });
      }
    }
    setTimeout(() => onClose(), 800);
  };

  const toggleMute = () => {
    const next = !isMuted;
    setIsMuted(next);
    activeCallRef.current?.mute(next);
  };

  const formatTimer = (totalSec: number) => {
    const mins = Math.floor(totalSec / 60);
    const secs = totalSec % 60;
    return `${mins.toString().padStart(2, "0")}:${secs.toString().padStart(2, "0")}`;
  };

  const statusLabel = callState === "failed" ? (errorMessage || "Call failed") : callState;

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
                  : callState === "failed"
                  ? "bg-red-500/20 border-red-500 text-red-400"
                  : "bg-indigo-500/20 border-indigo-500 text-indigo-400 animate-bounce"
              }`}
            >
              {callState === "failed" ? <AlertTriangle className="w-10 h-10" /> : <User className="w-10 h-10" />}
            </div>
          </div>

          {/* Contact Details */}
          <div className="space-y-1">
            <h3 className="text-lg font-bold text-white tracking-tight">
              {contactName || phoneNumber}
            </h3>
            <p className="text-xs font-semibold text-zinc-400">{phoneNumber}</p>

            {/* Call Status Badge */}
            <div className="pt-2 flex items-center justify-center gap-2">
              <span
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold capitalize ${
                  callState === "connected"
                    ? "bg-emerald-500/20 text-emerald-400 border border-emerald-500/30"
                    : callState === "ended"
                    ? "bg-zinc-800 text-zinc-400"
                    : callState === "failed"
                    ? "bg-red-500/20 text-red-400 border border-red-500/30"
                    : "bg-indigo-500/20 text-indigo-300 border border-indigo-500/30"
                }`}
              >
                <span
                  className={`w-2 h-2 rounded-full ${
                    callState === "connected"
                      ? "bg-emerald-400"
                      : callState === "ended"
                      ? "bg-zinc-500"
                      : callState === "failed"
                      ? "bg-red-400"
                      : "bg-indigo-400 animate-ping"
                  }`}
                />
                {callState === "connected" ? formatTimer(seconds) : statusLabel}
              </span>
              {isSimulated && (
                <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                  <FlaskConical className="w-3 h-3" /> Simulated
                </span>
              )}
            </div>
          </div>

          {/* Call Controls */}
          <div className="grid grid-cols-3 gap-4 w-full pt-4 border-t border-zinc-800">
            <Button
              variant="outline"
              onClick={toggleMute}
              disabled={callState !== "connected" || isSimulated}
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
            <span>{isSimulated ? "Simulated Call — Twilio Voice not configured" : "Encrypted Twilio VoIP Line"}</span>
          </div>

        </div>
      </DialogContent>
    </Dialog>
  );
}
