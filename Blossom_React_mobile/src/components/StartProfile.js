import { useEffect, useImperativeHandle, useState, forwardRef } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, Modal, FlatList, SafeAreaView } from "react-native";
import questions from "../data/questions.json";
import { colors, radius, spacing, shadow, typography } from "../theme";
import { saveSignupDraft } from "../api/storage";

const StartProfile = forwardRef(function StartProfile(
  { setQuestionEnded, answer, setAnswer, initialIndex = 0, autoStart = false, onReadyChange },
  ref,
) {
  const [started, setStart] = useState(autoStart);
  const [indiceQuestion, setIndiceQuestion] = useState(initialIndex);
  const [clicked, setClicked] = useState(false);

  useEffect(() => {
    onReadyChange?.(started && clicked);
  }, [started, clicked, onReadyChange]);

  function handleClicked(question, value) {
    setClicked(true);
    if ((question.field === "language_name" || question.field === "learning_language_name") && question.field in answer) {
      const prev = answer[question.field];
      setAnswer((c) => ({ ...c, [question.field]: [...prev, ...value] }));
      return;
    }
    setAnswer((c) => ({ ...c, [question.field]: value }));
  }

  function handleLetStart() {
    setStart((s) => !s);
    setIndiceQuestion(0);
    setClicked(false);
    saveSignupDraft({ started: true, questionIndex: 0, answer });
  }

  function handleNext() {
    setClicked(false);
    if (indiceQuestion >= questions.length - 1) {
      setQuestionEnded((c) => !c);
    }
    const nextIndex = indiceQuestion + 1;
    setIndiceQuestion(nextIndex);
    saveSignupDraft({ started: true, questionIndex: nextIndex, answer });
  }

  useImperativeHandle(ref, () => ({ next: handleNext }));

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Create Your Profile Here</Text>

      {started ? (
        <ProgressBar indiceQuestion={indiceQuestion} length={questions.length} />
      ) : (
        <LetsStartButton length={questions.length} onPress={handleLetStart} />
      )}

      {started && indiceQuestion < questions.length && (
        <QuestionOption
          question={questions[indiceQuestion]}
          handleClicked={handleClicked}
          clicked={clicked}
          setAnswer={setAnswer}
          answer={answer}
          setClicked={setClicked}
        />
      )}
    </View>
  );
});


function HeightPicker({ field, options, answer, setAnswer, setClicked }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = answer[field] || null;
  const filtered = search.trim()
    ? options.filter((o) => o.toLowerCase().includes(search.toLowerCase()))
    : options;

  function pick(opt) {
    setAnswer((prev) => ({ ...prev, [field]: opt }));
    setClicked(true);
    setOpen(false);
    setSearch("");
  }

  return (
    <View style={styles.langPickerWrap}>
      {selected && (
        <View style={styles.langSelected}>
          <Pressable style={styles.langChip} onPress={() => { setAnswer((prev) => { const n = { ...prev }; delete n[field]; return n; }); setClicked(false); }}>
            <Text style={styles.langChipText}>📏 {selected} ✕</Text>
          </Pressable>
        </View>
      )}
      <Pressable style={styles.langTrigger} onPress={() => setOpen(true)}>
        <Text style={styles.langTriggerText}>{selected ? "📏 " + selected : "📏 Select your height…"}</Text>
        <Text style={styles.langTriggerArrow}>▼</Text>
      </Pressable>
      <Modal visible={open} animationType="slide" transparent>
        <SafeAreaView style={styles.langModalOverlay}>
          <View style={styles.langModalSheet}>
            <View style={styles.langModalHeader}>
              <Text style={styles.langModalTitle}>Select height</Text>
              <Pressable style={styles.langModalDone} onPress={() => { setOpen(false); setSearch(""); }}>
                <Text style={styles.langModalDoneText}>Done</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.langSearch}
              placeholder="🔍 e.g. 170 cm"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              numColumns={2}
              columnWrapperStyle={{ gap: 8 }}
              contentContainerStyle={{ padding: 12, gap: 8 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: opt }) => {
                const sel = selected === opt;
                return (
                  <Pressable
                    style={[styles.langOption, sel && styles.langOptionSelected, { flex: 1 }]}
                    onPress={() => pick(opt)}
                  >
                    <Text style={[styles.langOptionText, sel && styles.langOptionTextSelected]}>
                      {sel ? "✓ " : ""}{opt}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

function LanguagePicker({ field, options, answer, setAnswer, setClicked }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const selected = answer[field] || [];
  const filtered = search.trim()
    ? options.filter((l) => l.toLowerCase().includes(search.toLowerCase()))
    : options;

  function toggle(lang) {
    const updated = selected.includes(lang)
      ? selected.filter((x) => x !== lang)
      : [...selected, lang];
    setAnswer((prev) => ({ ...prev, [field]: updated }));
    setClicked(updated.length > 0);
  }

  return (
    <View style={styles.langPickerWrap}>
      {/* Selected chips */}
      {selected.length > 0 && (
        <View style={styles.langSelected}>
          {selected.map((lang) => (
            <Pressable key={lang} style={styles.langChip} onPress={() => toggle(lang)}>
              <Text style={styles.langChipText}>{lang} ✕</Text>
            </Pressable>
          ))}
        </View>
      )}

      {/* Trigger button */}
      <Pressable style={styles.langTrigger} onPress={() => setOpen(true)}>
        <Text style={styles.langTriggerText}>
          {selected.length === 0 ? "🌍 Select languages…" : `🌍 ${selected.length} selected — tap to change`}
        </Text>
        <Text style={styles.langTriggerArrow}>▼</Text>
      </Pressable>

      {/* Modal picker */}
      <Modal visible={open} animationType="slide" transparent>
        <SafeAreaView style={styles.langModalOverlay}>
          <View style={styles.langModalSheet}>
            <View style={styles.langModalHeader}>
              <Text style={styles.langModalTitle}>Select languages</Text>
              <Pressable style={styles.langModalDone} onPress={() => { setOpen(false); setSearch(""); }}>
                <Text style={styles.langModalDoneText}>Done</Text>
              </Pressable>
            </View>
            <TextInput
              style={styles.langSearch}
              placeholder="🔍 Search…"
              placeholderTextColor={colors.textMuted}
              value={search}
              onChangeText={setSearch}
              autoFocus={false}
            />
            <FlatList
              data={filtered}
              keyExtractor={(item) => item}
              numColumns={2}
              columnWrapperStyle={{ gap: 8 }}
              contentContainerStyle={{ padding: 12, gap: 8 }}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item: lang }) => {
                const sel = selected.includes(lang);
                return (
                  <Pressable
                    style={[styles.langOption, sel && styles.langOptionSelected, { flex: 1 }]}
                    onPress={() => toggle(lang)}
                  >
                    <Text style={[styles.langOptionText, sel && styles.langOptionTextSelected]}>
                      {sel ? "✓ " : ""}{lang}
                    </Text>
                  </Pressable>
                );
              }}
            />
          </View>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

export default StartProfile;

function LetsStartButton({ length, onPress }) {
  return (
    <View style={styles.letStart}>
      <Text style={styles.letStartTitle}>Create Your Profile</Text>
      <Text style={styles.letStartSubtitle}>{length} questions to create your profile</Text>
      <Pressable style={styles.button} onPress={onPress}>
        <Text style={styles.buttonText}>let's start</Text>
      </Pressable>
    </View>
  );
}

function ProgressBar({ indiceQuestion, length }) {
  return (
    <View style={styles.progressWrapper}>
      <View style={styles.progressTrack}>
        <View
          style={[
            styles.progressFill,
            { width: `${((indiceQuestion + 1) / length) * 100}%` },
          ]}
        />
      </View>
      <Text style={styles.progressText}>
        {indiceQuestion + 1}/{length} Question
      </Text>
    </View>
  );
}

function QuestionOption({ question, handleClicked, clicked, setAnswer, answer, setClicked }) {
  return (
    <View style={styles.questions}>
      <Text style={styles.questionTitle}>{question.question}</Text>
      <Question
        question={question}
        handleClicked={handleClicked}
        clicked={clicked}
        setAnswer={setAnswer}
        answer={answer}
        setClicked={setClicked}
      />
    </View>
  );
}

function Question({ question, handleClicked, answer, setAnswer, setClicked }) {
  if (question.field === "personality_type") {
    const selected = answer.personality_type ? answer.personality_type.split(", ") : [];
    function toggle(option) {
      const updated = selected.includes(option)
        ? selected.filter((x) => x !== option)
        : [...selected, option];
      setAnswer((prev) => ({ ...prev, personality_type: updated.join(", ") }));
      setClicked(updated.length > 0);
    }
    return (
      <View style={styles.optionGrid}>
        {question.options.map((option) => {
          const sel = selected.includes(option);
          return (
            <Pressable
              key={option}
              style={[styles.optionCard, sel && styles.optionCardSelected]}
              onPress={() => toggle(option)}
            >
              <Text style={sel ? styles.optionTextSelected : styles.optionText}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (question.field === "language_name" || question.field === "learning_language_name") {
    return (
      <LanguagePicker
        field={question.field}
        options={question.options}
        answer={answer}
        setAnswer={setAnswer}
        setClicked={setClicked}
      />
    );
  }

  if (question.field === "height_cm") {
    return (
      <HeightPicker
        field={question.field}
        options={question.options}
        answer={answer}
        setAnswer={setAnswer}
        setClicked={setClicked}
      />
    );
  }

  if (question.options) {
    return (
      <View style={styles.optionGrid}>
        {question.options.map((option) => {
          const selected = answer[question.field] === option;
          return (
            <Pressable
              key={option}
              style={[styles.optionCard, selected && styles.optionCardSelected]}
              onPress={() => handleClicked(question, option)}
            >
              <Text style={selected ? styles.optionTextSelected : styles.optionText}>{option}</Text>
            </Pressable>
          );
        })}
      </View>
    );
  }

  if (question.field === "bio") {
    return (
      <TextInput
        style={styles.bioInput}
        placeholder="Tell us about yourself..."
        multiline
        value={answer.bio || ""}
        onChangeText={(text) => {
          setAnswer((prev) => ({ ...prev, bio: text }));
          setClicked(text.trim().length > 0);
        }}
      />
    );
  }

  if (question.field === "occupation") {
    return (
      <TextInput
        style={styles.textInput}
        placeholder="What is your occupation?"
        value={answer.occupation || ""}
        onChangeText={(text) => {
          setAnswer((prev) => ({ ...prev, occupation: text }));
          setClicked(text.trim().length > 0);
        }}
      />
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { padding: spacing.md },
  title: { ...typography.h2, textAlign: "center", marginBottom: spacing.md },
  letStart: { alignItems: "center", padding: spacing.md },
  letStartTitle: { ...typography.h3 },
  letStartSubtitle: { ...typography.bodyMuted, marginVertical: spacing.sm },
  progressWrapper: { marginBottom: spacing.md },
  progressTrack: { height: 8, backgroundColor: colors.border, borderRadius: radius.pill },
  progressFill: { height: 8, backgroundColor: colors.primary, borderRadius: radius.pill },
  progressText: { marginTop: spacing.sm, textAlign: "center", ...typography.bodyMuted },
  questions: { padding: spacing.sm },
  questionTitle: { ...typography.h3, fontSize: 18, marginBottom: spacing.md, textAlign: "center" },
  optionGrid: { flexDirection: "row", flexWrap: "wrap", justifyContent: "center", gap: spacing.sm },
  optionCard: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    margin: 4,
    backgroundColor: colors.surfaceMuted,
  },
  optionCardSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
    ...shadow.sm,
  },
  optionText: { color: colors.text },
  optionTextSelected: { color: "#fff", fontWeight: "700" },
  langPickerWrap: { gap: spacing.sm },
  langTrigger: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: 14,
    backgroundColor: colors.surfaceMuted,
  },
  langTriggerText: { fontSize: 15, color: colors.text, flex: 1 },
  langTriggerArrow: { fontSize: 11, color: colors.textMuted },
  langSelected: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    padding: spacing.sm,
    backgroundColor: "#f5f3ff",
    borderRadius: radius.sm,
    borderWidth: 1.5,
    borderColor: "#c4b5fd",
  },
  langChip: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  langChipText: { color: "#fff", fontSize: 13, fontWeight: "600" },
  langModalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.4)",
    justifyContent: "flex-end",
  },
  langModalSheet: {
    backgroundColor: "#fff",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    maxHeight: "80%",
    paddingBottom: 20,
  },
  langModalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  langModalTitle: { fontSize: 17, fontWeight: "700", color: colors.text },
  langModalDone: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: 18,
    paddingVertical: 8,
  },
  langModalDoneText: { color: "#fff", fontWeight: "700", fontSize: 14 },
  langSearch: {
    borderWidth: 0,
    borderBottomWidth: 1.5,
    borderBottomColor: colors.border,
    paddingHorizontal: spacing.md,
    paddingVertical: 12,
    fontSize: 15,
    color: colors.text,
    backgroundColor: "#fff",
  },
  langOption: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.pill,
    paddingHorizontal: 12,
    paddingVertical: 9,
    alignItems: "center",
  },
  langOptionSelected: {
    backgroundColor: colors.primary,
    borderColor: colors.primary,
  },
  langOptionText: { fontSize: 13, fontWeight: "500", color: colors.text },
  langOptionTextSelected: { color: "#fff", fontWeight: "700" },
  bioInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    minHeight: 100,
    textAlignVertical: "top",
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
  },
  textInput: {
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: radius.sm,
    padding: spacing.md,
    backgroundColor: colors.surfaceMuted,
    color: colors.text,
  },
  button: {
    backgroundColor: colors.primary,
    borderRadius: radius.pill,
    padding: spacing.md,
    alignItems: "center",
    marginTop: spacing.md,
    ...shadow.md,
  },
  buttonText: { color: "#fff", fontWeight: "700", letterSpacing: 0.5 },
});
