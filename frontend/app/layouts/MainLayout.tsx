import { Outlet } from "react-router";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

const MainLayout  = () => {
  return ( 
  // one screen: the menu shrinks with the window height; it scrolls only when nothing else fits (tiny phones)
  <div className="h-dvh flex flex-col overflow-hidden">
    <Navbar />
    <main className="flex flex-1 min-h-0 flex-col overflow-y-auto">
      <Outlet />
    </main>
    <Footer />
  </div>
  );
}
 
export default MainLayout ;