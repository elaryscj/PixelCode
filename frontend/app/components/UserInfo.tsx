import Avatar from "./Avatar";
import { Link } from "react-router";
import { useNickname } from "~/lib/nickname";
import { getCurrentUser } from "~/api/auth";

const UserInfo = () => {
  const nickname = useNickname();
  const currentUser = getCurrentUser();
  const displayName = nickname ?? currentUser?.username ?? "Guest";
  const displayRating = currentUser?.rating ? `MMR ${currentUser.rating}` : "MMR 1500";
  const targetRoute = currentUser ? "/profile" : "/login";

  return (
    <Link 
      to={targetRoute} 
      className="flex items-center gap-2 hover:opacity-85 transition-opacity cursor-pointer group"
      title={currentUser ? "Go to User Profile & Settings" : "Click to Log in / Register"}
    >
      <div className="flex flex-col items-center justify-center">
        <h2 className="text-yellow font-pixel text-xl my-0 py-0 group-hover:text-glow-sm">{displayName}</h2>
        <p className="text-pink font-pixel text-xl">{displayRating}</p>
      </div>
      <div className="p-1 border border-pink group-hover:border-glow-pink">
        <Avatar className="w-10 h-10" />
      </div>
    </Link>
  );
};

export default UserInfo;