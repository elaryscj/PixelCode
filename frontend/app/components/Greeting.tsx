import { useTranslation } from "react-i18next";
import TitleLine from "./TitleLine";

const Greeting = () => {
  const { t } = useTranslation();

  return (
    <div className="enter-up">
      <TitleLine text={t("welcome_mini")} />
      <h1 className="font-pixel text-yellow text-center text-glow title-flicker text-[18vw]/none sm:text-[100px]/none lg:text-[150px]/none">
        PIXELCODE
      </h1>
      <h3 className="font-pixel text-pink text-4xl sm:text-5xl lg:text-6xl mt-4 sm:mt-6 mb-2 text-center text-glow-sm float-slow">
        ARENA
      </h3>
      <p className="font-pixel text-neon/80 text-center text-base sm:text-xl">
        CODE FASTER. RUN HARDER. WIN<span className="blink-caret">_</span>
      </p>
    </div>
  );
};

export default Greeting;
