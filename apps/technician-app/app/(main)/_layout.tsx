import { useCallback, useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Tabs, Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { technicianApi, queryKeys } from "@oorjaman/api";
import { TabShellSkeleton, mobileTabBarStyle } from "@oorjaman/ui";
import { colors } from "@oorjaman/config";
import { fontFamily, fontSize } from "../../constants/fonts";
import { supabase } from "../../lib/supabase";
import { TechnicianLocationTracker } from "../../components/technician-location-tracker";
import { MandatoryLocationGate } from "../../components/mandatory-location-gate";
import { TechnicianBookingRealtime } from "../../components/technician-booking-realtime";
import { TechnicianApprovalToast } from "../../components/technician-approval-toast";
import { consumeTechnicianApprovalToastPending } from "../../lib/technician-approval-toast";
import { SupportChatHeaderButton } from "../../components/help-header-button";
import { TabNavTitle } from "../../components/tab-nav-title";
import { WebAppShellSidebar, type WebShellNavItem } from "../../components/web-app-shell";
import { useLayoutMode } from "../../lib/use-layout-mode";

const TECHNICIAN_SHELL_NAV: WebShellNavItem[] = [
  { href: "/(main)", label: "Home", icon: "home-outline", match: "/" },
  { href: "/(main)/jobs", label: "Jobs", icon: "calendar-outline", match: "/jobs" },
  { href: "/(main)/feedback", label: "Feedback", icon: "star-outline", match: "/feedback" },
  { href: "/(main)/activity", label: "Activity", icon: "pulse-outline", match: "/activity" },
  { href: "/(main)/profile", label: "Profile", icon: "person-outline", match: "/profile" },
];

export default function MainTabsLayout() {
  const insets = useSafeAreaInsets();
  const layoutMode = useLayoutMode();
  const isDesktopShell = layoutMode === "desktop";
  const [showApprovalToast, setShowApprovalToast] = useState(false);
  const q = useQuery({
    queryKey: queryKeys.technicians.me(),
    queryFn: () => technicianApi.getMyTechnicianProfile(supabase!),
    enabled: Boolean(supabase),
  });

  const tech = q.data;
  const isOnboarded = technicianApi.technicianIsFullyOnboarded(tech);
  const dismissApprovalToast = useCallback(() => setShowApprovalToast(false), []);

  useEffect(() => {
    if (!isOnboarded) return;
    if (consumeTechnicianApprovalToastPending()) {
      setShowApprovalToast(true);
    }
  }, [isOnboarded]);

  if (!supabase || q.isPending) {
    return <TabShellSkeleton tabSlots={5} />;
  }

  if (!isOnboarded) {
    if (technicianApi.technicianShowsPendingReviewScreen(tech)) {
      return <Redirect href="/pending-vendor-review" />;
    }
    return <Redirect href="/technician-onboarding" />;
  }

  return (
    <MandatoryLocationGate>
      <TechnicianApprovalToast visible={showApprovalToast} onDismiss={dismissApprovalToast} />
      <TechnicianLocationTracker />
      <TechnicianBookingRealtime technicianId={tech?.id} />
      <View style={[styles.root, isDesktopShell && styles.rootDesktop]}>
        {isDesktopShell ? <WebAppShellSidebar items={TECHNICIAN_SHELL_NAV} /> : null}
        <View style={[styles.main, isDesktopShell && styles.mainDesktop]}>
          <Tabs
            screenOptions={{
              headerShown: true,
              headerTitle: "",
              headerShadowVisible: false,
              headerTitleStyle: {
                fontFamily: fontFamily.medium,
                fontSize: fontSize.sm,
                color: colors.primary,
              },
              headerStyle: {
                backgroundColor: colors.background,
              },
              headerRightContainerStyle: {
                paddingRight: isDesktopShell ? 24 : 8,
              },
              headerLeftContainerStyle: {
                paddingLeft: isDesktopShell ? 24 : 8,
                flexGrow: 1,
                flexShrink: 1,
              },
              headerTintColor: colors.foreground,
              tabBarActiveTintColor: colors.primary,
              tabBarInactiveTintColor: colors.mutedForeground,
              tabBarLabelStyle: {
                fontFamily: fontFamily.medium,
                fontSize: fontSize.xs,
              },
              tabBarStyle: isDesktopShell
                ? styles.tabBarHidden
                : mobileTabBarStyle(insets, {
                    borderTopColor: colors.border,
                    backgroundColor: colors.background,
                  }),
              sceneStyle: isDesktopShell
                ? { backgroundColor: colors.background }
                : undefined,
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                headerShown: true,
                headerTitle: "",
                headerShadowVisible: false,
                title: "",
                tabBarLabel: "Home",
                tabBarAccessibilityLabel: "Home tab",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="home-outline" size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="jobs"
              options={{
                title: "",
                headerShown: true,
                headerLeft: () => <TabNavTitle title="Jobs" />,
                headerRight: () => <SupportChatHeaderButton />,
                tabBarLabel: "Jobs",
                tabBarAccessibilityLabel: "Assigned jobs tab",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="calendar-outline" size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="feedback"
              options={{
                title: "",
                headerShown: true,
                headerLeft: () => <TabNavTitle title="Feedback" />,
                headerRight: () => <SupportChatHeaderButton />,
                tabBarLabel: "Feedback",
                tabBarAccessibilityLabel: "Customer feedback and ratings tab",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="star-outline" size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="activity"
              options={{
                title: "",
                headerShown: true,
                headerLeft: () => <TabNavTitle title="Activity" />,
                headerRight: () => <SupportChatHeaderButton />,
                tabBarLabel: "Activity",
                tabBarAccessibilityLabel: "Job activity timeline tab",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="pulse-outline" size={size} color={color} />
                ),
              }}
            />
            <Tabs.Screen
              name="profile"
              options={{
                title: "",
                headerShown: true,
                headerLeft: () => <TabNavTitle title="Profile" />,
                headerRight: () => <SupportChatHeaderButton />,
                tabBarLabel: "Profile",
                tabBarAccessibilityLabel: "Profile tab",
                tabBarIcon: ({ color, size }) => (
                  <Ionicons name="person-outline" size={size} color={color} />
                ),
              }}
            />
          </Tabs>
        </View>
      </View>
    </MandatoryLocationGate>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
  rootDesktop: {
    flexDirection: "row",
  },
  main: {
    flex: 1,
    minWidth: 0,
    backgroundColor: colors.background,
  },
  mainDesktop: {
    paddingHorizontal: 0,
  },
  tabBarHidden: {
    display: "none",
    height: 0,
    overflow: "hidden",
  },
});
