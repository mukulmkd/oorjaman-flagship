import { Tabs, Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useRef } from "react";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { TabShellSkeleton, mobileTabBarStyle } from "@oorjaman/ui";
import { customerApi, queryKeys, userApi } from "@oorjaman/api";
import { colors } from "@oorjaman/config";
import { BookingRealtimeNotifications } from "../../components/booking-realtime-notifications";
import { TabNavTitle } from "../../components/tab-nav-title";
import { SupportChatHeaderButton } from "../../components/help-header-button";
import { MandatoryServiceAddressGate } from "../../components/mandatory-service-address-gate";
import { useCustomerPostLoginPrompts } from "../../components/customer-post-login-prompts";
import { fontFamily, fontSize } from "../../constants/fonts";
import { migrateLegacyVendorPreferencesToServer } from "../../lib/migrate-legacy-vendor-prefs";
import { supabase } from "../../lib/supabase";

export default function MainTabsLayout() {
  const qc = useQueryClient();
  const legacyMigrateRanForCustomerRef = useRef<string | null>(null);
  const insets = useSafeAreaInsets();
  const { releaseBackgroundPrompts } = useCustomerPostLoginPrompts();
  const userQ = useQuery({
    queryKey: queryKeys.users.me(),
    queryFn: () => userApi.getMyUserRecord(supabase!),
    enabled: Boolean(supabase),
  });

  const custQ = useQuery({
    queryKey: queryKeys.customers.mine(),
    queryFn: () => customerApi.getMyCustomer(supabase!),
    enabled: Boolean(supabase) && userQ.data?.role === "customer",
  });

  useEffect(() => {
    legacyMigrateRanForCustomerRef.current = null;
  }, [userQ.data?.id]);

  useEffect(() => {
    if (!supabase || userQ.data?.role !== "customer" || !custQ.data?.onboarding_completed_at) return;
    const cid = custQ.data.id;
    if (legacyMigrateRanForCustomerRef.current === cid) return;
    legacyMigrateRanForCustomerRef.current = cid;
    void migrateLegacyVendorPreferencesToServer(supabase, custQ.data).then((didWrite) => {
      if (didWrite) void qc.invalidateQueries({ queryKey: queryKeys.customers.mine() });
    });
  }, [supabase, qc, userQ.data?.role, custQ.data?.id, custQ.data?.onboarding_completed_at, custQ.data]);

  const showAddressGate =
    userQ.data?.role === "customer" &&
    Boolean(custQ.data?.onboarding_completed_at) &&
    custQ.data != null;

  useEffect(() => {
    if (!showAddressGate) releaseBackgroundPrompts();
  }, [showAddressGate, releaseBackgroundPrompts]);

  if (!supabase || userQ.isPending || (userQ.data?.role === "customer" && custQ.isPending)) {
    return <TabShellSkeleton tabSlots={5} />;
  }

  if (userQ.data?.role === "customer") {
    const cust = custQ.data;
    if (!cust?.onboarding_completed_at) {
      return <Redirect href="/customer-registration" />;
    }
  }

  const notifyCustomerId =
    userQ.data?.role === "customer" && custQ.data?.onboarding_completed_at ? custQ.data.id : undefined;

  return (
    <>
      <BookingRealtimeNotifications customerId={notifyCustomerId} />
      {showAddressGate && custQ.data ? (
        <MandatoryServiceAddressGate
          customer={custQ.data}
          onGateReleased={releaseBackgroundPrompts}
        />
      ) : null}
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
        tabBarStyle: mobileTabBarStyle(insets, {
          borderTopColor: colors.border,
          backgroundColor: colors.background,
        }),
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
        name="bookings"
        options={{
          title: "",
          headerShown: true,
          headerLeft: () => <TabNavTitle title="Bookings" />,
          headerRight: () => <SupportChatHeaderButton />,
          tabBarLabel: "Bookings",
          tabBarAccessibilityLabel: "My bookings tab",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="calendar-outline" size={size} color={color} />
          ),
        }}
      />
      <Tabs.Screen
        name="subscription"
        options={{
          title: "",
          headerShown: true,
          headerLeft: () => <TabNavTitle title="AMC" />,
          headerRight: () => <SupportChatHeaderButton />,
          tabBarLabel: "AMC",
          tabBarAccessibilityLabel: "AMC subscription tab",
          tabBarIcon: ({ color, size }) => (
            <Ionicons name="shield-checkmark-outline" size={size} color={color} />
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
          tabBarAccessibilityLabel: "Site activity tab",
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
    </>
  );
}
