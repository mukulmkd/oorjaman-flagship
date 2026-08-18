"use client";

import Image from "next/image";
import { useEffect, useState } from "react";
import styles from "@/components/home.module.css";

type WhyUsStageProps = {
  photoSrc?: string | null;
  videoSrc?: string | null;
};

/**
 * Visual for “Track every visit”: phone preview of customer-app status
 * over optional rooftop media. Not a live booking - illustrative UI.
 */
export function WhyUsStage({ photoSrc = null, videoSrc = null }: WhyUsStageProps) {
  const [allowMotion, setAllowMotion] = useState(false);

  useEffect(() => {
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    setAllowMotion(!reduced);
  }, []);

  const useVideo = Boolean(videoSrc && allowMotion);
  const hasMedia = Boolean(photoSrc || useVideo);

  return (
    <div className={`${styles.whyStage}${hasMedia ? ` ${styles.hasPhoto}` : ""}`}>
      {useVideo ? (
        <div className={styles.whyStagePhoto} aria-hidden>
          <video
            className={styles.whyStageVideo}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            poster={photoSrc ?? undefined}
          >
            <source src={videoSrc!} type="video/mp4" />
          </video>
        </div>
      ) : photoSrc ? (
        <div className={styles.whyStagePhoto} aria-hidden>
          <Image
            src={photoSrc}
            alt=""
            fill
            sizes="(max-width: 900px) 100vw, 40vw"
            className={styles.whyStagePhotoImg}
          />
        </div>
      ) : null}
      <div className={styles.whyStageGlow} aria-hidden />

      <figure className={styles.whyPhone}>
        <figcaption className={styles.whyPhoneCaption}>Customer app · visit status</figcaption>
        <p className={styles.whyPhoneLabel}>Today’s visit</p>
        <p className={styles.whyPhoneStatus}>Partner technician en route</p>
        <ul className={styles.whyPhoneSteps}>
          <li data-done>Partner accepted</li>
          <li data-done>Technician assigned</li>
          <li data-active>En route to your rooftop</li>
          <li>Safety checklist &amp; photos</li>
        </ul>
        <p className={styles.whyPhoneHint}>
          Same accountability the left copy promises: status, safety, and evidence in one place.
        </p>
      </figure>
    </div>
  );
}
