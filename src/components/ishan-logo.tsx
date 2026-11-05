import { cn } from "@/lib/utils";

export function IshanLogo({ 
  className, 
  showText = false, 
  textPosition = 'side'
}: { 
  className?: string, 
  showText?: boolean, 
  textPosition?: 'side' | 'bottom'
}) {
  const logoEl = (
    <div className={cn("relative flex items-center justify-center overflow-hidden transition-transform duration-500 hover:scale-110", className)}>
      <img 
        src="/branding/logo.png" 
        alt="Ishan Logo" 
        className="h-full w-full object-contain"
      />
    </div>
  );

  const brandText = "ISHAN";

  if (textPosition === 'bottom' && showText) {
    return (
      <div className="flex flex-col items-center gap-3">
        {logoEl}
        <span className="text-xl font-black tracking-[0.4em] text-foreground">{brandText}</span>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-3">
      {logoEl}
      {showText && <span className="text-xl font-black tracking-[0.4em] text-foreground">{brandText}</span>}
    </div>
  );
}
