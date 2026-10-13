/// <reference types="vite/client" />
interface ImportMetaEnv {
  readonly VITE_SHARE_API_URL?: string;
  readonly VITE_TURNSTILE_SITE_KEY?: string;
  readonly VITE_SHARE_DEV_BYPASS?: string;
}
