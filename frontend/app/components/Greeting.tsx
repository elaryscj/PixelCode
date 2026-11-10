import { useTranslation } from "react-i18next";
import TitleLine from "./TitleLine";

const Greeting = () => {

  const { t } = useTranslation();

  return (  
    <div>
      <TitleLine text={t('welcome_mini')}/>
      <h1 className="font-pixel text-yellow text-[150px]/none text-center text-glow-sm">PIXELCODE</h1>
      <h3 className="font-pixel text-pink text-6xl mt-6 mb-8 text-center text-glow-sm">ARENA</h3>
    </div>
  );
}
 
export default Greeting;