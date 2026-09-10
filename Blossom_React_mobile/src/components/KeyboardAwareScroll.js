import { ScrollView } from "react-native";

/**
 * Scroll container for the auth/profile forms.
 *
 * Keyboard handling history, so this doesn't get "fixed" back into a bug:
 *
 *  1. windowSoftInputMode=adjustResize + KeyboardAvoidingView behavior="height"
 *     -> two things resized for the keyboard at once and fought each other,
 *        which made the layout visibly shake on some devices.
 *  2. adjustResize alone -> no more shaking, but nothing scrolled the focused
 *     field into view, so the keyboard covered the lower inputs.
 *  3. adjustResize + auto scrollToEnd -> still covered the field, because when
 *     the form already fits the resized window there is nothing to scroll.
 *
 * Now: windowSoftInputMode=adjustPan (set in app.json as
 * softwareKeyboardLayoutMode: "pan"). Android itself pans the window so the
 * focused input stays above the keyboard - it doesn't depend on the content
 * being scrollable, and since nothing resizes, it can't oscillate.
 *
 * So this is deliberately a plain ScrollView: the OS is the single mechanism.
 */
export default function KeyboardAwareScroll({ children, extraOffset, ...props }) {
  return (
    <ScrollView
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      {...props}
    >
      {children}
    </ScrollView>
  );
}
