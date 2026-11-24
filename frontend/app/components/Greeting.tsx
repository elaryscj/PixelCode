import { useTranslation } from "react-i18next";
import TitleLine from "./TitleLine";

const Greeting = () => {
  const { t } = useTranslation();

  return (
    <div className="enter-up">
      <div className="short:hidden">
        <TitleLine text={t("welcome_mini")} />
      </div>
      <h1 className="font-pixel text-yellow text-center text-glow title-flicker text-[clamp(34px,min(15vw,12vh),150px)]/none">
        PIXELCODE
      </h1>
      <h3 className="font-pixel text-pink text-[clamp(18px,min(6vw,5.5vh),60px)] mt-[min(1.5rem,1.8vh)] mb-[min(0.5rem,0.8vh)] text-center text-glow-sm float-slow">
        ARENA
      </h3>
      <p className="short:hidden font-pixel text-neon/80 text-center text-[clamp(12px,2.2vh,20px)]">
        {t("tagline")}<span className="blink-caret">_</span>
      </p>
    </div>
  );
};

export default Greeting;
