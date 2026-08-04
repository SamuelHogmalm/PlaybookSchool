import { ImportProvider } from "./ImportContext";

export default function ImportLayout({ children }) {
  return <ImportProvider>{children}</ImportProvider>;
}
