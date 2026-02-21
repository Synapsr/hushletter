"use client";
import { cn } from "@hushletter/ui/lib/utils";
import { useMutation } from "convex/react";
import { Loader2Icon } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState, useRef, type RefObject } from "react";
import { useOnClickOutside } from "usehooks-ts";
import { api } from "@hushletter/backend";
import { toast } from "sonner";

export const SharedFeedback = () => {
  const [open, setOpen] = useState(false);
  const [formState, setFormState] = useState<"idle" | "loading" | "success">(
    "idle",
  );
  const [feedback, setFeedback] = useState("");
  const ref = useRef<HTMLDivElement>(null);
  const sendFeedback = useMutation(api.users.sendFeedbackToDiscord);
  useOnClickOutside(ref as RefObject<HTMLElement>, () => setOpen(false));

  async function submit() {
    if (formState === "loading") return;
    const message = feedback.trim();
    if (message.length < 10) return;

    setFormState("loading");
    try {
      const page =
        typeof window !== "undefined"
          ? `${window.location.pathname}${window.location.search}`
          : undefined;

      await sendFeedback({
        subject: "Feedback from shared feedback button",
        message,
        page,
      });

      setFormState("success");
      setTimeout(() => {
        setOpen(false);
      }, 1800);
    } catch {
      setFormState("idle");
      toast.error("Could not send feedback. Please try again.");
    }
  }

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
      }

      if (
        (event.ctrlKey || event.metaKey) &&
        event.key === "Enter" &&
        open &&
        formState === "idle"
      ) {
        void submit();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, formState, feedback]);

  return (
    <div className="z-20 fixed bottom-4 right-4  w-fit flex justify-center items-center max-md:hidden">
      <motion.button
        layoutId="wrapper"
        onClick={() => {
          setOpen(true);
          setFormState("idle");
          setFeedback("");
        }}
        key="button"
        className="relative flex h-9 items-center rounded-lg border bg-sheer px-3 font-medium outline-none"
        style={{ borderRadius: 8 }}
      >
        <motion.span className="text-sm block" layoutId="title">
          Feedback
        </motion.span>
      </motion.button>

      <AnimatePresence>
        {open ? (
          <motion.div
            layoutId="wrapper"
            className="absolute h-[192px] w-[364px] bottom-0 right-0 overflow-hidden rounded-[12px] bg-[#f5f6f7] p-1 shadow-[0_0_0_1px_rgba(0,0,0,0.08),0px_2px_2px_rgba(0,0,0,0.04)] outline-none"
            ref={ref}
            style={{ borderRadius: 12 }}
          >
            <motion.span
              aria-hidden
              className="absolute left-4 top-[17px] text-sm text-muted-foreground transition-opacity data-[feedback=true]:!opacity-0"
              layoutId="title"
              data-success={formState === "success" ? "true" : "false"}
              data-feedback={feedback ? "true" : "false"}
            >
              Feedback
            </motion.span>
            <AnimatePresence mode="popLayout">
              {formState === "success" ? (
                <motion.div
                  key="success"
                  initial={{ y: -32, opacity: 0, filter: "blur(4px)" }}
                  animate={{ y: 0, opacity: 1, filter: "blur(0px)" }}
                  transition={{ type: "spring", duration: 0.4, bounce: 0 }}
                  className={cn(
                    "flex h-full flex-col items-center justify-center",
                    "[&>svg]:-mt-1",
                    "[&>h3]:mb-1 [&>h3]:mt-2 [&>h3]:text-sm [&>h3]:font-medium [&>h3]:text-primary",
                    "[&>p]:text-sm [&>p]:text-muted-foreground",
                  )}
                >
                  <svg
                    width="32"
                    height="32"
                    viewBox="0 0 32 32"
                    fill="none"
                    xmlns="http://www.w3.org/2000/svg"
                  >
                    <path
                      d="M27.6 16C27.6 17.5234 27.3 19.0318 26.717 20.4392C26.1341 21.8465 25.2796 23.1253 24.2025 24.2025C23.1253 25.2796 21.8465 26.1341 20.4392 26.717C19.0318 27.3 17.5234 27.6 16 27.6C14.4767 27.6 12.9683 27.3 11.5609 26.717C10.1535 26.1341 8.87475 25.2796 7.79759 24.2025C6.72043 23.1253 5.86598 21.8465 5.28302 20.4392C4.70007 19.0318 4.40002 17.5234 4.40002 16C4.40002 12.9235 5.62216 9.97301 7.79759 7.79759C9.97301 5.62216 12.9235 4.40002 16 4.40002C19.0765 4.40002 22.027 5.62216 24.2025 7.79759C26.3779 9.97301 27.6 12.9235 27.6 16Z"
                      fill="#2090FF"
                      fillOpacity="0.16"
                    />
                    <path
                      d="M12.1334 16.9667L15.0334 19.8667L19.8667 13.1M27.6 16C27.6 17.5234 27.3 19.0318 26.717 20.4392C26.1341 21.8465 25.2796 23.1253 24.2025 24.2025C23.1253 25.2796 21.8465 26.1341 20.4392 26.717C19.0318 27.3 17.5234 27.6 16 27.6C14.4767 27.6 12.9683 27.3 11.5609 26.717C10.1535 26.1341 8.87475 25.2796 7.79759 24.2025C6.72043 23.1253 5.86598 21.8465 5.28302 20.4392C4.70007 19.0318 4.40002 17.5234 4.40002 16C4.40002 12.9235 5.62216 9.97301 7.79759 7.79759C9.97301 5.62216 12.9235 4.40002 16 4.40002C19.0765 4.40002 22.027 5.62216 24.2025 7.79759C26.3779 9.97301 27.6 12.9235 27.6 16Z"
                      stroke="#2090FF"
                      strokeWidth="2.4"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                  <h3>Feedback received!</h3>
                  <p>Thanks for helping me improve Sonner.</p>
                </motion.div>
              ) : (
                <motion.form
                  exit={{ y: 8, opacity: 0, filter: "blur(4px)" }}
                  transition={{ type: "spring", duration: 0.4, bounce: 0 }}
                  key="form"
                  onSubmit={(e) => {
                    e.preventDefault();
                    void submit();
                  }}
                  className="rounded-lg border border-[#e6e7e8] bg-white"
                >
                  <textarea
                    autoFocus
                    placeholder="Feedback"
                    value={feedback}
                    onChange={(e) => setFeedback(e.target.value)}
                    className="w-full h-32 resize-none rounded-[8px_0px_8px_0px] p-3 text-sm outline-none placeholder:opacity-0"
                    required
                  />
                  <div className="relative flex h-12 items-center px-[10px]">
                    <svg
                      className="absolute left-0 right-0 -top-px"
                      width="352"
                      height="2"
                      viewBox="0 0 352 2"
                      fill="none"
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path
                        d="M0 1H352"
                        stroke="#E6E7E8"
                        strokeDasharray="4 4"
                      />
                    </svg>
                    <div className="half-circle-left absolute left-0 top-0 -translate-x-[1.5px] -translate-y-1/2">
                      <svg
                        width="6"
                        height="12"
                        viewBox="0 0 6 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <g clipPath="url(#clip0_2029_22)">
                          <path
                            d="M0 2C0.656613 2 1.30679 2.10346 1.91341 2.30448C2.52005 2.5055 3.07124 2.80014 3.53554 3.17157C3.99982 3.54301 4.36812 3.98396 4.6194 4.46927C4.87067 4.95457 5 5.47471 5 6C5 6.52529 4.87067 7.04543 4.6194 7.53073C4.36812 8.01604 3.99982 8.45699 3.53554 8.82843C3.07124 9.19986 2.52005 9.4945 1.91341 9.69552C1.30679 9.89654 0.656613 10 0 10V6V2Z"
                            fill="#F5F6F7"
                          />
                          <path
                            d="M1 12V10C2.06087 10 3.07828 9.57857 3.82843 8.82843C4.57857 8.07828 5 7.06087 5 6C5 4.93913 4.57857 3.92172 3.82843 3.17157C3.07828 2.42143 2.06087 2 1 2V0"
                            stroke="#E6E7E8"
                            strokeWidth="1"
                            strokeLinejoin="round"
                          />
                        </g>
                        <defs>
                          <clipPath id="clip0_2029_22">
                            <rect width="6" height="12" fill="white" />
                          </clipPath>
                        </defs>
                      </svg>
                    </div>

                    <div className="absolute right-0 top-0 translate-x-[1.5px] -translate-y-1/2 rotate-180">
                      <svg
                        width="6"
                        height="12"
                        viewBox="0 0 6 12"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <g clipPath="url(#clip0_2029_22)">
                          <path
                            d="M0 2C0.656613 2 1.30679 2.10346 1.91341 2.30448C2.52005 2.5055 3.07124 2.80014 3.53554 3.17157C3.99982 3.54301 4.36812 3.98396 4.6194 4.46927C4.87067 4.95457 5 5.47471 5 6C5 6.52529 4.87067 7.04543 4.6194 7.53073C4.36812 8.01604 3.99982 8.45699 3.53554 8.82843C3.07124 9.19986 2.52005 9.4945 1.91341 9.69552C1.30679 9.89654 0.656613 10 0 10V6V2Z"
                            fill="#F5F6F7"
                          />
                          <path
                            d="M1 12V10C2.06087 10 3.07828 9.57857 3.82843 8.82843C4.57857 8.07828 5 7.06087 5 6C5 4.93913 4.57857 3.92172 3.82843 3.17157C3.07828 2.42143 2.06087 2 1 2V0"
                            stroke="#E6E7E8"
                            strokeWidth="1"
                            strokeLinejoin="round"
                          />
                        </g>
                        <defs>
                          <clipPath id="clip0_2029_22">
                            <rect width="6" height="12" fill="white" />
                          </clipPath>
                        </defs>
                      </svg>
                    </div>

                    <button
                      type="submit"
                      disabled={
                        formState === "loading" || feedback.trim().length < 10
                      }
                      className="
                        ml-auto
                        flex
                        items-center
                        justify-center
                        rounded-[6px]
                        font-semibold
                        text-[12px]
                        h-6
                        w-[104px]
                        overflow-hidden
                        bg-linear-to-b from-[#1994ff] to-[#157cff]
                        shadow-[0px_0px_1px_1px_rgba(255,255,255,0.08)_inset,0px_1px_1.5px_0px_rgba(0,0,0,0.32),0px_0px_0px_0.5px_#1a94ff]
                        relative
                        disabled:opacity-60 disabled:pointer-events-none
                      "
                    >
                      <AnimatePresence mode="popLayout" initial={false}>
                        <motion.span
                          transition={{
                            type: "spring",
                            duration: 0.3,
                            bounce: 0,
                          }}
                          initial={{ opacity: 0, y: -25 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: 25 }}
                          key={formState}
                          className="
                            flex w-full items-center justify-center
                            text-white
                            [text-shadow:0px_1px_1.5px_rgba(0,0,0,0.16)]
                          "
                        >
                          {formState === "loading" ? (
                            <Loader2Icon
                              className="animate-spin"
                              size={14}
                              color="rgba(255, 255, 255, 0.65)"
                            />
                          ) : (
                            <span>Send feedback</span>
                          )}
                        </motion.span>
                      </AnimatePresence>
                    </button>
                  </div>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
};
