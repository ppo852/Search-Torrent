import {
  originPlatformLogoUrl,
  type TmdbOriginPlatform,
} from '../../lib/tmdb-origin-platforms';

type OriginPlatformLogosProps = {
  platforms?: TmdbOriginPlatform[] | null;
  className?: string;
};

export function OriginPlatformLogos({ platforms, className = '' }: OriginPlatformLogosProps) {
  if (!Array.isArray(platforms) || platforms.length === 0) return null;

  return (
    <div className={`flex flex-wrap items-center gap-2.5 ${className}`.trim()}>
      {platforms.map((p) => {
        const src = originPlatformLogoUrl(p.logoPath);
        if (src) {
          return (
            <img
              key={p.id}
              src={src}
              alt={p.name}
              title={p.name}
              className="h-12 w-12 rounded-lg object-contain bg-white/95 ring-1 ring-white/10"
            />
          );
        }
        return (
          <span
            key={p.id}
            title={p.name}
            className="px-2.5 py-1.5 rounded-lg border border-white/10 bg-white/5 text-[11px] font-black uppercase tracking-widest text-gray-300"
          >
            {p.name}
          </span>
        );
      })}
    </div>
  );
}
