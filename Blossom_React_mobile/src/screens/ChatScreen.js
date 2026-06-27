import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  TextInput,
  Pressable,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
} from "react-native";
import { useRoute } from "@react-navigation/native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import PageNav from "../components/PageNav";
import { BASE_URL } from "../api/config";
import { getToken, getProfileId } from "../api/storage";
import { colors, radius, spacing, shadow, typography } from "../theme";

export default function ChatScreen() {
  const route = useRoute();
  const { conversationId } = route.params;

  const [messages, setMessages] = useState([]);
  const [text, setText] = useState("");
  const [profileId, setProfileIdState] = useState(null);
  const [error, setError] = useState("");
  const listRef = useRef(null);
  const insets = useSafeAreaInsets();

  async function loadMessages() {
    const token = await getToken();
    const resp = await fetch(`${BASE_URL}/messages/conversation/${conversationId}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    const data = await resp.json();
    setMessages(data);
  }

  useEffect(() => {
    getProfileId().then(setProfileIdState);
    loadMessages();
    const interval = setInterval(loadMessages, 3000);
    return () => clearInterval(interval);
  }, [conversationId]);

  useEffect(() => {
    listRef.current?.scrollToEnd({ animated: true });
  }, [messages]);

  async function sendMessage() {
    if (!text.trim()) return;
    setError("");
    const token = await getToken();
    const resp = await fetch(`${BASE_URL}/messages/conversation/${conversationId}`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ content: text }),
    });
    const data = await resp.json();

    if (!resp.ok) {
      setError(data.detail || "Failed to send message");
      return;
    }

    setMessages((prev) => [...prev, data]);
    setText("");
  }

  return (
    <KeyboardAvoidingView
      style={styles.chatContainer}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <PageNav />
      <Text style={styles.header}>💬 Conversation</Text>

      <FlatList
        ref={listRef}
        data={messages}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={styles.messagesContainer}
        renderItem={({ item: message }) => {
          const isMine = Number(message.sender_profile_id) === Number(profileId);
          return (
            <View style={[styles.row, isMine ? styles.right : styles.left]}>
              <View style={[styles.bubble, isMine ? styles.mine : styles.theirs]}>
                <Text style={isMine ? styles.mineText : styles.theirsText}>{message.content}</Text>
              </View>
            </View>
          );
        }}
      />

      {error !== "" && <Text style={styles.errorText}>{error}</Text>}

      <View style={[styles.inputBox, { paddingBottom: Math.max(insets.bottom, 12) + 8 }]}>
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Type message..."
          style={styles.input}
        />
        <Pressable onPress={sendMessage} style={styles.button}>
          <Text style={styles.buttonText}>Send</Text>
        </Pressable>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  chatContainer: { flex: 1, backgroundColor: colors.background },
  header: {
    ...typography.h3,
    textAlign: "center",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  messagesContainer: { padding: spacing.md },
  errorText: {
    color: colors.danger,
    textAlign: "center",
    paddingHorizontal: spacing.md,
    paddingBottom: spacing.sm,
  },
  row: { flexDirection: "row", marginBottom: spacing.sm },
  left: { justifyContent: "flex-start" },
  right: { justifyContent: "flex-end" },
  bubble: {
    maxWidth: "75%",
    borderRadius: radius.md,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    ...shadow.sm,
  },
  mine: { backgroundColor: colors.primary, marginLeft: "auto", borderBottomRightRadius: 4 },
  theirs: { backgroundColor: colors.surfaceMuted, borderBottomLeftRadius: 4 },
  mineText: { color: "#fff", fontSize: 15 },
  theirsText: { color: colors.text, fontSize: 15 },
  inputBox: {
    flexDirection: "row",
    padding: spacing.md,
    borderTopWidth: 1,
    borderTopColor: colors.border,
    backgroundColor: colors.surface,
  },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    marginRight: spacing.sm,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.lg,
    justifyContent: "center",
    ...shadow.sm,
  },
  buttonText: { color: "#fff", fontWeight: "700" },
});
