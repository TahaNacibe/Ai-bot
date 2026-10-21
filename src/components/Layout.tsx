import CustomTitleBar from "./controller";

export default function Layout({ children }: { children: React.ReactNode }) {
  return <CustomTitleBar>{children}</CustomTitleBar>;
}
