import { Avatar, AvatarFallback, AvatarImage } from "@strand/ui/avatar";
import BoringAvatar from "boring-avatars";

interface UserAvatarProps {
  className?: string;
  image?: string;
  name: string;
  size?: number;
}

export function UserAvatar({
  className,
  image,
  name,
  size = 32,
}: UserAvatarProps) {
  return (
    <Avatar className={className}>
      {image && <AvatarImage alt={name} src={image} />}
      <AvatarFallback>
        <BoringAvatar name={name} size={size} variant="marble" />
      </AvatarFallback>
    </Avatar>
  );
}
