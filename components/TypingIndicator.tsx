export default function TypingIndicator() {
  return (
    <div className="inline-flex items-center gap-1.5 px-1 py-2">
      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--contrast-weak)] [animation-delay:0ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--contrast-weak)] [animation-delay:120ms]" />
      <span className="h-2 w-2 animate-bounce rounded-full bg-[var(--contrast-weak)] [animation-delay:240ms]" />
    </div>
  );
}
