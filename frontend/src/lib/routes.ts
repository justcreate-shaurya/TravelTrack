/** The app's routes. Screens link with these instead of hard-coding paths. */
export const ROUTES = {
  home: "/",
  rides: "/rides",
  profile: "/profile",
  login: "/login",
  onboarding: "/onboarding",
  pool: (id: string) => `/pool/${id}`,
} as const;
