import type { Metadata } from "next";

import { IntroFilm } from "@/components/intro/IntroFilm";

export const metadata: Metadata = {
  title: "TravelTrack · The reveal",
  description: "A one-minute introduction to TravelTrack, ride sharing for Plaksha.",
};

export default function IntroPage() {
  return <IntroFilm />;
}
