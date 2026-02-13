"use client";
import { useSession } from "@/lib/auth-client";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
  Menu,
  MenuCheckboxItem,
  MenuGroup,
  MenuGroupLabel,
  MenuItem,
  MenuPopup,
  MenuRadioGroup,
  MenuRadioItem,
  MenuSeparator,
  MenuSub,
  MenuSubPopup,
  MenuSubTrigger,
  MenuTrigger,
} from "@hushletter/ui/components";
type Props = {};

export const UserMenu = ({}: Props) => {
  return (
    <Menu>
      <MenuTrigger>
        <Avatar>
          <AvatarImage src="/avatars/01.png" alt="User avatar" />
          <AvatarFallback>JD</AvatarFallback>
        </Avatar>
      </MenuTrigger>
      <MenuPopup align="start" sideOffset={4}>
        <MenuItem>Profile</MenuItem>
        <MenuSeparator />

        <MenuGroup>
          <MenuGroupLabel>Playback</MenuGroupLabel>
          <MenuItem>Play</MenuItem>
          <MenuItem>Pause</MenuItem>
        </MenuGroup>

        <MenuSeparator />

        <MenuCheckboxItem>Shuffle</MenuCheckboxItem>
        <MenuCheckboxItem>Repeat</MenuCheckboxItem>
        <MenuCheckboxItem variant="switch">Auto save</MenuCheckboxItem>

        <MenuSeparator />

        <MenuGroup>
          <MenuGroupLabel>Sort by</MenuGroupLabel>
          <MenuRadioGroup>
            <MenuRadioItem value="artist">Artist</MenuRadioItem>
            <MenuRadioItem value="album">Album</MenuRadioItem>
            <MenuRadioItem value="title">Title</MenuRadioItem>
          </MenuRadioGroup>
        </MenuGroup>

        <MenuSeparator />

        <MenuSub>
          <MenuSubTrigger>Add to playlist</MenuSubTrigger>
          <MenuSubPopup>
            <MenuItem>Jazz</MenuItem>
            <MenuItem>Rock</MenuItem>
          </MenuSubPopup>
        </MenuSub>
      </MenuPopup>
    </Menu>
  );
};
