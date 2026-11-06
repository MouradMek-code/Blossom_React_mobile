import { useEffect, useRef } from "react";
import { Animated, Image, Modal, Pressable, Text, View, StyleSheet } from "react-native";
import { useTranslation } from "react-i18next";
import { IMG } from "../api/images";
import { Button, haptics } from "../ui";
import { colors, radius, spacing, shadow, typography } from "../theme";

// "It's a match!": both photos fly in and meet under a heart, the phone gives
// a happy buzz, and the next step is right there - say hello, or keep going.
export default function MatchCelebration({ me, them, onMessage, onClose }) {
  const { t } = useTranslation();
  const appear = useRef(new Animated.Value(0)).current;
  const heart = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    haptics.celebrate();
    Animated.parallel([
      Animated.spring(appear, { toValue: 1, friction: 7, tension: 60, useNativeDriver: true }),
      Animated.sequence([
        Animated.delay(250),
        Animated.spring(heart, { toValue: 1, friction: 4, tension: 120, useNativeDriver: true }),
      ]),
    ]).start();
  }, [appear, heart]);

  const slide = (from) =>
    appear.interpolate({ inputRange: [0, 1], outputRange: [from, 0] });

  return (
    <Modal transparent animationType="fade" onRequestClose={onClose}>
      <Pressable style={styles.backdrop} onPress={onClose} accessibilityLabel={t("likesYou.matchTitle")}>
        <Animated.View style={[styles.card, { opacity: appear, transform: [{ scale: appear.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] }) }] }]}>
          <Text style={styles.title}>{t("likesYou.matchTitle")}</Text>
          <Text style={styles.text}>{t("likesYou.matchText")}</Text>

          <View style={styles.photos}>
            <Animated.View style={[styles.photoWrap, styles.photoLeft, { transform: [{ translateX: slide(-80) }, { rotate: "-8deg" }] }]}>
              {me?.photos?.[0]?.image_url ? (
                <Image source={{ uri: IMG.thumb(me.photos[0].image_url) }} style={styles.photo} />
              ) : (
                <View style={[styles.photo, styles.noPhoto]} />
              )}
            </Animated.View>
            <Animated.View style={[styles.photoWrap, styles.photoRight, { transform: [{ translateX: slide(80) }, { rotate: "8deg" }] }]}>
              <Image source={{ uri: IMG.thumb(them.photos?.[0]?.image_url) }} style={styles.photo} />
            </Animated.View>
            <Animated.Text style={[styles.heart, { transform: [{ scale: heart }] }]}>💞</Animated.Text>
          </View>

          <Text style={styles.name}>{them.first_name}</Text>
          <View style={styles.actions}>
            <Button title={t("likesYou.matchMessage")} icon="message-circle" onPress={onMessage} full />
            <Button title={t("likesYou.matchKeepGoing")} variant="ghost" onPress={onClose} full />
          </View>
        </Animated.View>
      </Pressable>
    </Modal>
  );
}

const PHOTO = 112;

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(42,20,28,0.72)",
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.lg,
  },
  card: {
    width: "100%",
    maxWidth: 380,
    alignItems: "center",
    paddingVertical: spacing.xl,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.xl,
    backgroundColor: colors.surface,
    ...shadow.lg,
  },
  title: { ...typography.h1, color: colors.primary, textAlign: "center" },
  text: { fontSize: 15, color: colors.textSoft, textAlign: "center", marginTop: 4 },
  photos: { height: PHOTO + 40, width: PHOTO * 2 + 10, marginVertical: spacing.lg, alignItems: "center", justifyContent: "center" },
  photoWrap: {
    position: "absolute",
    top: 10,
    width: PHOTO,
    height: PHOTO,
    borderRadius: PHOTO / 2,
    borderWidth: 4,
    borderColor: "#fff",
    overflow: "hidden",
    backgroundColor: colors.primarySoft,
    ...shadow.md,
  },
  photoLeft: { left: 0 },
  photoRight: { right: 0 },
  photo: { width: "100%", height: "100%" },
  noPhoto: { backgroundColor: colors.primarySoft },
  heart: { position: "absolute", bottom: 0, fontSize: 44 },
  name: { ...typography.h2, textAlign: "center" },
  actions: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.lg },
});
