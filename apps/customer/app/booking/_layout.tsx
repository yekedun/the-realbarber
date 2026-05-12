import { Stack } from "expo-router";
import { T } from "../../lib/theme";

export default function BookingLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: T.bg },
        animation: "slide_from_right",
        freezeOnBlur: false,
      }}
    />
  );
}
