"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

/** @deprecated use /dev/review-demo */
export default function PlayReviewDevRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace("/dev/review-demo");
  }, [router]);
  return null;
}
