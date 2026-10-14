type TmdbFullscreenBackdropProps = {
  src?: string | null;
};

/** Fond TMDB pleine page (fiche courte : interactif / demande film). */
export function TmdbFullscreenBackdrop({ src }: TmdbFullscreenBackdropProps) {
  if (!src) return null;

  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
      <img
        src={src}
        alt=""
        className="absolute inset-0 w-full h-full object-cover opacity-[0.28] scale-[1.02]"
      />
      <div className="absolute inset-0 bg-gray-950/50 backdrop-blur-[1px]" />
      <div className="absolute inset-0 bg-gradient-to-b from-gray-950/75 via-transparent to-gray-950" />
      <div className="absolute inset-0 bg-gradient-to-r from-gray-950/65 via-transparent to-gray-950/65" />
      <div
        className="absolute inset-0"
        style={{
          background:
            'radial-gradient(ellipse 85% 75% at 50% 40%, transparent 45%, rgba(3,7,18,0.3) 100%)',
        }}
      />
    </div>
  );
}
