import { useEffect, useRef } from "react";
import { cn } from "@/lib/utils";

interface AdBannerProps {
  className?: string;
  dataAdClient?: string;
  dataAdSlot?: string;
  dataAdFormat?: string;
  dataFullWidthResponsive?: string;
}

export function AdBanner({
  className,
  dataAdClient = "ca-pub-XXXXXXXXXXXXXXXX", // Placeholder
  dataAdSlot = "XXXXXXXXXX", // Placeholder
  dataAdFormat = "auto",
  dataFullWidthResponsive = "true",
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);

  useEffect(() => {
    // Only push if the ad hasn't been initialized yet and the script is loaded
    try {
      if (typeof window !== "undefined") {
        const adsbygoogle = (window as any).adsbygoogle || [];
        // Google adsense automatically adds a 'data-adsbygoogle-status' attribute when initialized
        if (adRef.current && !adRef.current.hasAttribute("data-adsbygoogle-status")) {
          adsbygoogle.push({});
        }
      }
    } catch (err) {
      console.error("Adsense error:", err);
    }
  }, []);

  return (
    <div
      className={cn(
        "relative flex w-full items-center justify-center overflow-hidden rounded-xl border border-border/50 bg-card/10 text-muted-foreground",
        className
      )}
    >
      <div className="absolute inset-0 flex items-center justify-center text-[10px] uppercase tracking-widest text-muted-foreground/30 pointer-events-none">
        Advertisement
      </div>
      <ins
        ref={adRef}
        className="adsbygoogle relative z-10"
        style={{ display: "block", width: "100%", height: "100%", minHeight: "90px" }}
        data-ad-client={dataAdClient}
        data-ad-slot={dataAdSlot}
        data-ad-format={dataAdFormat}
        data-full-width-responsive={dataFullWidthResponsive}
      />
    </div>
  );
}
