import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: Splash,
});

function Splash() {
  return (
    <div className="phone-shell flex flex-col">
      <div className="relative flex-1 flex flex-col justify-end text-white min-h-[100dvh] md:min-h-0 md:h-full">
        <img
          src="https://images.unsplash.com/photo-1444723121867-7a241cacace9?auto=format&fit=crop&w=900&q=80"
          alt="City skyscrapers at golden hour"
          className="absolute inset-0 w-full h-full object-cover"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/30 via-black/40 to-black/85" />

        <div className="relative px-8 pb-10 pt-24 text-center flex flex-col items-center">
          <h1 className="font-display font-extrabold text-5xl tracking-tight text-white drop-shadow-lg">
            newsvalla
          </h1>
          <p className="mt-3 italic text-lg text-white/95">Stay informed in 60 words.</p>
          <div className="mt-5 h-[3px] w-12 bg-primary rounded-full" />
          <p className="mt-6 text-[15px] leading-relaxed text-white/85 max-w-xs">
            The world's fastest news summary engine. Curated for the modern reader who values
            precision and time.
          </p>

          <Link
            to="/feed"
            className="mt-10 w-full bg-primary hover:bg-primary/90 transition text-primary-foreground font-display font-bold tracking-wide text-lg py-4 rounded-md text-center shadow-lg shadow-primary/40"
          >
            LET'S READ
          </Link>

          <p className="mt-6 font-label text-[11px] tracking-[0.2em] text-white/40">
            VIBRANT EDITORIAL EDITION 2.0
          </p>
        </div>
      </div>
    </div>
  );
}
