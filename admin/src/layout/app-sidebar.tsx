import {
  BikeIcon,
  ClipboardListIcon,
  ChevronsUpDownIcon,
  ImageIcon,
  LayoutGridIcon,
  PackageIcon,
  LayoutDashboardIcon,
  LogOutIcon,
  ReceiptTextIcon,
  SearchXIcon,
  SettingsIcon,
  UsersIcon,
  StoreIcon,
  UserCogIcon,
  UtensilsIcon,
} from "lucide-react";
import { NavLink } from "react-router";

import { Wordmark } from "@/components/wordmark";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";
import { useLogout } from "@/features/auth/use-auth";
import { useSession } from "@/features/auth/use-session";
import { cn } from "@/lib/utils";

const NAV = [
  { icon: LayoutDashboardIcon, label: "Overview", to: "/" },
  { icon: ReceiptTextIcon, label: "Orders", to: "/orders" },
  { icon: StoreIcon, label: "Stores", to: "/stores" },
  { icon: UserCogIcon, label: "Store owners", to: "/store-owners" },
  { icon: PackageIcon, label: "Product categories", to: "/product-categories" },
  { icon: UtensilsIcon, label: "Restaurants", to: "/restaurants" },
  { icon: LayoutGridIcon, label: "Categories", to: "/categories" },
  { icon: UsersIcon, label: "Customers", to: "/customers" },
  { icon: BikeIcon, label: "Riders", to: "/riders" },
  { icon: ClipboardListIcon, label: "Applications", to: "/applications" },
  { icon: SearchXIcon, label: "What people want", to: "/demand" },
  { icon: ImageIcon, label: "Banners", to: "/banners" },
  { icon: SettingsIcon, label: "Settings", to: "/settings" },
];

const initials = (name: string) =>
  name
    .split(" ")
    .map((part) => part[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

/** Count of orders still in flight, shown against Orders. */
export function AppSidebar({ liveOrders }: { liveOrders?: number }) {
  const { user } = useSession();
  const logout = useLogout();

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader className="p-4">
        <Wordmark className="text-primary" />
      </SidebarHeader>

      <SidebarContent>
        <SidebarGroup>
          <SidebarGroupLabel>Admin</SidebarGroupLabel>
          <SidebarMenu className="gap-0.5">
            {NAV.map(({ icon: Icon, label, to }) => (
              <SidebarMenuItem key={to}>
                <NavLink end={to === "/"} to={to}>
                  {({ isActive }) => (
                    <SidebarMenuButton isActive={isActive} tooltip={label}
                    className={cn(isActive && "bg-primary/5! text-primary! border-l-4 border-primary rounded-l-none!")}
                    >
                      <Icon />
                      <span>{label}</span>
                      {label === "Orders" && liveOrders ? (
                        <Badge className="bg-primary text-primary-foreground ml-auto border-transparent">
                          {liveOrders}
                        </Badge>
                      ) : null}
                    </SidebarMenuButton>
                  )}
                </NavLink>
              </SidebarMenuItem>
            ))}
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>

      <SidebarFooter>
        <SidebarMenu>
          <SidebarMenuItem>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <SidebarMenuButton className="h-auto py-2" size="lg">
                  <Avatar className="size-8">
                    <AvatarFallback className="text-xs">
                      {user ? initials(user.name) : "?"}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col text-left leading-tight">
                    <span className="text-sm font-medium">{user?.name}</span>
                    <span className="text-muted-foreground text-xs">Administrator</span>
                  </div>
                  <ChevronsUpDownIcon className="ml-auto" />
                </SidebarMenuButton>
              </DropdownMenuTrigger>

              <DropdownMenuContent align="end" className="w-56" side="top">
                <DropdownMenuLabel className="flex flex-col gap-0.5">
                  <span>{user?.name}</span>
                  <span className="text-muted-foreground text-xs font-normal">{user?.email}</span>
                </DropdownMenuLabel>

                <DropdownMenuSeparator />

                <DropdownMenuGroup>
                  <DropdownMenuItem onSelect={() => logout.mutate()}>
                    <LogOutIcon data-icon="inline-start" />
                    Sign out
                  </DropdownMenuItem>
                </DropdownMenuGroup>
              </DropdownMenuContent>
            </DropdownMenu>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
    </Sidebar>
  );
}
