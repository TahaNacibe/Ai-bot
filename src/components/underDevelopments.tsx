import { Construction } from "lucide-react";

export default function UnderDevelopment() {
  return (
    <div className="flex items-center justify-center h-full min-h-[60vh]">
      <div className="flex flex-col items-center text-center gap-3 max-w-sm">
        <div className="flex items-center justify-center size-12 rounded-xl bg-muted">
          <Construction className="size-6 text-muted-foreground" />
        </div>

        <h1 className="text-lg font-semibold">Under Development</h1>

        <p className="text-sm text-muted-foreground">
          This section is currently being developed and will be available in a
          future update.
        </p>
      </div>
    </div>
  );
}