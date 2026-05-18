import { useLayoutEffect, useMemo } from "react";
import { useNavigation } from "@react-navigation/native";
import { ModalStackHeaderBar, type ModalStackHeaderBarProps } from "./ModalStackHeaderBar";

export type UseModalStackHeaderConfig = ModalStackHeaderBarProps;

/**
 * Hides the native stack header and returns an in-screen bar (title, optional subtitle, close).
 * Render `{modalHeader}` as the first child inside `Screen`.
 */
export function useModalStackHeader(config: UseModalStackHeaderConfig) {
  const navigation = useNavigation();
  const {
    title,
    subtitle,
    onClose,
    onBack,
    closeAccessibilityLabel,
    showClose,
    trailing,
    subtitleNumberOfLines,
  } = config;

  useLayoutEffect(() => {
    navigation.setOptions({
      headerShown: false,
    });
  }, [navigation]);

  return useMemo(
    () => (
      <ModalStackHeaderBar
        title={title}
        subtitle={subtitle}
        onClose={onClose}
        onBack={onBack}
        closeAccessibilityLabel={closeAccessibilityLabel}
        showClose={showClose}
        trailing={trailing}
        subtitleNumberOfLines={subtitleNumberOfLines}
      />
    ),
    [
      title,
      subtitle,
      onClose,
      onBack,
      closeAccessibilityLabel,
      showClose,
      trailing,
      subtitleNumberOfLines,
    ],
  );
}
