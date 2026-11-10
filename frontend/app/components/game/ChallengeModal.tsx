// app/components/game/ChallengeModal.tsx
// Cyberpunk Modal for Checkpoint Door Challenges (US-16, US-17, US-18, US-19, US-20, US-21)
import { useState, useEffect, useRef } from "react";
import { FaCode, FaCheck, FaTimes, FaClock, FaTerminal, FaPlay, FaLockOpen } from "react-icons/fa";
import { submitDoor, type DoorChallenge, type SubmitResult } from "~/api/game";

interface ChallengeModalProps {
  roomCode: string;
  challenge: DoorChallenge;
  isOpen: boolean;
  /** true when the server already opened this door (solved or 4-minute timeout) */
  serverUnlocked: boolean;
  onClose: () => void;
  onSuccess: (cpNum: number) => void;
}

export default function ChallengeModal({
  roomCode,
  challenge,
  isOpen,
  serverUnlocked,
  onClose,
  onSuccess,
}: ChallengeModalProps) {
  const [code, setCode] = useState<string>(challenge.initialCode);
  const [evaluating, setEvaluating] = useState(false);
  const [result, setResult] = useState<SubmitResult | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [secondsRemaining, setSecondsRemaining] = useState<number>(challenge.secondsRemaining);
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const doneRef = useRef(false);

  // New door -> fresh editor and the server's countdown value
  useEffect(() => {
    setCode(challenge.initialCode);
    setResult(null);
    setSubmitError(null);
    setSecondsRemaining(challenge.secondsRemaining);
    doneRef.current = false;
  }, [challenge.cpNum, challenge.initialCode, challenge.secondsRemaining]);

  // US-20: countdown shown to the player (the server owns the real timer; it never resets)
  useEffect(() => {
    if (!isOpen) return;
    const timer = setInterval(() => setSecondsRemaining((prev) => Math.max(0, prev - 1)), 1000);
    return () => clearInterval(timer);
  }, [isOpen, challenge.cpNum]);

  // Door opened by the server (solution accepted or 4 minutes passed) -> unlock and close
  useEffect(() => {
    if (!isOpen || !serverUnlocked || doneRef.current) return;
    doneRef.current = true;
    const id = setTimeout(() => onSuccess(challenge.cpNum), result?.passed ? 900 : 1500);
    return () => clearTimeout(id);
  }, [isOpen, serverUnlocked, challenge.cpNum, onSuccess, result?.passed]);

  if (!isOpen) return null;

  const autoUnlocked = serverUnlocked && !result?.passed;
  const minutes = Math.floor(secondsRemaining / 60);
  const seconds = secondsRemaining % 60;
  const timeFormatted = `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;

  // US-17: the code is sent to the server and evaluated there
  const handleSubmit = async () => {
    if (evaluating || serverUnlocked) return;
    setEvaluating(true);
    setResult(null);
    setSubmitError(null);
    try {
      const res = await submitDoor(roomCode, challenge.cpNum, code);
      setResult(res);
      setSecondsRemaining(res.secondsRemaining);
      if (res.unlocked && !doneRef.current) {
        doneRef.current = true;
        setTimeout(() => onSuccess(challenge.cpNum), 1200);
      }
    } catch (e) {
      setSubmitError(e instanceof Error ? e.message : "Evaluator unavailable");
    } finally {
      setEvaluating(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    // Tab key inserts 2 spaces instead of leaving textarea
    if (e.key === "Tab") {
      e.preventDefault();
      const target = e.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const val = target.value;
      target.value = val.substring(0, start) + "  " + val.substring(end);
      target.selectionStart = target.selectionEnd = start + 2;
      setCode(target.value);
    }
    // Ctrl + Enter or Cmd + Enter to submit code
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      handleSubmit();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/85 backdrop-blur-sm p-4 font-pixel select-none animate-fadeIn">
      <div className="relative w-full max-w-4xl bg-[#080d1a] border-2 border-neon shadow-[0_0_30px_rgba(0,255,204,0.3)] flex flex-col max-h-[92vh] overflow-hidden text-xs text-gray-200">
        
        {/* Top Header Bar */}
        <div className="flex items-center justify-between px-4 py-3 bg-[#0d162a] border-b border-neon/40">
          <div className="flex items-center gap-3">
            <FaTerminal className="text-neon text-base animate-pulse" />
            <span className="text-yellow text-sm tracking-wider">{challenge.title}</span>
            <span className="bg-neon/15 border border-neon/50 text-neon px-2 py-0.5 text-[10px] rounded uppercase">
              {challenge.difficulty}
            </span>
          </div>

          <div className="flex items-center gap-4">
            {/* US-20: Door 4-minute timer countdown */}
            <div className={`flex items-center gap-2 border px-3 py-1 text-xs ${
              secondsRemaining < 60 ? "border-pink text-pink animate-pulse" : "border-yellow text-yellow"
            }`}>
              <FaClock />
              <span>DOOR TIMER: {timeFormatted}</span>
            </div>

            <button
              onClick={onClose}
              className="text-gray-400 hover:text-pink transition-colors px-2 py-1 border border-transparent hover:border-pink text-sm"
              title="Close Terminal"
            >
              ✕
            </button>
          </div>
        </div>

        {/* Content Body */}
        <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-4 p-4 overflow-y-auto">
          
          {/* Left Column: Problem statement and test examples */}
          <div className="flex flex-col gap-4 border-r border-neon/20 pr-4">
            <div>
              <h3 className="text-neon uppercase tracking-wide text-[11px] mb-2 flex items-center gap-2">
                <span className="w-1.5 h-1.5 bg-neon inline-block"></span> TASK BRIEFING
              </h3>
              <p className="text-gray-300 font-sans text-sm leading-relaxed whitespace-pre-line bg-[#040814] p-3 border border-gray-800 rounded">
                {challenge.description}
              </p>
            </div>

            <div className="grid grid-cols-2 gap-2 text-[10px]">
              <div className="bg-[#050b18] p-2.5 border border-gray-800">
                <div className="text-yellow mb-1 uppercase font-bold">INPUT FORMAT:</div>
                <div className="text-gray-400 font-sans">{challenge.inputDescription}</div>
              </div>
              <div className="bg-[#050b18] p-2.5 border border-gray-800">
                <div className="text-yellow mb-1 uppercase font-bold">OUTPUT FORMAT:</div>
                <div className="text-gray-400 font-sans">{challenge.outputDescription}</div>
              </div>
            </div>

            {/* Examples (the hidden checks are run on the server) */}
            <div>
              <h4 className="text-gray-400 text-[10px] uppercase mb-2">EXAMPLES:</h4>
              <div className="space-y-1.5 font-mono text-[11px]">
                {challenge.examples.map((ex, idx) => (
                  <div key={idx} className="bg-[#040814] border border-gray-800 px-3 py-1.5 text-gray-300">
                    {ex}
                  </div>
                ))}
              </div>
            </div>

            {/* US-21 Notification banner if time ran out */}
            {autoUnlocked && (
              <div className="p-3 bg-neon/10 border-2 border-neon text-neon text-center flex items-center justify-center gap-2 animate-bounce">
                <FaLockOpen className="text-lg" />
                <span>4-MINUTE THRESHOLD REACHED! DOOR AUTO-UNLOCKED!</span>
              </div>
            )}
          </div>

          {/* Right Column: Code Editor & Execution status */}
          <div className="flex flex-col gap-3">
            <div className="flex justify-between items-center text-[10px] text-gray-400">
              <span className="flex items-center gap-2 text-neon">
                <FaCode /> JAVASCRIPT (CHECKED ON SERVER)
              </span>
              <span>PRESS CTRL+ENTER TO RUN</span>
            </div>

            {/* Terminal Code Editor */}
            <div className="relative flex-1 min-h-[220px] bg-[#02050f] border border-neon/40 p-2 flex flex-col font-mono">
              <div className="text-[10px] text-gray-500 pb-1 border-b border-gray-800 mb-2 flex justify-between">
                <span>// solution.js</span>
                <span>UTF-8</span>
              </div>
              <textarea
                ref={textareaRef}
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={handleKeyDown}
                spellCheck={false}
                className="w-full flex-1 bg-transparent text-emerald-400 font-mono text-xs focus:outline-none resize-none leading-relaxed selection:bg-neon/30 selection:text-white"
                placeholder="Write your code here..."
              />
            </div>

            {/* US-19: Evaluation Result Feedback */}
            {submitError && (
              <div className="p-3 border border-pink bg-pink/15 text-pink text-xs font-mono">{submitError}</div>
            )}
            {result && (
              <div className={`p-3 border text-xs font-sans transition-all ${
                result.passed ? "bg-neon/15 border-neon text-neon" : "bg-pink/15 border-pink text-pink"
              }`}>
                <div className="flex items-center gap-2 font-pixel text-[11px] mb-1">
                  {result.passed ? <FaCheck className="text-neon" /> : <FaTimes className="text-pink" />}
                  <span>
                    {result.passed
                      ? `ACCEPTED! (${result.passedCount}/${result.total} TESTS PASSED) - UNLOCKING DOOR...`
                      : result.errorMessage
                        ? "REJECTED"
                        : `REJECTED (${result.passedCount}/${result.total} TESTS PASSED)`}
                  </span>
                </div>

                {result.errorMessage && (
                  <div className="text-[11px] text-pink/90 font-mono mt-1">Error: {result.errorMessage}</div>
                )}

                {!result.passed && result.details.length > 0 && (
                  <div className="mt-2 space-y-1 font-mono text-[10px] bg-black/40 p-2 border border-pink/30 max-h-24 overflow-y-auto">
                    {result.details.map((d, i) => (
                      <div key={i} className={d.passed ? "text-emerald-400" : "text-pink"}>
                        #{d.index}:{" "}
                        {d.passed
                          ? "PASSED"
                          : d.visible
                            ? `FAILED | Input: ${d.input} | Expected: ${d.expected} | Got: ${d.actual}`
                            : "FAILED (hidden test)"}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {/* Action Buttons */}
            <div className="flex gap-3 mt-1">
              <button
                type="button"
                onClick={handleSubmit}
                disabled={evaluating || serverUnlocked}
                className={`flex-1 py-3 px-4 font-pixel text-xs tracking-wider flex items-center justify-center gap-2 border transition-all ${
                  evaluating
                    ? "bg-gray-800 text-gray-400 border-gray-700 cursor-not-allowed"
                    : "bg-neon hover:bg-neon/80 text-black border-neon shadow-[0_0_15px_rgba(0,255,204,0.4)] active:scale-98"
                }`}
              >
                <FaPlay className="text-[10px]" />
                {evaluating ? "SERVER IS CHECKING..." : "SUBMIT SOLUTION [RUN]"}
              </button>
            </div>

          </div>

        </div>

      </div>
    </div>
  );
}
