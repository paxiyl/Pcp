import { BellIcon, SearchIcon } from "lucide-react";
import { Outlet, useLocation } from "react-router";
import { toast } from "sonner";

import { AppSidebar } from "@/layout/app-sidebar";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";
import { Button } from "@/components/ui/button";
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group";
import { Separator } from "@/components/ui/separator";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { useOverview } from "@/features/analytics/use-overview";

const TITLES: Record<string, string> = {
  "/": "Overview",
  "/banners": "Banners",
  "/categories": "Categories",
  "/customers": "Customers",
  "/orders": "Orders",
  "/restaurants": "Restaurants",
  "/riders": "Riders",
  "/settings": "Settings",
};

/** The signed-in shell: sidebar, breadcrumb bar, and the routed page. */
export function AppLayout() {
  const location = useLocation();
  // Shared with the dashboard, so the badge costs no extra request.
  const { data } = useOverview(7);

  // A nested route like /orders/:id has no exact entry, so fall back to its
  // section rather than showing "Admin" twice in the breadcrumb.
  const section = `/${location.pathname.split("/")[1] ?? ""}`;
  const title = TITLES[location.pathname] ?? TITLES[section] ?? "Admin";

  return (
    <SidebarProvider>
      <AppSidebar liveOrders={data?.liveOrders} />

      <SidebarInset>
        <header className="bg-background sticky top-0 z-10 flex h-16 shrink-0 items-center gap-3 border-b px-4">
          <SidebarTrigger className="-ml-1" />
          <Separator className="mr-1 h-4" orientation="vertical" />

          <Breadcrumb>
            <BreadcrumbList>
              <BreadcrumbItem className="text-muted-foreground">Admin</BreadcrumbItem>
              <BreadcrumbSeparator />
              <BreadcrumbItem>
                <BreadcrumbPage>{title}</BreadcrumbPage>
              </BreadcrumbItem>
            </BreadcrumbList>
          </Breadcrumb>

          <div className="flex-1" />

          <InputGroup className="hidden w-72 md:flex">
            <InputGroupAddon>
              <SearchIcon />
            </InputGroupAddon>
            <InputGroupInput
              onKeyDown={(event) => {
                if (event.key !== "Enter") return;

                toast("Global search is not wired up yet", {
                  description: "The API has no admin-wide search endpoint.",
                });
              }}
              placeholder="Search orders, restaurants or customers"
            />
          </InputGroup>

          <Button
            aria-label="Notifications"
            onClick={() =>
              toast("No notifications yet", {
                description: "There is no notifications feature in the API.",
              })
            }
            size="icon"
            variant="ghost"
          >
            <BellIcon />
          </Button>
        </header>

        <main className="flex-1 p-6">
          <div className="mx-auto w-full max-w-[1400px]">
            <Outlet />
          </div>
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
