import { Outlet } from "react-router";
import Footer from "../components/Footer";
import Navbar from "../components/Navbar";

const MainLayout  = () => {
  return ( 
  <>
    <Navbar />
    <main className="flex flex-1 flex-col justify-center">
      <Outlet />
    </main>
    <Footer />
  </>
  );
}
 
export default MainLayout ;