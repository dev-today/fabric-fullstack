import { Route, Routes as ReactRoutes } from "react-router-dom";
import DashbaordLayout from "./components/DashbaordLayout";
import CarList from "./pages/CarList";
import Index from "./pages/index";
import NotFound from "./pages/NotFound";

export default function Routes() {
  return (
    <ReactRoutes>
      <Route path="/" element={<DashbaordLayout />}>
        <Route index element={<CarList />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </ReactRoutes>
  );
}
