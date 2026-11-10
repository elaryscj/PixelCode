import { useState } from "react";
import { FaUser } from "react-icons/fa";
import { useAvatar } from "~/lib/avatar";

/**
 * A player's avatar. Without props it shows the logged-in player's own picture;
 * with `userId` it loads that player's picture from the server (falls back to the user icon).
 */
const Avatar = ({
  className = "w-12 h-12",
  iconClass = "text-2xl text-pink",
  src,
  userId,
}: {
  className?: string;
  iconClass?: string;
  src?: string | null;
  userId?: number | null;
}) => {
  const own = useAvatar();
  const [failed, setFailed] = useState(false);
  const url = src !== undefined ? src : userId != null ? (failed ? null : `/api/avatars/${userId}`) : own;
  return url ? (
    <img
      src={url}
      alt=""
      className={`${className} object-cover`}
      draggable={false}
      onError={() => setFailed(true)}
    />
  ) : (
    <span className={`${className} flex items-center justify-center`}>
      <FaUser className={iconClass} />
    </span>
  );
};

export default Avatar;
