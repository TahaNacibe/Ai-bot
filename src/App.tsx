import { Routes, Route } from "react-router-dom";
import MainPage from "./app/page";
import PageNotFound from "./404";

function App() {
  return (
    <Routes>
      <Route path="/" element={<MainPage />} />

      {/* =========== 404 ============== */}
      <Route path="*" element={<PageNotFound />} />
    </Routes>
  );
}

export default App;
