"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import Link from "next/link";
import { BrandWordmark } from "@/components/BrandWordmark";
import { heroSlides } from "@/lib/home-content";
import styles from "@/components/home.module.css";

type HomeHeroProps = {
  primaryCtaLabel: string;
  /** Optional rooftop photo from public/marketing */
  photoSrc?: string | null;
  /** Optional muted looping video (preferred when motion is allowed) */
  videoSrc?: string | null;
};

const SLIDE_MS = 6500;

export function HomeHero({ primaryCtaLabel, photoSrc = null, videoSrc = null }: HomeHeroProps) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const [allowMotion, setAllowMotion] = useState(false);

  useEffect(() => {
    const reduced =
      typeof window !== "undefined" &&
      window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setAllowMotion(!reduced);
    if (reduced || paused) return;

    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % heroSlides.length);
    }, SLIDE_MS);
    return () => window.clearInterval(id);
  }, [paused]);

  const slide = heroSlides[index] ?? heroSlides[0]!;
  const useVideo = Boolean(videoSrc && allowMotion);
  const hasMedia = Boolean(photoSrc || useVideo);

  return (
    <section
      className={`${styles.hero}${hasMedia ? ` ${styles.heroWithPhoto}` : ""}`}
      aria-label="OorjaMan"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      {useVideo ? (
        <div className={styles.heroPhoto} aria-hidden>
          <video
            className={styles.heroVideo}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={photoSrc ?? undefined}
          >
            <source src={videoSrc!} type="video/mp4" />
          </video>
          <div className={styles.heroPhotoScrim} />
        </div>
      ) : photoSrc ? (
        <div className={styles.heroPhoto} aria-hidden>
          <Image
            src={photoSrc}
            alt=""
            fill
            priority
            sizes="100vw"
            className={styles.heroPhotoImg}
          />
          <div className={styles.heroPhotoScrim} />
        </div>
      ) : null}
      <div className={styles.heroGlow} aria-hidden />
      <div className={styles.heroVisual} aria-hidden>
        <div className={styles.heroPanel} data-tone={index} />
        <div className={styles.heroOrb} />
        <div className={styles.heroGridAccent} />
      </div>

      <div className={`om-container ${styles.heroInner}`}>
        <p className={`${styles.brandLine} om-rise`}>
          <BrandWordmark size="hero" tone="onDark" />
        </p>

        <div className={styles.heroCopy} key={slide.id}>
          <p className={`${styles.heroEyebrow} om-rise om-rise-delay-1`}>{slide.eyebrow}</p>
          <h1 className={`${styles.headline} om-rise om-rise-delay-1`}>{slide.headline}</h1>
          <p className={`${styles.support} om-rise om-rise-delay-2`}>{slide.support}</p>
        </div>

        <p className={`${styles.ctas} om-rise om-rise-delay-3`}>
          <Link href="/download" className="om-btn om-btn--primary">
            {primaryCtaLabel}
          </Link>
          <Link href="/how-it-works" className="om-btn om-btn--ghost-light">
            How it works
          </Link>
        </p>

        <div className={styles.heroDots} role="tablist" aria-label="Hero headlines">
          {heroSlides.map((s, i) => (
            <button
              key={s.id}
              type="button"
              role="tab"
              aria-selected={i === index}
              aria-label={`Show slide ${i + 1}: ${s.headline}`}
              className={i === index ? styles.heroDotActive : styles.heroDot}
              onClick={() => setIndex(i)}
            />
          ))}
        </div>
      </div>
    </section>
  );
}
