"use client";

import { FormEvent, KeyboardEvent, useCallback, useRef, useState } from "react";

interface ChatInputProps {
  disabled?: boolean;
  placeholder?: string;
  phase?: "intake" | "commons" | "conclusion";
  onSend: (content: string) => Promise<void> | void;
}

export default function ChatInput({ disabled, placeholder, phase, onSend }: ChatInputProps) {
  const [value, setValue] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const resize = useCallback(() => {
    const el = textareaRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  const handleSubmit = async (event?: FormEvent) => {
    event?.preventDefault();
    const content = value.trim();
    if (!content || disabled) return;

    setValue("");
    requestAnimationFrame(() => {
      if (textareaRef.current) {
        textareaRef.current.style.height = "auto";
      }
    });
    await onSend(content);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      handleSubmit();
    }
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="border-t-2 border-[var(--surface-elevated)] bg-[var(--surface-bg)] px-4 pb-6 pt-2 lg:border-t-0 lg:pb-4"
    >
      <div className="relative mx-auto flex max-w-[600px] items-center gap-3">
        <div
          className="flex min-h-[56px] flex-1 cursor-text items-end rounded-[var(--radius-pill)] bg-[var(--surface-elevated)] pl-4 pr-2"
          onClick={() => textareaRef.current?.focus()}
        >
          <textarea
            ref={textareaRef}
            value={value}
            onChange={(event) => {
              setValue(event.target.value);
              resize();
            }}
            onKeyDown={handleKeyDown}
            placeholder={placeholder || "Type a message"}
            disabled={disabled}
            rows={1}
            className="flex-1 resize-none bg-transparent py-[14px] text-base leading-[1.5] text-[var(--contrast-strong)] outline-none placeholder:text-[var(--contrast-weak)]"
            style={{ maxHeight: "120px", overflowY: "auto" }}
          />
          <button
            type="submit"
            disabled={disabled || !value.trim()}
            className={`mb-2 ml-2 flex h-10 w-10 shrink-0 items-center justify-center rounded-full text-white disabled:opacity-40 ${phase === "commons" ? "bg-[var(--damson-600)]" : "bg-[var(--wood-600)]"}`}
            aria-label="Send message"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 19V5M12 5L5 12M12 5L19 12" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </button>
        </div>
      </div>
    </form>
  );
}
