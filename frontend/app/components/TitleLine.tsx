const TitleLine = ({ text }: {text: string}) => {
  return (  
    <div className="flex items-center justify-center gap-4 mx-auto max-w-100 w-100">
      <div className="side-lines w-full flex-1 h-0.5 bg-neon"></div>
      <h3 className="font-pixel text-neon">{text}</h3>
      <div className="side-lines w-full h-0.5 flex-1 bg-neon"></div>
    </div>
  );
}
 
export default TitleLine;