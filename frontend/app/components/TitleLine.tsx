const TitleLine = ({ text }: { text: string }) => {
  return (
    <div className="flex items-center justify-center gap-4 mx-auto w-full max-w-100 px-4">
      <div className="side-lines flex-1 h-0.5 bg-neon"></div>
      <h3 className="font-pixel text-neon whitespace-nowrap">{text}</h3>
      <div className="side-lines flex-1 h-0.5 bg-neon"></div>
    </div>
  );
};

export default TitleLine;
