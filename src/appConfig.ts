export function getAppVersion(): string {
  try {
    return window.appAPI.getVersion();
  } catch {
    return import.meta.env.VITE_APP_VERSION ?? "0.0.0";
  }
}

export const APP_REGISTRY = {
  company: {
    company_name: "Protocol Luna Inc.",
  },

  app: {
    get version() { return getAppVersion(); }, 
    build_date: new Date().toLocaleDateString("en-GB", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }),
    license_type: "Proprietary",
    build_type: import.meta.env.VITE_BUILD_TYPE ?? import.meta.env.MODE,
  },

  info: {
    term_of_use_link: "https://www.protocol-luna.com/terms",
    privacy_policy_link: "https://www.protocol-luna.com/privacy",
  },

  contact: {
    support_link: "https://www.protocol-luna.com/support",
    email: "support@protocol-luna.com",
    main_page: "https://www.protocol-luna.com",
    phone: "+213 123 4567",
  },

  data: {
    local_files_path: import.meta.env.VITE_LOCAL_FILES_PATH ?? "/data/local_files",
    database_url: import.meta.env.VITE_DATABASE_URL ?? undefined,
  },
};