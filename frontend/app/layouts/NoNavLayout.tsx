import { Outlet } from "react-router";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";
import NavbarPrev from "../components/NavbarPrev";

const NoNavLayout  = () => {
  return ( 
  <>
    <div className="grid-background" />
    <NavbarPrev />
    <main className="flex flex-1 flex-col justify-center">
      <Outlet />
    </main>
    {/* <Footer /> */}
  </>
  );
}
 
export default NoNavLayout ;