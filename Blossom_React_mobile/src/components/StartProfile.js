import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet } from "react-native";
import questions from "../data/questions.json";
import { colors, radius, spacing, shadow, typography } from "../theme";
import { saveSignupDraft } from "../api/storage";

export default function StartProfile({
  setQuestionEnded,
  answer,
  setAnswer,
  initialIndex = 0,
  autoStart = false,
}) {
  const [started, setStart] = useState(autoStart);
  const [indiceQuestion, setIndiceQuestion] = useState(initialIndex);
  const [clicked, setClicked] = useState(false);

  function handleClicked(question, value) {
    setClicked(true);
    if (question.field === "language_name" && "language_name" in answer) {
      const { language_name } = answer;
      setAnswer((c) => ({ ...c, [question.field]: [...language_name, ...value] }));
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
          onNext={handleNext}
          handleClicked={handleClicked}
          clicked={clicked}
          setAnswer={setAnswer}
          answer={answer}
          setClicked={setClicked}
        />
      )}
    </View>
  );
}

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

function QuestionOption({ question, onNext, handleClicked, clicked, setAnswer, answer, setClicked }) {
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
      {clicked && (
        <Pressable style={styles.button} onPress={onNext}>
          <Text style={styles.buttonText}>NEXT</Text>
        </Pressable>
      )}
    </View>
  );
}

function Question({ question, handleClicked, answer, setAnswer, setClicked }) {
  if (question.field === "language_name") {
    return (
      <View style={styles.optionGrid}>
        {question.options.map((lang) => {
          const selected = answer.language_name?.includes(lang) || false;
          return (
            <Pressable
              key={lang}
              style={[styles.optionCard, selected && styles.optionCardSelected]}
              onPress={() => {
                const current = answer.language_name || [];
                const updated = selected
                  ? current.filter((item) => item !== lang)
                  : [...current, lang];
                setAnswer((prev) => ({ ...prev, language_name: updated }));
                setClicked(updated.length > 0);
              }}
            >
              <Text style={selected ? styles.optionTextSelected : styles.optionText}>{lang}</Text>
            </Pressable>
          );
        })}
      </View>
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
