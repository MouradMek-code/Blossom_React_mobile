import { StackActions } from "@react-navigation/native";

// Opens one of the bottom tabs from anywhere.
//
// The tabs live inside the "Main" screen of the root stack, so a screen on top
// of them (a chat, someone's profile, settings) can't just navigate to the tab
// by name - that would stack a second copy of the whole tab bar on top. popTo
// goes back down to the tabs that are already there and switches to the right
// one; called from a tab itself it simply switches tab.
export function goToTab(navigation, screen, params) {
  navigation.dispatch(StackActions.popTo("Main", { screen, params }));
}
