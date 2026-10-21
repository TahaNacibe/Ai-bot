import usePreferences from "@/context/preferences.store";
import { useSession } from "@/context/session.store";
import { useLocation } from "react-router-dom";

export function useTabUtils() {
  const { activeTabs } = usePreferences();
  const { allowedTabs, isAdmin, isLocalSession } = useSession();
  const { pathname, search } = useLocation();

  const current = pathname + search;

  const isActive = (url: string) =>
    current === url || current.startsWith(url.split("?")[0]);

  const isSubActive = (url: string) => current === url;

  const isSubBlocked = (item: any) => {
    if (item.isOnlineExclusive && isLocalSession) return true;
    if (!activeTabs[item.id]) return true;
    if (!isAdmin && allowedTabs?.length && !allowedTabs.includes(item.id))
      return true;
    return false;
  };

  const isCategoryEmpty = (items: any[]) =>
    !items.some((i) => !isSubBlocked(i));

  const getTabSubsIds = (item: any) => item.items;

  return { isCategoryEmpty, isSubBlocked, getTabSubsIds, isActive, isSubActive };
}