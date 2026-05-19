import { StyleSheet, Text, View } from "react-native";
import { modalKickerTitleStyle } from "@oorjaman/ui";

type Props = {
  title: string;
};

/** Screen title aligned with the support chat icon in the nav bar. */
export function TabNavTitle({ title }: Props) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.title} numberOfLines={1}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    justifyContent: "center",
    paddingLeft: 4,
  },
  title: {
    ...modalKickerTitleStyle,
  },
});
