import { motion, useAnimate } from "motion/react"
import { useRef, useState, useEffect, useCallback, type ChangeEvent, type KeyboardEvent, type ClipboardEvent } from "react"
import { cn } from "@hushletter/ui/lib/utils"

interface OtpInputProps {
  length?: number
  onComplete: (otp: string) => void
  onChange?: (value: string) => void
  error?: boolean
  disabled?: boolean
  autoFocus?: boolean
}

export function OtpInput({
  length = 6,
  onComplete,
  onChange,
  error = false,
  disabled = false,
  autoFocus = true,
}: OtpInputProps) {
  const [otp, setOtp] = useState<string[]>(Array(length).fill(""))
  const inputRefs = useRef<(HTMLInputElement | null)[]>([])
  const [scope, animate] = useAnimate<HTMLDivElement>()
  const submittedRef = useRef(false)

  // Shake animation on error (imperative, no key remounting)
  useEffect(() => {
    if (error) {
      submittedRef.current = false
      animate(scope.current, { x: [0, -8, 8, -8, 8, 0] }, { duration: 0.4 })
    }
  }, [error, animate, scope])

  // Auto-focus first input on mount
  useEffect(() => {
    if (autoFocus && inputRefs.current[0]) {
      inputRefs.current[0].focus()
    }
  }, [autoFocus])

  const focusInput = (index: number) => {
    const input = inputRefs.current[index]
    if (input) {
      input.focus()
      input.select()
    }
  }

  const updateOtp = useCallback((newOtp: string[]) => {
    setOtp(newOtp)
    onChange?.(newOtp.join(""))
  }, [onChange])

  const handleChange = (index: number, e: ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value

    // Only accept single digits
    if (value && !/^\d$/.test(value)) {
      return
    }

    const newOtp = [...otp]
    newOtp[index] = value
    updateOtp(newOtp)

    // Auto-focus next input if digit was entered
    if (value && index < length - 1) {
      focusInput(index + 1)
    }

    // Check if all digits are filled and prevent double-submission
    if (!submittedRef.current && newOtp.every((digit) => digit !== "")) {
      submittedRef.current = true
      onComplete(newOtp.join(""))
    }
  }

  const handleKeyDown = (index: number, e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace") {
      e.preventDefault()
      submittedRef.current = false
      const newOtp = [...otp]

      if (otp[index]) {
        newOtp[index] = ""
        updateOtp(newOtp)
      } else if (index > 0) {
        newOtp[index - 1] = ""
        updateOtp(newOtp)
        focusInput(index - 1)
      }
    }

    if (e.key === "ArrowLeft" && index > 0) {
      e.preventDefault()
      focusInput(index - 1)
    }

    if (e.key === "ArrowRight" && index < length - 1) {
      e.preventDefault()
      focusInput(index + 1)
    }
  }

  const handlePaste = (e: ClipboardEvent<HTMLInputElement>) => {
    e.preventDefault()
    const pastedData = e.clipboardData.getData("text")
    const digits = pastedData.replace(/\D/g, "").slice(0, length)

    if (digits) {
      const newOtp = Array(length).fill("")
      digits.split("").forEach((digit, i) => {
        newOtp[i] = digit
      })
      updateOtp(newOtp)

      const nextIndex = Math.min(digits.length, length - 1)
      focusInput(nextIndex)

      if (!submittedRef.current && digits.length === length) {
        submittedRef.current = true
        onComplete(newOtp.join(""))
      }
    }
  }

  return (
    <div
      ref={scope}
      className="flex items-center gap-3"
      role="group"
      aria-label="One-time password input"
    >
      {Array.from({ length }).map((_, index) => (
        <motion.input
          key={index}
          ref={(el) => {
            inputRefs.current[index] = el
          }}
          type="text"
          inputMode="numeric"
          pattern="[0-9]"
          maxLength={1}
          value={otp[index]}
          onChange={(e) => handleChange(index, e)}
          onKeyDown={(e) => handleKeyDown(index, e)}
          onPaste={handlePaste}
          disabled={disabled}
          autoComplete={index === 0 ? "one-time-code" : "off"}
          aria-label={`Digit ${index + 1}`}
          className={cn(
            "w-11 h-13 text-center text-xl font-semibold rounded-lg border bg-background ring-offset-background",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            error ? "border-destructive" : "border-input",
            disabled && "opacity-50 cursor-not-allowed"
          )}
          whileFocus={{ scale: 1.05 }}
          transition={{ type: "spring", stiffness: 400, damping: 30 }}
        />
      ))}
    </div>
  )
}
