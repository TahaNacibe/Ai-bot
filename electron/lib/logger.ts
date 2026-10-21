import fs from "fs";
import path from "path";

const logFile = path.join(process.cwd(), "app.log");
const errorFile = path.join(process.cwd(), "error.log");

export default function logger({
  details,
  logLevel,
}: {
  details: string;
  logLevel: "info" | "error";
}) {
  const logLine = `[${new Date().toISOString()}] [${logLevel.toUpperCase()}] ${details}\n`;
  if (logLevel === "info") fs.appendFileSync(logFile, logLine);
  else fs.appendFileSync(errorFile, logLine);
}
