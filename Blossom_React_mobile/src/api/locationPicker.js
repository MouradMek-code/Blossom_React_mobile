// Hands the choice made on LocationPickerScreen back to whoever opened it.
// Navigation params must stay serializable, so the callback can't travel with
// them; the opener parks it here instead. Only one picker is open at a time.
let pendingPick = null;

export function openLocationPicker(navigation, params, onPick) {
  pendingPick = onPick;
  navigation.navigate("LocationPicker", params);
}

export function deliverLocationPick(value) {
  const onPick = pendingPick;
  pendingPick = null;
  if (onPick) onPick(value);
}
