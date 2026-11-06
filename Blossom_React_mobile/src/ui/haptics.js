import * as Haptics from "expo-haptics";

// Small vibrations at the moments that matter. Never throws: a phone without
// a vibration motor (or with it switched off) just stays silent.
function safely(run) {
  try {
    run()?.catch?.(() => {});
  } catch {
    // no haptics on this device
  }
}

// A card swiped, a chip picked.
export function tap() {
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light));
}

// A like.
export function like() {
  safely(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium));
}

// It's a match!
export function celebrate() {
  safely(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success));
}
