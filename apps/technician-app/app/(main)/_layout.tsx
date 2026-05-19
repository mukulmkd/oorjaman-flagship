import { Tabs, Redirect } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { technicianApi, queryKeys } from "@oorjaman/api";
import { TabShellSkeleton } from "@oorjaman/ui";
import { colors } from "@oorjaman/config";
import { fontFamily, fontSize } from "../../constants/fonts";
import { supabase } from "../../lib/supabase";
import { TechnicianLocationTracker } from "../../components/technician-location-tracker";
import { TechnicianBookingRealtime } from "../../components/technician-booking-realtime";
import { SupportChatHeaderButton } from "../../components/help-header-button";
import { TabNavTitle } from "../../components/tab-nav-title";

export default function MainTabsLayout() {
  const insets = useSafeAreaInsets();
  const q = useQuery({
    queryKey: queryKeys.technicians.me(),
    queryFn: () => technicianApi.getMyTechnicianProfile(supabase!),
    enabled: Boolean(supabase),
  });

  if (!supabase || q.isPending) {
    return <TabShellSkeleton tabSlots={5} />;
  }

  const tech = q.data;
  if (!technicianApi.technicianIsFullyOnboarded(tech)) {
    if (technicianApi.technicianShowsPendingReviewScreen(tech)) {
      return <Redirect href="/pending-vendor-review" />;
    }
    return <Redirect href="/technician-onboarding" />;
  }

  return (
    <>
      <TechnicianLocationTracker />
      <TechnicianBookingRealtime technicianId={tech?.id} />
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
          headerRightContainerStyle: { paddingRight: 8 },
          headerLeftContainerStyle: { paddingLeft: 8, flexGrow: 1, flexShrink: 1 },
          headerTintColor: colors.foreground,
          tabBarActiveTintColor: colors.primary,
          tabBarInactiveTintColor: colors.mutedForeground,
          tabBarLabelStyle: {
            fontFamily: fontFamily.medium,
            fontSize: fontSize.xs,
          },
          tabBarStyle: {
            borderTopColor: colors.border,
            backgroundColor: colors.background,
            paddingTop: 4,
            paddingBottom: Math.max(insets.bottom, 6),
          },
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
            tabBarIcon: ({ color, size }) => <Ionicons name="home-outline" size={size} color={color} />,
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
            tabBarIcon: ({ color, size }) => <Ionicons name="calendar-outline" size={size} color={color} />,
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
            tabBarIcon: ({ color, size }) => <Ionicons name="star-outline" size={size} color={color} />,
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
            tabBarIcon: ({ color, size }) => <Ionicons name="pulse-outline" size={size} color={color} />,
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
            tabBarIcon: ({ color, size }) => <Ionicons name="person-outline" size={size} color={color} />,
          }}
        />
      </Tabs>
    </>
  );
}
