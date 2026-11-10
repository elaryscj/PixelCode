
import Greeting from "./Greeting";
import HeroNavigation from "./HeroNavigation";

const Hero = () => {
  return (  
  <div className="flex flex-col gap-12 lg:block sm:hidden">
    <Greeting />
    <HeroNavigation />
  </div>
  );
}
 
export default Hero;